"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  writeBatch,
  increment,
  setDoc,
} from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';
import { clearMasterDataCache } from './serviceOrderCache';

// --- Cache Constants ---
const CACHE_COLLECTION = 'appConfig';
const CACHE_VERSION_ID = 'masterDataVersion';

/**
 * Increment cache version and clear local cache for all data fetches.
 * Run this after any CREATE, UPDATE, or DELETE operation on master data.
 */
async function invalidateMasterCache(): Promise<void> {
  if (!db) return;
  try {
    const versionRef = doc(db, CACHE_COLLECTION, CACHE_VERSION_ID);
    await setDoc(versionRef, { version: increment(1), lastUpdate: serverTimestamp() }, { merge: true });
    clearMasterDataCache();
  } catch (error) {
    console.error('Failed to invalidate master cache:', error);
  }
}

// --- CRUD: Guides ---
export const createGuide = async (guide: { firstName: string; lastName: string }) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'guides'));
  batch.set(ref, { firstName: guide.firstName.trim(), lastName: guide.lastName.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const updateGuide = async (id: string, data: { firstName: string; lastName: string }) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'guides', id), { firstName: data.firstName.trim(), lastName: data.lastName.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteGuide = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'guides', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

// --- CRUD: Hotels ---
export const createHotel = async (name: string) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'hotels'));
  batch.set(ref, { name: name.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const updateHotel = async (id: string, name: string) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'hotels', id), { name: name.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteHotel = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'hotels', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

// --- CRUD: Activities ---
export const createActivity = async (name: string) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'activities'));
  batch.set(ref, { name: name.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const updateActivity = async (id: string, name: string) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'activities', id), { name: name.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteActivity = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'activities', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

// --- CRUD: Drivers ---
export const createDriver = async (name: string) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'drivers'));
  batch.set(ref, { name: name.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const updateDriver = async (id: string, name: string) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'drivers', id), { name: name.trim() });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteDriver = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'drivers', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

// --- CRUD: Flights ---
export interface PredefinedFlight {
  id: string;
  flightNumber: string;
  time: string;
  observations: string;
}

export const createFlight = async (flight: Omit<PredefinedFlight, 'id'>) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'flights'));
  batch.set(ref, flight);
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const updateFlight = async (id: string, data: Omit<PredefinedFlight, 'id'>) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'flights', id), data);
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteFlight = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'flights', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

// --- CRUD: Buses ---
export interface Bus {
  id: string;
  name: string;
}

export const createBus = async (name: string) => {
  if (!db) throw new Error('Firestore not initialized.');
  const trimmedName = name.trim().toUpperCase();
  const batch = writeBatch(db);
  const docRef = doc(db, 'buses', trimmedName);
  batch.set(docRef, { name: trimmedName });
  const versionRef = doc(db, CACHE_COLLECTION, CACHE_VERSION_ID);
  batch.update(versionRef, { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const updateBus = async (id: string, name: string) => {
  if (!db) throw new Error('Firestore not initialized.');
  const batch = writeBatch(db);
  batch.set(doc(db, 'buses', id), { name: name.trim().toUpperCase() });
  batch.update(doc(db, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteBus = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'buses', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

// --- Bulk CRUD Operations ---

/**
 * Generic bulk creation function.
 * Creates multiple documents in a single batch and invalidates cache.
 */
const createBulk = async (collectionName: string, records: { [key: string]: any }[]) => {
  if (!db) throw new Error('Firestore not initialized');
  const batch = writeBatch(db);
  const collectionRef = collection(db, collectionName);
  records.forEach((record) => {
    const docRef = doc(collectionRef);
    // Recorta espacios sobrantes en cualquier campo de texto (ej. importaciones
    // desde Excel suelen traer espacios al inicio/fin de nombres/actividades).
    const trimmedRecord = Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    );
    batch.set(docRef, trimmedRecord);
  });
  batch.update(doc(db, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const createBulkGuides = (guides: { firstName: string; lastName: string }[]) =>
  createBulk('guides', guides);

export const createBulkHotels = (hotels: { name: string }[]) => createBulk('hotels', hotels);

export const createBulkActivities = (activities: { name: string }[]) =>
  createBulk('activities', activities);

export const createBulkDrivers = (drivers: { name: string }[]) => createBulk('drivers', drivers);

export const createBulkFlights = (flights: Omit<PredefinedFlight, 'id'>[]) =>
  createBulk('flights', flights);

/**
 * Generic bulk deletion function.
 * Deletes multiple documents in a single batch and invalidates cache.
 */
const deleteBulk = async (collectionName: string, ids: string[]) => {
  if (!db) throw new Error('Firestore not initialized');
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const docRef = doc(db!, collectionName, id);
    batch.delete(docRef);
  });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), {
    version: increment(1),
    lastUpdate: serverTimestamp(),
  });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteBulkGuides = (ids: string[]) => deleteBulk('guides', ids);

export const deleteBulkHotels = (ids: string[]) => deleteBulk('hotels', ids);

export const deleteBulkActivities = (ids: string[]) => deleteBulk('activities', ids);

export const deleteBulkDrivers = (ids: string[]) => deleteBulk('drivers', ids);

export const deleteBulkFlights = (ids: string[]) => deleteBulk('flights', ids);
