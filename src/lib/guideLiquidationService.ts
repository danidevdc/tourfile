"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  runTransaction,
  Timestamp,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getAllServiceOrders, markOrdersWithLiquidation, unmarkOrdersWithLiquidation } from '@/lib/serviceOrderStorage';
import { getGuidesFromFirestore } from '@/lib/serviceOrderMasterData';
import { parseDateDDMMYY } from '@/lib/formatters';

// --- Types ---

export type LiquidationStatus = 'Sin Liquidar' | 'Liquidado' | 'Anulado';

/** Status used in the by-guide view */
export type OrderLiqStatus = 'SIN LIQUIDAR' | 'SOLICITADO' | 'PAGADO';

export interface LiquidationItem {
  serviceOrderId: string;
  fileNumber: string;
  fecha: string;
  hora: string;
  servicio: string;
  paxName: string;
  paxCount: number;
  monto: number;
  checked: boolean;
}

export interface GuideLiquidation {
  id: string;
  liquidationNumber: string;
  fileNumber: string;
  /** Normalized guide name used as a natural key — NOT a Firestore document uid. */
  guideKey: string;
  guideName: string;
  paxName: string;
  paxCount: number;
  status: LiquidationStatus;
  total: number;
  createdBy: string;
  createdAt: Date;
  paidAt?: Date;
  paymentDate?: string;
  items: LiquidationItem[];
}

/**
 * Derives the liquidation's real-world status from `paymentDate`, which is the
 * field every screen in this module actually keys off of. The stored `status`
 * field is set to 'Liquidado' as soon as a liquidation is saved (not when it's
 * paid), so it cannot distinguish "Solicitado" from "Pagado" on its own —
 * always prefer this helper over reading `status` directly for display.
 */
export function getLiquidationDisplayStatus(liq: Pick<GuideLiquidation, 'status' | 'paymentDate'>): OrderLiqStatus | 'ANULADO' {
  if (liq.status === 'Anulado') return 'ANULADO';
  if (liq.status === 'Sin Liquidar') return 'SIN LIQUIDAR';
  return liq.paymentDate ? 'PAGADO' : 'SOLICITADO';
}

export interface StoredServiceOrderForLiquidation {
  id: string;
  orderName: string;
  data: {
    file: string;
    guia: string;
    nPax: string;
    services: Array<{
      id?: string;
      fecha: string;
      hora: string;
      servicio: string;
    }>;
  };
}

// --- Helpers ---

function padNumber(n: number): string {
  return n.toString().padStart(3, '0');
}

/**
 * Prefix for generated liquidation numbers.
 * Switch to 'LIQ' the day this module goes live — every liquidation created
 * under 'TEST' is understood to be a test record, never a real one.
 */
const LIQUIDATION_NUMBER_PREFIX = 'TEST';

const LIQUIDATION_COUNTER_COL = 'counters';
const LIQUIDATION_COUNTER_DOC = 'guideLiquidation';

/**
 * Atomically reserves the next liquidation number for the current prefix.
 * Counting is scoped per-prefix so switching TEST → LIQ restarts numbering at 001
 * instead of continuing from however many test records were created.
 */
async function getNextLiquidationNumber(): Promise<string> {
  if (!db) throw new Error('Firestore not initialized.');
  const counterRef = doc(db, LIQUIDATION_COUNTER_COL, LIQUIDATION_COUNTER_DOC);

  const nextSeq = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    if (!snap.exists()) {
      transaction.set(counterRef, { [LIQUIDATION_NUMBER_PREFIX]: 1 });
      return 1;
    }
    const data = snap.data() as Record<string, number>;
    const next = (data[LIQUIDATION_NUMBER_PREFIX] ?? 0) + 1;
    transaction.update(counterRef, { [LIQUIDATION_NUMBER_PREFIX]: next });
    return next;
  });

  return `${LIQUIDATION_NUMBER_PREFIX}-${padNumber(nextSeq)}`;
}

function timestampToDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date();
}

// --- Queries ---

/** Normalize a file number: strip leading "CTF"/"ctf" prefix and trim spaces. */
function normalizeFileNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/^CTF/i, '').trim();
}

/**
 * Return the unique guide names found in service orders matching the given file number.
 * Uses the session-storage cache via getAllServiceOrders().
 */
export async function getGuidesByFileNumber(fileNumber: string): Promise<string[]> {
  const normalized = normalizeFileNumber(fileNumber);
  if (!normalized) return [];

  const allOrders = await getAllServiceOrders();
  const guideSet = new Set<string>();

  for (const order of allOrders) {
    if (order.status === 'eliminado') continue;
    if (!order.data) continue;
    // Ignorar órdenes C- (chofer) y órdenes con ambos G- y C-
    const name = order.orderName;
    if (name.includes(' — C-')) continue;
    if (name.includes('_C-')) continue;
    const orderFile = normalizeFileNumber(order.data.file ?? '');
    if (orderFile === normalized) {
      const guia = (order.data.guia ?? '').trim().toUpperCase();
      if (guia) guideSet.add(guia);
    }
  }

  return Array.from(guideSet).sort();
}

/**
 * Fetch service orders filtered by file number and guide name.
 * Uses the session-storage cache to avoid Firestore nested-field query issues.
 */
export async function getServiceOrdersByFileAndGuide(
  fileNumber: string,
  guideName: string
): Promise<LiquidationItem[]> {
  const normalizedFile = normalizeFileNumber(fileNumber);
  const normalizedGuide = guideName.trim().toUpperCase();

  const allOrders = await getAllServiceOrders();
  const items: LiquidationItem[] = [];

  // Preferir órdenes G- del guía; si no existen, usar las raíces sin split
  const guideOrders = allOrders.filter((o) => {
    if (o.status === 'eliminado') return false;
    if (!o.data) return false;
    const file = normalizeFileNumber(o.data.file ?? '');
    if (file !== normalizedFile) return false;
    const guia = (o.data.guia ?? '').toUpperCase();
    if (guia !== normalizedGuide) return false;
    return true;
  });

  // Separar en G- y raíces
  const gOrders = guideOrders.filter((o) => o.orderName.includes(' — G-') || o.orderName.includes('_G-'));
  const rootOrders = guideOrders.filter((o) => !o.orderName.includes(' — '));

  // Si hay órdenes G- usar esas, si no usar las raíces
  const ordersToUse = gOrders.length > 0 ? gOrders : rootOrders;

  for (const order of ordersToUse) {
    const services = order.data.services ?? [];
    for (const svc of services) {
      items.push({
        serviceOrderId: order.id,
        fileNumber: order.data.file ?? '',
        fecha: svc.fecha ?? '',
        hora: svc.hora ?? '',
        servicio: svc.servicio ?? '',
        paxName: (order.data.ref ?? order.data.hotel ?? '').trim(),
        paxCount: parseInt(order.data.nPax ?? '0', 10) || 0,
        monto: 0,
        checked: false,
      });
    }
  }

  // Sort by date ascending (format dd/MM/yy or dd/MM/yyyy); invalid dates sort last.
  items.sort((a, b) => {
    const da = parseDateDDMMYY(a.fecha)?.getTime() ?? Infinity;
    const db = parseDateDDMMYY(b.fecha)?.getTime() ?? Infinity;
    return da - db;
  });

  return items;
}

/** Maps a Firestore guideLiquidations document into a GuideLiquidation. */
function mapLiquidationDoc(d: { id: string; data: () => Record<string, unknown> }): GuideLiquidation {
  const data = d.data();
  return {
    id: d.id,
    liquidationNumber: (data.liquidationNumber as string) ?? '',
    fileNumber: (data.fileNumber as string) ?? '',
    // Fall back to the legacy `guideId` field name for documents written before the rename.
    guideKey: (data.guideKey as string) ?? (data.guideId as string) ?? '',
    guideName: (data.guideName as string) ?? '',
    paxName: (data.paxName as string) ?? '',
    paxCount: (data.paxCount as number) ?? 0,
    status: (data.status as LiquidationStatus) ?? 'Sin Liquidar',
    total: (data.total as number) ?? 0,
    createdBy: (data.createdBy as string) ?? '',
    createdAt: timestampToDate(data.createdAt),
    paidAt: data.paidAt ? timestampToDate(data.paidAt) : undefined,
    paymentDate: (data.paymentDate as string) ?? undefined,
    items: (data.items as LiquidationItem[]) ?? [],
  };
}

/**
 * Safety cap for getAllLiquidations(). This function backs dashboard aggregates
 * (getDashboardStats, getLiquidationsByFile, getLiquidationsByGuide) which need the
 * full dataset to compute correctly — so it isn't paginated. This cap only prevents
 * an unbounded read if the collection grows far beyond expected volume; for a paged
 * listing UI use getLiquidationsPaginated() instead.
 */
const ALL_LIQUIDATIONS_CAP = 2000;

/**
 * Get all liquidations, ordered by creation date descending.
 * Used internally by getLiquidationsByFile, getLiquidationsByGuide and getDashboardStats,
 * which need the complete dataset. For a paged UI listing, use getLiquidationsPaginated().
 */
export async function getAllLiquidations(): Promise<GuideLiquidation[]> {
  if (!db) throw new Error('Firestore not initialized.');
  const q = query(
    collection(db, 'guideLiquidations'),
    orderBy('createdAt', 'desc'),
    limit(ALL_LIQUIDATIONS_CAP)
  );
  const snapshot = await getDocs(q);
  if (snapshot.size >= ALL_LIQUIDATIONS_CAP) {
    console.warn(`getAllLiquidations() hit its ${ALL_LIQUIDATIONS_CAP}-doc cap — dashboard aggregates may be incomplete.`);
  }
  return snapshot.docs.map(mapLiquidationDoc);
}

/**
 * Get a page of liquidations ordered by creation date descending, for listing UIs.
 * Pass the previous call's lastDoc back in to fetch the next page.
 */
export async function getLiquidationsPaginated(
  pageSize: number = 20,
  cursor: QueryDocumentSnapshot | null = null
): Promise<{ liquidations: GuideLiquidation[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  if (!db) throw new Error('Firestore not initialized.');
  let q = query(
    collection(db, 'guideLiquidations'),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );
  if (cursor) {
    q = query(q, startAfter(cursor));
  }
  const snapshot = await getDocs(q);
  return {
    liquidations: snapshot.docs.map(mapLiquidationDoc),
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === pageSize,
  };
}

/**
 * Get liquidations for a specific file number.
 */
export async function getLiquidationsByFile(fileNumber: string): Promise<GuideLiquidation[]> {
  if (!db) throw new Error('Firestore not initialized.');
  const normalized = normalizeFileNumber(fileNumber);
  const all = await getAllLiquidations();
  return all.filter((l) => normalizeFileNumber(l.fileNumber) === normalized);
}

/**
 * Save a new liquidation. Assigns auto-incremented number.
 * Returns the saved liquidation with its ID and number.
 */
export async function saveLiquidation(payload: {
  fileNumber: string;
  guideKey: string;
  guideName: string;
  paxName: string;
  paxCount: number;
  items: LiquidationItem[];
  createdBy: string;
}): Promise<GuideLiquidation> {
  if (!db) throw new Error('Firestore not initialized.');

  const liquidationNumber = await getNextLiquidationNumber();
  const total = payload.items.reduce((sum, item) => sum + (item.checked ? (item.monto || 0) : 0), 0);

  const docData = {
    liquidationNumber,
    fileNumber: payload.fileNumber,
    guideKey: payload.guideKey,
    guideName: payload.guideName,
    paxName: payload.paxName,
    paxCount: payload.paxCount,
    status: 'Liquidado' as LiquidationStatus,
    total,
    createdBy: payload.createdBy,
    createdAt: serverTimestamp(),
    items: payload.items,
  };

  const docRef = await addDoc(collection(db, 'guideLiquidations'), docData);

  // Mark all involved service orders with hasLiquidation=true
  const orderIds = [...new Set(payload.items.map((i) => i.serviceOrderId).filter(Boolean))];
  if (orderIds.length > 0) {
    await markOrdersWithLiquidation(orderIds);
  }

  return {
    id: docRef.id,
    ...docData,
    createdAt: new Date(),
  };
}

/**
 * Get a single liquidation by ID.
 */
export async function getLiquidationById(id: string): Promise<GuideLiquidation | null> {
  if (!db) throw new Error('Firestore not initialized.');
  const snap = await getDoc(doc(db, 'guideLiquidations', id));
  if (!snap.exists()) return null;
  return mapLiquidationDoc(snap);
}

/**
 * Update items and total of an existing liquidation.
 */
export async function updateLiquidation(
  id: string,
  payload: { items: LiquidationItem[]; paxName: string; paxCount: number }
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  const total = payload.items.reduce((sum, item) => sum + (item.checked ? (item.monto || 0) : 0), 0);
  await updateDoc(doc(db, 'guideLiquidations', id), {
    items: payload.items,
    paxName: payload.paxName,
    paxCount: payload.paxCount,
    total,
  });
}

/**
 * Update the status of an existing liquidation.
 */
export async function updateLiquidationStatus(
  id: string,
  status: LiquidationStatus
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  await updateDoc(doc(db, 'guideLiquidations', id), { status });
}

export interface LiquidationDashboardStats {
  total: number;
  montoTotal: number;
  esteMes: number;
  guiasUnicas: number;
  recientes: GuideLiquidation[];
}

/**
 * Compute dashboard stats from the guideLiquidations collection.
 */
export async function getDashboardStats(): Promise<LiquidationDashboardStats> {
  const all = await getAllLiquidations();
  const now = new Date();
  const montoTotal = all.reduce((sum, l) => sum + (l.total || 0), 0);
  const esteMes = all.filter((l) => {
    const d = l.createdAt instanceof Date ? l.createdAt : new Date(l.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const guiasUnicas = new Set(all.map((l) => l.guideName.trim().toUpperCase()).filter(Boolean)).size;
  return {
    total: all.length,
    montoTotal,
    esteMes,
    guiasUnicas,
    recientes: all.slice(0, 8),
  };
}

/**
 * Get all guide names from the guides master collection in Firestore.
 */
const EXCLUDED_GUIDE_NAMES = ['TBA', 'SIN GUIA', 'SIN GUÍA', 'POR ASIGNAR', 'N/A', '-', ''];

export async function getAllGuideNames(): Promise<string[]> {
  const guides = await getGuidesFromFirestore();
  return guides
    .map(g => g.fullName.trim())
    .filter(name => !EXCLUDED_GUIDE_NAMES.includes(name.toUpperCase()))
    .sort();
}

export interface GuideAvailableMonths {
  [year: number]: number[]; // year → sorted array of month numbers (1-12)
}

/**
 * Return the years and months where a guide has at least one service order.
 * Uses the sessionStorage cache — 0 Firestore reads if cache is warm.
 */
export async function getAvailableMonthsForGuide(guideName: string): Promise<GuideAvailableMonths> {
  const allOrders = await getAllServiceOrders();
  const normalizedGuide = guideName.trim().toUpperCase();
  const map = new Map<number, Set<number>>();

  for (const order of allOrders) {
    if (order.status === 'eliminado' || order.status === 'cancelado') continue;
    if (!order.data) continue;
    const guia = (order.data.guia ?? '').trim().toUpperCase();
    if (guia !== normalizedGuide) continue;

    const services = order.data.services ?? [];
    for (const svc of services) {
      const parsed = parseDateDDMMYY(svc.fecha ?? '');
      if (!parsed) continue;
      const y = parsed.getUTCFullYear();
      const m = parsed.getUTCMonth() + 1;
      if (!map.has(y)) map.set(y, new Set());
      map.get(y)!.add(m);
    }
  }

  const result: GuideAvailableMonths = {};
  for (const [year, months] of map.entries()) {
    result[year] = Array.from(months).sort((a, b) => a - b);
  }
  return result;
}

export interface GuideFileRow {
  fileNumber: string;
  paxName: string;
  paxCount: number;
  hasLiquidation: boolean;
  orderIds: string[];
}

/**
 * Build GuideFileRow[] from the sessionStorage cache — no Firestore reads.
 */
function buildRowsFromOrders(
  allOrders: Awaited<ReturnType<typeof getAllServiceOrders>>,
  normalizedGuide: string,
  month: number,
  year: number
): GuideFileRow[] {
  const fileMap = new Map<string, GuideFileRow>();

  for (const order of allOrders) {
    if (order.status === 'eliminado' || order.status === 'cancelado') continue;
    if (!order.data) continue;
    const guia = (order.data.guia ?? '').trim().toUpperCase();
    if (guia !== normalizedGuide) continue;

    const services = order.data.services ?? [];
    const hasServiceInMonth = services.some(svc => {
      const parsed = parseDateDDMMYY(svc.fecha ?? '');
      if (!parsed) return false;
      return parsed.getUTCMonth() + 1 === month && parsed.getUTCFullYear() === year;
    });
    if (!hasServiceInMonth) continue;

    const fileNum = normalizeFileNumber(order.data.file ?? '');
    if (!fileNum) continue;

    if (!fileMap.has(fileNum)) {
      fileMap.set(fileNum, {
        fileNumber: order.data.file ?? '',
        paxName: (order.data.ref ?? order.data.hotel ?? '').trim(),
        paxCount: parseInt(order.data.nPax ?? '0', 10) || 0,
        hasLiquidation: order.hasLiquidation ?? false,
        orderIds: [order.id],
      });
    } else {
      const existing = fileMap.get(fileNum)!;
      if (!existing.orderIds.includes(order.id)) existing.orderIds.push(order.id);
      if (order.hasLiquidation) existing.hasLiquidation = true;
    }
  }

  return Array.from(fileMap.values()).sort((a, b) =>
    normalizeFileNumber(a.fileNumber).localeCompare(normalizeFileNumber(b.fileNumber))
  );
}

/**
 * Get unique files worked by a guide in a given month/year, grouped by file number.
 *
 * Cache strategy:
 * - Current month → always recompute from sessionStorage (data may still change)
 * - Past months   → read from Firestore `guideMonthCache` collection first.
 *                   On miss: compute, store in Firestore, return result.
 *                   On hit:  return cached rows directly (1 Firestore read, 0 processing)
 */
export async function getOrdersByGuideAndMonth(
  guideName: string,
  month: number,
  year: number
): Promise<GuideFileRow[]> {
  const normalizedGuide = guideName.trim().toUpperCase();
  const now = new Date();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  // Current month: always recompute — orders may still be added/edited
  if (isCurrentMonth) {
    const allOrders = await getAllServiceOrders();
    return buildRowsFromOrders(allOrders, normalizedGuide, month, year);
  }

  // Past month: try Firestore cache first
  if (!db) throw new Error('Firestore not initialized.');
  const cacheKey = `${normalizedGuide.replace(/\s+/g, '_')}-${year}-${month}`;
  const cacheRef = doc(db, 'guideMonthCache', cacheKey);
  const cacheSnap = await getDoc(cacheRef);

  if (cacheSnap.exists()) {
    return cacheSnap.data().rows as GuideFileRow[];
  }

  // Cache miss: compute from sessionStorage and persist
  const allOrders = await getAllServiceOrders();
  const rows = buildRowsFromOrders(allOrders, normalizedGuide, month, year);

  // Store in Firestore asynchronously — don't block the UI
  setDoc(cacheRef, { rows, cachedAt: serverTimestamp() }).catch(console.error);

  return rows;
}

/**
 * Get all liquidations for a specific guide name, with their liquidationId attached to matching orders.
 */
export async function getLiquidationsByGuide(guideName: string): Promise<GuideLiquidation[]> {
  if (!db) throw new Error('Firestore not initialized.');
  const all = await getAllLiquidations();
  const normalized = guideName.trim().toUpperCase();
  return all.filter(l => l.guideName.trim().toUpperCase() === normalized);
}

/**
 * Mark a liquidation as paid with the given payment date.
 */
export async function payLiquidation(id: string, paymentDate: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  await updateDoc(doc(db, 'guideLiquidations', id), {
    status: 'Liquidado' as LiquidationStatus,
    paidAt: serverTimestamp(),
    paymentDate,
  });
}

/**
 * Delete a liquidation permanently.
 * If no more liquidations remain for the same file, unmarks the hasLiquidation flag
 * on the involved service orders.
 */
export async function deleteLiquidation(liq: GuideLiquidation): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  await deleteDoc(doc(db, 'guideLiquidations', liq.id));

  // Check if any liquidations remain for this file
  const remaining = await getLiquidationsByFile(liq.fileNumber);
  if (remaining.length === 0) {
    const orderIds = [...new Set(liq.items.map((i) => i.serviceOrderId).filter(Boolean))];
    if (orderIds.length > 0) {
      await unmarkOrdersWithLiquidation(orderIds);
    }
  }
}
