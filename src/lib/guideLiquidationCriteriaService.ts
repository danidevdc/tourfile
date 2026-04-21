"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// ── Constants ────────────────────────────────────────────────────────────────

export const IDIOMAS = ["JAPONES", "ALEMAN", "ITALIANO", "INGLES", "ESPAÑOL"] as const;
export type Idioma = typeof IDIOMAS[number];

export const TURNOS = ["DIURNO", "NOCTURNO"] as const;
export type Turno = typeof TURNOS[number];

export const GRUPOS = ["INDIVIDUAL", "GRUPO"] as const;
export type Grupo = typeof GRUPOS[number];

/** Hour boundary for nocturno: 21:00–06:59 is NOCTURNO, 07:00–20:59 is DIURNO */
const NOCTURNO_START = 21 * 60; // 21:00 in minutes
const NOCTURNO_END   =  7 * 60; // 07:00 in minutes
const GRUPO_MIN_PAX  = 5;       // 5+ pax = GRUPO

export const IDIOMA_LABELS: Record<Idioma, string> = {
  JAPONES:  "Japonés",
  ALEMAN:   "Alemán",
  ITALIANO: "Italiano",
  INGLES:   "Inglés",
  ESPAÑOL:  "Español",
};

/** Tariff order: most expensive → cheapest */
export const IDIOMA_TARIFF_ORDER: Idioma[] = ["JAPONES", "ALEMAN", "ITALIANO", "INGLES", "ESPAÑOL"];

export const IDIOMA_COLORS: Record<Idioma, string> = {
  JAPONES:  "#ef4444",
  ALEMAN:   "#7c3aed",
  ITALIANO: "#16a34a",
  INGLES:   "#0991ea",
  ESPAÑOL:  "#eab308",
};

// ── Rule model ───────────────────────────────────────────────────────────────

/**
 * Simplified liquidation price rule.
 * Key: (actividad, idioma, turno, grupo) → monto.
 * The four combination fields replace the old free-form hora/pax ranges.
 */
export interface LiquidationCriteriaRule {
  id: string;
  actividad: string;   // Exact activity name from the activities collection
  idioma: Idioma | ""; // "" = applies to all idiomas (fallback rule)
  turno: Turno | "";   // "" = applies to any turno
  grupo: Grupo | "";   // "" = applies to any grupo
  monto: number;       // Price in Bs.
  isActive: boolean;
  notes: string;
}

const COL = 'guideLiquidationCriteria';

function mapDoc(d: { id: string; data: () => Record<string, unknown> }): LiquidationCriteriaRule {
  const data = d.data();
  return {
    id: d.id,
    actividad: (data.actividad as string) ?? (data.servicioKeyword as string) ?? '',
    idioma:    (data.idioma   as Idioma)  ?? (data.guiaIdioma   as Idioma)  ?? '',
    turno:     (data.turno    as Turno)   ?? '',
    grupo:     (data.grupo    as Grupo)   ?? '',
    monto:     (data.monto    as number)  ?? 0,
    isActive:  (data.isActive as boolean) ?? true,
    notes:     (data.notes    as string)  ?? '',
  };
}

export async function getLiquidationCriteria(): Promise<LiquidationCriteriaRule[]> {
  if (!db) throw new Error('Firestore not initialized.');
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(mapDoc);
}

export async function saveLiquidationCriteriaRule(
  rule: Omit<LiquidationCriteriaRule, 'id'>
): Promise<LiquidationCriteriaRule> {
  if (!db) throw new Error('Firestore not initialized.');
  const ref = await addDoc(collection(db, COL), { ...rule, createdAt: serverTimestamp() });
  return { ...rule, id: ref.id };
}

export async function updateLiquidationCriteriaRule(
  id: string,
  data: Partial<Omit<LiquidationCriteriaRule, 'id'>>
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  await updateDoc(doc(db, COL, id), data);
}

export async function deleteLiquidationCriteriaRule(id: string): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  await deleteDoc(doc(db, COL, id));
}

/**
 * Save an entire batch of rules atomically.
 * Deletes all existing rules and replaces with the new set.
 */
export async function saveAllCriteriaRules(
  rules: Omit<LiquidationCriteriaRule, 'id'>[]
): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  // Delete existing
  const existing = await getDocs(collection(db, COL));
  const batch = writeBatch(db);
  existing.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  // Write new
  const batch2 = writeBatch(db);
  for (const rule of rules) {
    const ref = doc(collection(db, COL));
    batch2.set(ref, { ...rule, createdAt: serverTimestamp() });
  }
  await batch2.commit();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getTurno(hora: string): Turno {
  const min = timeToMinutes(hora);
  return (min >= NOCTURNO_START || min < NOCTURNO_END) ? 'NOCTURNO' : 'DIURNO';
}

export function getGrupo(paxCount: number): Grupo {
  return paxCount >= GRUPO_MIN_PAX ? 'GRUPO' : 'INDIVIDUAL';
}

/**
 * Find the best matching rule for a service item.
 * Match priority: exact (actividad+idioma+turno+grupo) → relaxed combos → fallback.
 * Returns the monto or null if no rule matches.
 */
export function applyBestCriteriaRule(
  rules: LiquidationCriteriaRule[],
  item: { servicio: string; hora: string; paxCount: number },
  idioma: Idioma | string
): number | null {
  const svc   = item.servicio.trim().toUpperCase();
  const turno = getTurno(item.hora);
  const grupo = getGrupo(item.paxCount);
  const lang  = idioma.toUpperCase() as Idioma;

  const active = rules.filter((r) => r.isActive);

  // Score a rule: higher = better match. Returns -1 if rule doesn't apply.
  function score(r: LiquidationCriteriaRule): number {
    // actividad must match (substring) if set
    if (r.actividad && !svc.includes(r.actividad.toUpperCase())) return -1;
    // idioma must match exactly if set
    if (r.idioma && r.idioma !== lang) return -1;
    // turno must match if set
    if (r.turno && r.turno !== turno) return -1;
    // grupo must match if set
    if (r.grupo && r.grupo !== grupo) return -1;

    // Specificity score: each matched (non-empty) field adds points
    return (r.actividad ? 8 : 0) + (r.idioma ? 4 : 0) + (r.turno ? 2 : 0) + (r.grupo ? 1 : 0);
  }

  let best: LiquidationCriteriaRule | null = null;
  let bestScore = -1;
  for (const r of active) {
    const s = score(r);
    if (s > bestScore) { bestScore = s; best = r; }
  }

  return best ? best.monto : null;
}

// ── Guide language memory ────────────────────────────────────────────────────

const LANG_COL = "guideLiquidationGuideLanguage";

export interface GuideLanguageMemory {
  id: string;
  guideId: string;
  guideName: string;
  idiomaCounts: Record<Idioma, number>;
  lastIdioma: Idioma;
}

export async function recordGuideIdioma(
  guideId: string, guideName: string, idioma: Idioma
): Promise<void> {
  if (!db) return;
  const ref = doc(db, LANG_COL, guideId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const counts = Object.fromEntries(
      IDIOMAS.map((i) => [i, i === idioma ? 1 : 0])
    ) as Record<Idioma, number>;

    await setDoc(ref, { guideId, guideName, idiomaCounts: counts, lastIdioma: idioma });
  } else {
    const prev = snap.data()?.idiomaCounts?.[idioma] ?? 0;
    await updateDoc(ref, {
      [`idiomaCounts.${idioma}`]: prev + 1,
      lastIdioma: idioma,
      guideName,
    });
  }
}

export async function getSuggestedIdioma(guideId: string): Promise<Idioma | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, LANG_COL, guideId));
  if (!snap.exists()) return null;
  const data = snap.data() as GuideLanguageMemory;
  const counts = data.idiomaCounts ?? {};
  let best: Idioma | null = null;
  let bestCount = 0;
  for (const idioma of IDIOMAS) {
    if ((counts[idioma] ?? 0) > bestCount) {
      bestCount = counts[idioma];
      best = idioma;
    }
  }
  return best;
}
