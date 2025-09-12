
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

export const inferSplitKind = (o: StoredServiceOrder): SplitKind => {
  if (o.data?.services?.length) {
    const s0 = o.data.services[0];
    // Check for chofer first because a service can have both
    if (s0?.chofer) return "driver";
  }
  if (o.data?.guia) return "guide";
  return null;
};

export const childNameFrom = (parentBase: string, o: StoredServiceOrder) => {
  const kind = inferSplitKind(o);
  if (kind === "guide") return `${parentBase} — G:${shortPerson(o.data.guia)}`;
  if (kind === "driver") return `${parentBase} — C:${shortPerson(o.data.services[0]?.chofer)}`;
  
  const assignee = o.data.guia || o.data.services?.[0]?.chofer;
  return `${parentBase} — ${shortPerson(assignee)}`;
};
