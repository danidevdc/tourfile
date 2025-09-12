
"use client";

import type { StoredServiceOrder } from "./serviceOrderStorage";

export const getFamilyId = (o: StoredServiceOrder) => o.splitFrom ?? o.id;

export const getBaseName = (name: string) => {
  const parts = name.split(" — ");
  return parts[0].replace(/_/g, " ").trim();
};

export const shortPerson = (full?: string) => {
  if (!full) return "N/A";
  return full.replace(/^CONT\.\s*/i, "").trim().split(/\s+/)[0].toUpperCase();
};

export type SplitKind = "guide" | "driver" | null;

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
export const childNameFrom = (parentBase: string, o: StoredServiceOrder) => {
  // Use a more specific assignee for the name.
  // If a service has its own guide, use that. Otherwise, use the main guide.
  const serviceSpecificGuide = o.data.services?.[0]?.guia;
  const mainGuide = o.data.guia;
  const guideToUse = serviceSpecificGuide || mainGuide;
  
  const choferToUse = o.data.services?.[0]?.chofer;

  // If the guide is present and differs from the parent's main guide, prioritize it for naming.
  if (guideToUse) {
      return `${parentBase} — G:${shortPerson(guideToUse)}`;
  }
  // Otherwise, use the driver.
  if (choferToUse) {
       return `${parentBase} — C:${shortPerson(choferToUse)}`;
  }
  // Fallback if neither is defined in the child data.
  return `${parentBase} — ${shortPerson(guideToUse || choferToUse)}`;
};
