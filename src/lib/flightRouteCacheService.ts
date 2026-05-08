"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

export interface FlightRouteCacheEntry {
  flightNumber: string;
  canonicalFlightNumber?: string;
  airlineCode?: string;
  departureTime?: string;
  arrivalTime?: string;
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
  const match = normalized.match(/^([A-Z0-9]+?)(\d+)$/);
  if (!match) return normalized;

  const [, prefix, rest] = match;
  const airlinePrefixMap: Record<string, string> = {
    '8J': 'ECO',
    AVA: 'AV',
    BO: 'BOV',
    LA: 'LAN',
    OB: 'BOV',
  };

  return `${airlinePrefixMap[prefix] || prefix}${rest}`;
}

export function getAirlineCodeFromFlightNumber(flightNumber: string): string | undefined {
  const normalized = normalizeFlightNumberForCache(flightNumber);
  return normalized.match(/^[A-Z0-9]+?(?=\d)/)?.[0];
}

function getFlightNumberCacheAliases(flightNumber: string): string[] {
  const normalized = flightNumber.replace(/\s/g, '').toUpperCase();
  const canonical = normalizeFlightNumberForCache(normalized);
  const digits = normalized.match(/\d+$/)?.[0];
  const aliases = [canonical, normalized];

  if (digits && canonical.startsWith('ECO')) {
    aliases.push(`8J${digits}`);
  }
  if (digits && canonical.startsWith('AV')) {
    aliases.push(`AVA${digits}`);
  }

  return Array.from(new Set(aliases));
}

export async function getFlightRouteFromCache(flightNumber: string): Promise<FlightRouteCacheEntry | null> {
  if (!db) return null;

  const aliases = getFlightNumberCacheAliases(flightNumber);

  try {
    for (const alias of aliases) {
      const ref = doc(db, 'flightRouteCache', alias);
      const snap = await getDoc(ref);
      if (!snap.exists()) continue;

      await updateDoc(ref, { lastUsedAt: serverTimestamp() });
      return snap.data() as FlightRouteCacheEntry;
    }
    return null;
  } catch (error) {
    console.warn('Unable to read flight route cache:', error);
    return null;
  }
}

export async function saveFlightRouteToCache(params: {
  flightNumber: string;
  origin?: string;
  destination?: string;
  departureTime?: string;
  arrivalTime?: string;
  discoveredBy?: 'aeroapi' | 'manual';
}): Promise<void> {
  if (!db || !params.origin || !params.destination) return;

  const firestore = db;
  const aliases = getFlightNumberCacheAliases(params.flightNumber);
  const normalizedFlightNumber = normalizeFlightNumberForCache(params.flightNumber);
  const airlineCode = getAirlineCodeFromFlightNumber(normalizedFlightNumber);
  const origin = params.origin.toUpperCase();
  const destination = params.destination.toUpperCase();

  try {
    await Promise.all(aliases.map((alias) =>
      setDoc(doc(firestore, 'flightRouteCache', alias), {
        flightNumber: alias,
        canonicalFlightNumber: normalizedFlightNumber,
        airlineCode,
        origin,
        destination,
        segment: `${origin}/${destination}`,
        discoveredBy: params.discoveredBy || 'aeroapi',
        firstSeenAt: serverTimestamp(),
        lastUsedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(params.departureTime ? { departureTime: params.departureTime } : {}),
        ...(params.arrivalTime ? { arrivalTime: params.arrivalTime } : {}),
      }, { merge: true })
    ));
  } catch (error) {
    console.warn('Unable to save flight route cache:', error);
  }
}
