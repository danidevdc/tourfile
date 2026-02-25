"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';

// --- Caching Configuration ---
const CACHE_VERSION_ID = 'masterDataVersion';
const CACHE_COLLECTION = 'appConfig';
const CACHE_STORAGE_KEY_PREFIX = 'tourfile_cache_';
const VERSION_STORAGE_KEY = 'tourfile_master_data_version';

/**
 * Fetch remote version from Firestore.
 * Initializes with version 1 if document doesn't exist.
 */
export async function getRemoteVersion(): Promise<number> {
  if (!db) return 0;
  try {
    const versionDocRef = doc(db, CACHE_COLLECTION, CACHE_VERSION_ID);
    const snap = await getDoc(versionDocRef);
    if (!snap.exists()) {
      await setDoc(versionDocRef, { version: 1, lastUpdate: serverTimestamp() });
      return 1;
    }
    return snap.data().version || 0;
  } catch (error) {
    console.warn('Failed to fetch remote version:', error);
    return 0;
  }
}

/**
 * Get local version from sessionStorage.
 */
export function getLocalVersion(): number {
  if (typeof window === 'undefined') return 0;
  const v = sessionStorage.getItem(VERSION_STORAGE_KEY);
  return v ? parseInt(v, 10) : 0;
}

/**
 * Set local version in sessionStorage.
 */
export function setLocalVersion(v: number) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(VERSION_STORAGE_KEY, v.toString());
}

/**
 * Get cached data by key.
 */
export function getCachedData<T>(key: string): T[] | null {
  if (typeof window === 'undefined') return null;
  const data = sessionStorage.getItem(CACHE_STORAGE_KEY_PREFIX + key);
  return data ? JSON.parse(data) : null;
}

/**
 * Set cached data by key.
 */
export function setCachedData<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CACHE_STORAGE_KEY_PREFIX + key, JSON.stringify(data));
}

/**
 * Clear all cached master data from sessionStorage.
 */
export function clearMasterDataCache() {
  if (typeof window === 'undefined') return;
  const keysToRemove = Object.keys(sessionStorage).filter((k) =>
    k.startsWith(CACHE_STORAGE_KEY_PREFIX)
  );
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  sessionStorage.removeItem(VERSION_STORAGE_KEY);
}

/**
 * Check if remote version differs from local version.
 * Returns true if an update was detected and cache was cleared.
 */
export async function checkForMasterDataUpdates(): Promise<boolean> {
  const remoteVersion = await getRemoteVersion();
  const localVersion = getLocalVersion();

  if (remoteVersion > 0 && remoteVersion !== localVersion) {
    console.log(
      `🌐 Nueva versión detectada: v${remoteVersion} (local: v${localVersion}). Limpiando caché...`
    );
    clearMasterDataCache();
    return true;
  }
  return false;
}

/**
 * Generic fetch with caching logic.
 * Checks remote version vs local version and either returns cache or fetches fresh data.
 */
export async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T[]>,
  forceRefresh: boolean = false
): Promise<T[]> {
  // SIEMPRE descarga datos frescos desde Firebase (sin cache)
  // Esto garantiza que los usuarios siempre vean datos actualizados
  console.log(`📊 Descargando ${key} desde Firebase (sin caché, siempre actualizado)`);
  const data = await fetchFn();
  return data;
}

/**
 * Initialize cache version document in Firestore if it doesn't exist.
 */
export async function initializeCacheVersion(): Promise<void> {
  if (!db) return;
  try {
    const versionDocRef = doc(db, CACHE_COLLECTION, CACHE_VERSION_ID);
    const snap = await getDoc(versionDocRef);
    if (!snap.exists()) {
      await setDoc(versionDocRef, { version: 1, lastUpdate: serverTimestamp() });
      console.log('Cache version initialized to 1');
    }
  } catch (error) {
    console.error('Failed to initialize cache version:', error);
  }
}
