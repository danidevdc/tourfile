"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

export interface FlightRouteCacheEntry {
  flightNumber: string;
  origin: string;
  destination: string;
  segment: string;
  discoveredBy: 'aeroapi' | 'manual';
  firstSeenAt?: unknown;
  lastUsedAt?: unknown;
  updatedAt?: unknown;
}

export function normalizeFlightNumberForCache(flightNumber: string): string {
  const normalized = flightNumber.replace(/\s/g, '').toUpperCase();
  return normalized.startsWith('OB') ? normalized.replace('OB', 'BOV') : normalized;
}

export async function getFlightRouteFromCache(flightNumber: string): Promise<FlightRouteCacheEntry | null> {
  if (!db) return null;

  const normalizedFlightNumber = normalizeFlightNumberForCache(flightNumber);
  const ref = doc(db, 'flightRouteCache', normalizedFlightNumber);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    await updateDoc(ref, { lastUsedAt: serverTimestamp() });
    return snap.data() as FlightRouteCacheEntry;
  } catch (error) {
    console.warn('Unable to read flight route cache:', error);
    return null;
  }
}

export async function saveFlightRouteToCache(params: {
  flightNumber: string;
  origin?: string;
  destination?: string;
  discoveredBy?: 'aeroapi' | 'manual';
}): Promise<void> {
  if (!db || !params.origin || !params.destination) return;

  const normalizedFlightNumber = normalizeFlightNumberForCache(params.flightNumber);
  const origin = params.origin.toUpperCase();
  const destination = params.destination.toUpperCase();
  const ref = doc(db, 'flightRouteCache', normalizedFlightNumber);

  try {
    await setDoc(ref, {
      flightNumber: normalizedFlightNumber,
      origin,
      destination,
      segment: `${origin}/${destination}`,
      discoveredBy: params.discoveredBy || 'aeroapi',
      firstSeenAt: serverTimestamp(),
      lastUsedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn('Unable to save flight route cache:', error);
  }
}
