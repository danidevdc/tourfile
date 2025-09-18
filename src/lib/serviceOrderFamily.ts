

"use client";

import type { StoredServiceOrder } from "./serviceOrderStorage";
import type { SplitKind as InferredSplitKind } from "./serviceOrderFamily"; // Import the type if it's defined elsewhere

export type SplitKind = "guide" | "driver" | "combined" | null;

export const getFamilyId = (o: StoredServiceOrder) => o.splitFrom ?? o.id;

export const getBaseName = (name: string) => {
  const parts = name.split(" — ");
  return parts[0].replace(/_/g, " ").trim();
};

export const shortPerson = (full?: string): string => {
  if (!full || full.trim() === '') return '';
  return full.replace(/^CONT\.\s*/i, "").trim().split(/\s+/)[0].toUpperCase();
};

// Deduces the type of split looking at the services
export const inferSplitKind = (o: StoredServiceOrder): SplitKind => {
  const uniqueGuides = new Set(o.data.services?.map(s => s.guia || o.data.guia));
  const uniqueDrivers = new Set(o.data.services?.map(s => s.chofer || ''));

  const hasMultipleGuides = uniqueGuides.size > 1;
  const hasMultipleDrivers = uniqueDrivers.size > 1;

  if (hasMultipleGuides && hasMultipleDrivers) return "combined";
  if (hasMultipleGuides) return "guide";
  if (hasMultipleDrivers) return "driver";
  
  return null;
};

// Consistent name for child orders
export const childNameFrom = (parentBase: string, o: StoredServiceOrder): string => {
    const guideToUse = o.data.responsible?.guia || o.data.guia;
    const choferToUse = o.data.responsible?.chofer || '';

    // Handle combined names for clarity
    const guidePart = `G-${shortPerson(guideToUse)}`;
    const driverPart = `C-${shortPerson(choferToUse)}`;

    return `${parentBase} — ${guidePart}_${driverPart}`;
};
