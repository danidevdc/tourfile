

"use client";

import type { StoredServiceOrder } from "./serviceOrderStorage";

export type SplitKind = "guide" | "driver" | "combined" | null;

export const getFamilyId = (o: StoredServiceOrder) => o.splitFrom ?? o.id;

export const getBaseName = (name: string) => {
  const parts = name.split(" — ");
  return parts[0].replace(/_/g, " ").trim();
};

export const shortPerson = (full?: string): string => {
  if (!full || full.trim() === '') return '';
  // Corrected regex to make the dot optional and match "CONT " or "CONT. "
  return full.replace(/^CONT\.?\s*/i, "").trim().split(/\s+/)[0].toUpperCase();
};


/**
 * Creates a consistent name for a child order based on its responsible person.
 * @param parentBase The base name of the parent order (e.g., "ODS_FECHA_FILE").
 * @param guide The full name of the guide responsible for this split.
 * @param driver The full name of the driver responsible for this split.
 * @returns A formatted string for the child order name.
 */
export const childNameFrom = (parentBase: string, guide: string | null, driver: string | null): string => {
    const guidePart = guide ? `G-${shortPerson(guide)}` : '';
    const driverPart = driver ? `C-${shortPerson(driver)}` : '';

    if (guidePart && driverPart) {
        return `${parentBase} — ${guidePart}_${driverPart}`;
    }
    if (guidePart) {
        return `${parentBase} — ${guidePart}`;
    }
    if (driverPart) {
        return `${parentBase} — ${driverPart}`;
    }
    return parentBase; // Fallback
};
