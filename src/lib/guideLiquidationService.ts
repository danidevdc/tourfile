"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getAllServiceOrders, markOrdersWithLiquidation, unmarkOrdersWithLiquidation } from '@/lib/serviceOrderStorage';
import { getGuidesFromFirestore } from '@/lib/serviceOrderMasterData';

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
  guideId: string;
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
  return n.toString().padStart(2, '0');
}

async function getNextLiquidationNumber(): Promise<string> {
  // TODO: remove this when going live — fixed number for testing on develop
  return 'LIQ-000';
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

  // Sort by date ascending (format dd/MM/yy or dd/MM/yyyy)
  items.sort((a, b) => {
    const parseDate = (s: string) => {
      const parts = s.split('/').map(Number);
      let [d, m, y] = parts;
      if (y < 100) y += 2000;
      return new Date(y, m - 1, d).getTime();
    };
    return parseDate(a.fecha) - parseDate(b.fecha);
  });

  return items;
}

/**
 * Get all liquidations, ordered by creation date descending.
 */
export async function getAllLiquidations(): Promise<GuideLiquidation[]> {
  if (!db) throw new Error('Firestore not initialized.');
  const q = query(
    collection(db, 'guideLiquidations'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      liquidationNumber: data.liquidationNumber ?? '',
      fileNumber: data.fileNumber ?? '',
      guideId: data.guideId ?? '',
      guideName: data.guideName ?? '',
      paxName: data.paxName ?? '',
      paxCount: data.paxCount ?? 0,
      status: data.status ?? 'Sin Liquidar',
      total: data.total ?? 0,
      createdBy: data.createdBy ?? '',
      createdAt: timestampToDate(data.createdAt),
      paidAt: data.paidAt ? timestampToDate(data.paidAt) : undefined,
      paymentDate: data.paymentDate ?? undefined,
      items: data.items ?? [],
    };
  });
}

/**
 * Get liquidations for a specific file number.
 */
export async function getLiquidationsByFile(fileNumber: string): Promise<GuideLiquidation[]> {
  if (!db) throw new Error('Firestore not initialized.');
  const normalized = normalizeFileNumber(fileNumber);
  const q = query(
    collection(db, 'guideLiquidations'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        liquidationNumber: data.liquidationNumber ?? '',
        fileNumber: data.fileNumber ?? '',
        guideId: data.guideId ?? '',
        guideName: data.guideName ?? '',
        paxName: data.paxName ?? '',
        paxCount: data.paxCount ?? 0,
        status: data.status ?? 'Sin Liquidar',
        total: data.total ?? 0,
        createdBy: data.createdBy ?? '',
        createdAt: timestampToDate(data.createdAt),
        paidAt: data.paidAt ? timestampToDate(data.paidAt) : undefined,
        paymentDate: data.paymentDate ?? undefined,
        items: data.items ?? [],
      } as GuideLiquidation;
    })
    .filter((l) => normalizeFileNumber(l.fileNumber) === normalized);
}

/**
 * Save a new liquidation. Assigns auto-incremented number.
 * Returns the saved liquidation with its ID and number.
 */
export async function saveLiquidation(payload: {
  fileNumber: string;
  guideId: string;
  guideName: string;
  paxName: string;
  paxCount: number;
  items: LiquidationItem[];
  createdBy: string;
}): Promise<GuideLiquidation> {
  if (!db) throw new Error('Firestore not initialized.');

  const liquidationNumber = await getNextLiquidationNumber();
  const total = payload.items.reduce((sum, item) => sum + (item.monto || 0), 0);

  const docData = {
    liquidationNumber,
    fileNumber: payload.fileNumber,
    guideId: payload.guideId,
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
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'guideLiquidations', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    liquidationNumber: data.liquidationNumber ?? '',
    fileNumber: data.fileNumber ?? '',
    guideId: data.guideId ?? '',
    guideName: data.guideName ?? '',
    paxName: data.paxName ?? '',
    paxCount: data.paxCount ?? 0,
    status: data.status ?? 'Sin Liquidar',
    total: data.total ?? 0,
    createdBy: data.createdBy ?? '',
    createdAt: timestampToDate(data.createdAt),
    items: data.items ?? [],
  };
}

/**
 * Update items and total of an existing liquidation.
 */
export async function updateLiquidation(
  id: string,
  payload: { items: LiquidationItem[]; paxName: string; paxCount: number }
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  const total = payload.items.reduce((sum, item) => sum + (item.monto || 0), 0);
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
export async function getAllGuideNames(): Promise<string[]> {
  const guides = await getGuidesFromFirestore();
  return guides.map(g => g.fullName).sort();
}

export interface GuideFileRow {
  fileNumber: string;
  paxName: string;
  paxCount: number;
  hasLiquidation: boolean;
  orderIds: string[];
}

/**
 * Get unique files worked by a guide in a given month/year, grouped by file number.
 * Includes any order where data.guia matches — roots, G- children, shared orders.
 */
export async function getOrdersByGuideAndMonth(
  guideName: string,
  month: number,
  year: number
): Promise<GuideFileRow[]> {
  const allOrders = await getAllServiceOrders();
  const normalizedGuide = guideName.trim().toUpperCase();

  // Map fileNumber → row
  const fileMap = new Map<string, GuideFileRow>();

  for (const order of allOrders) {
    if (order.status === 'eliminado' || order.status === 'cancelado') continue;
    if (!order.data) continue;
    const guia = (order.data.guia ?? '').trim().toUpperCase();
    if (guia !== normalizedGuide) continue;

    // Check if any service falls in the requested month/year
    const services = order.data.services ?? [];
    const hasServiceInMonth = services.some(svc => {
      if (!svc.fecha) return false;
      const parts = svc.fecha.split('/').map(Number);
      let [, m, y] = parts;
      if (y < 100) y += 2000;
      return m === month && y === year;
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
