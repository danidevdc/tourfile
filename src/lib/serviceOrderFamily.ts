

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

/**
 * Creates a consistent name for a child order based on its responsible person.
 * @param parentBase The base name of the parent order (e.g., "ODS_FECHA_FILE").
 * @param guide The full name of the guide responsible for this split.
 * @param driver The full name of the driver responsible for this split.
 * @returns A formatted string for the child order name.
 */
export const childNameFrom = (parentBase: string, guide: string | null, driver: string | null): string => {
    if (guide) {
      return `${parentBase} — G-${shortPerson(guide)}`;
    }
    if (driver) {
      return `${parentBase} — C-${shortPerson(driver)}`;
    }
    return parentBase; // Fallback
};

