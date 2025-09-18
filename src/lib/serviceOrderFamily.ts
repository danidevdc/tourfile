
"use client";

import type { StoredServiceOrder } from "./serviceOrderStorage";
import type { SplitKind as InferredSplitKind } from "./serviceOrderFamily"; // Import the type if it's defined elsewhere

export type SplitKind = "guide" | "driver" | null;

export const getFamilyId = (o: StoredServiceOrder) => o.splitFrom ?? o.id;

export const getBaseName = (name: string) => {
  const parts = name.split(" — ");
  return parts[0].replace(/_/g, " ").trim();
};

export const shortPerson = (full?: string) => {
  if (!full) return "N/A";
  return full.replace(/^CONT\.\s*/i, "").trim().split(/\s+/)[0].toUpperCase();
};

// Deduces the type of split looking at the services
export const inferSplitKind = (o: StoredServiceOrder): SplitKind => {
  // If there are multiple guides, it's a guide split.
  const uniqueGuides = new Set(o.data.services?.map(s => s.guia || o.data.guia));
  if (uniqueGuides.size > 1) return "guide";

  // If guides are the same, check for different drivers.
  const uniqueDrivers = new Set(o.data.services?.map(s => s.chofer || ''));
  if (uniqueDrivers.size > 1) return "driver";
  
  // Default fallbacks
  if (o.data?.services?.[0]?.chofer) return "driver";
  if (o.data?.guia) return "guide";

  return null;
};

// Consistent name for child orders
export const childNameFrom = (parentBase: string, o: StoredServiceOrder, dimension: SplitKind): string => {
    if (dimension === 'guide') {
        const guideToUse = o.data.responsible?.guia || o.data.guia;
        return `${parentBase} — G-${shortPerson(guideToUse)}`;
    }
    if (dimension === 'driver') {
        const choferToUse = o.data.responsible?.chofer || '';
        return `${parentBase} — C-${shortPerson(choferToUse)}`;
    }
    return parentBase; // Fallback
};
