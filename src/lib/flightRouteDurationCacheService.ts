"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

export interface FlightRouteDurationCacheEntry {
  origin: string;
  destination: string;
  segment: string;
  durationMinutes: number;
  samples: number;
  updatedAt?: unknown;
}

function normalizeCode(code?: string): string {
  return (code || '').trim().toUpperCase();
}

function getRouteDurationCacheId(origin?: string, destination?: string): string | null {
  const normalizedOrigin = normalizeCode(origin);
  const normalizedDestination = normalizeCode(destination);
  if (!/^[A-Z]{3}$/.test(normalizedOrigin) || !/^[A-Z]{3}$/.test(normalizedDestination)) {
    return null;
  }
  return `${normalizedOrigin}_${normalizedDestination}`;
}

function parseDisplayDateTime(date?: string, time?: string): Date | null {
  if (!date || !time || !date.includes('/') || !time.includes(':')) return null;

  const [day, month, year] = date.split('/').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hours, minutes);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateFlightDurationMinutes(params: {
  departureDate?: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
}): number | null {
  const departure = parseDisplayDateTime(params.departureDate, params.departureTime);
  const arrival = parseDisplayDateTime(params.arrivalDate, params.arrivalTime);
  if (!departure || !arrival) return null;

  const minutes = Math.round((arrival.getTime() - departure.getTime()) / 60000);
  if (minutes <= 0 || minutes > 24 * 60) return null;
  return minutes;
}

export async function getFlightRouteDurationFromCache(
  origin?: string,
  destination?: string
): Promise<FlightRouteDurationCacheEntry | null> {
  if (!db) return null;

  const cacheId = getRouteDurationCacheId(origin, destination);
  if (!cacheId) return null;

  try {
    const snap = await getDoc(doc(db, 'flightRouteDurationCache', cacheId));
    return snap.exists() ? snap.data() as FlightRouteDurationCacheEntry : null;
  } catch (error) {
    console.warn('Unable to read flight route duration cache:', error);
    return null;
  }
}

export async function saveFlightRouteDurationToCache(params: {
  origin?: string;
  destination?: string;
  durationMinutes?: number | null;
}): Promise<void> {
  if (!db || !params.durationMinutes) return;

  const cacheId = getRouteDurationCacheId(params.origin, params.destination);
  if (!cacheId) return;

  const origin = normalizeCode(params.origin);
  const destination = normalizeCode(params.destination);

  try {
    const ref = doc(db, 'flightRouteDurationCache', cacheId);
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data() as Partial<FlightRouteDurationCacheEntry> : null;
    const currentSamples = current?.samples || 0;
    const currentDuration = current?.durationMinutes || params.durationMinutes;
    const nextSamples = currentSamples + 1;
    const nextDuration = Math.round(((currentDuration * currentSamples) + params.durationMinutes) / nextSamples);

    await setDoc(ref, {
      origin,
      destination,
      segment: `${origin}/${destination}`,
      durationMinutes: nextDuration,
      samples: nextSamples,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.warn('Unable to save flight route duration cache:', error);
  }
}
