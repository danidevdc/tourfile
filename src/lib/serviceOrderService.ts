
"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  getDoc,
  updateDoc,
  increment,
  query,
  where,
  setDoc,
  limit,
} from 'firebase/firestore';
// import { getFlightFromFirestore } from './flightSyncService'; // This file was removed.
import { format, parse } from 'date-fns';
import { serverTimestamp } from 'firebase/firestore';

// --- Caching Configuration ---
const CACHE_VERSION_ID = 'masterDataVersion';
const CACHE_COLLECTION = 'appConfig';
const CACHE_STORAGE_KEY_PREFIX = 'tourfile_cache_';
const VERSION_STORAGE_KEY = 'tourfile_master_data_version';

async function getRemoteVersion(): Promise<number> {
  if (!db) return 0;
  try {
    const versionDocRef = doc(db, CACHE_COLLECTION, CACHE_VERSION_ID);
    const snap = await getDoc(versionDocRef);
    if (!snap.exists()) {
      // Initialize if not exists
      await setDoc(versionDocRef, { version: 1, lastUpdate: serverTimestamp() });
      return 1;
    }
    return snap.data().version || 0;
  } catch (error) {
    console.warn("Failed to fetch remote version:", error);
    return 0;
  }
}

function getLocalVersion(): number {
  if (typeof window === 'undefined') return 0;
  const v = sessionStorage.getItem(VERSION_STORAGE_KEY);
  return v ? parseInt(v, 10) : 0;
}

function setLocalVersion(v: number) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(VERSION_STORAGE_KEY, v.toString());
}

function getCachedData<T>(key: string): T[] | null {
  if (typeof window === 'undefined') return null;
  const data = sessionStorage.getItem(CACHE_STORAGE_KEY_PREFIX + key);
  return data ? JSON.parse(data) : null;
}

function setCachedData<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CACHE_STORAGE_KEY_PREFIX + key, JSON.stringify(data));
}

export function clearMasterDataCache() {
  if (typeof window === 'undefined') return;
  const keysToRemove = Object.keys(sessionStorage).filter(k => k.startsWith(CACHE_STORAGE_KEY_PREFIX));
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
  sessionStorage.removeItem(VERSION_STORAGE_KEY);
}

async function incrementRemoteVersion(): Promise<void> {
  if (!db) return;
  const versionDocRef = doc(db, CACHE_COLLECTION, CACHE_VERSION_ID);
  await updateDoc(versionDocRef, {
    version: increment(1),
    lastUpdate: serverTimestamp()
  });
}

/**
 * Checks if the remote master data version has changed.
 * Returns true if there was an update.
 */
export async function checkForMasterDataUpdates(): Promise<boolean> {
  const remoteVersion = await getRemoteVersion();
  const localVersion = getLocalVersion();

  if (remoteVersion > 0 && remoteVersion !== localVersion) {
    console.log(`🌐 Nueva versión detectada: v${remoteVersion} (local: v${localVersion}). Limpiando caché...`);
    clearMasterDataCache();
    return true;
  }
  return false;
}

/**
 * Generic function to fetch data with caching
 */
async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T[]>,
  forceRefresh: boolean = false
): Promise<T[]> {
  const remoteVersion = await getRemoteVersion();
  const localVersion = getLocalVersion();

  if (!forceRefresh && remoteVersion === localVersion && localVersion > 0) {
    const cached = getCachedData<T>(key);
    if (cached) {
      console.log(`✅ Usando caché para ${key} (version ${localVersion})`);
      return cached;
    }
  }

  console.log(`📊 Descargando ${key} desde Firebase... (remote: v${remoteVersion}, local: v${localVersion})`);
  const data = await fetchFn();

  setCachedData(key, data);
  if (remoteVersion > 0) setLocalVersion(remoteVersion);

  return data;
}

// --- Interface Definitions ---

export interface Hotel {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  name: string;
  suggestedTime?: string; // Field for the most common time
  timeCounts?: { [time: string]: number }; // Field to count usages
}

export interface Driver {
  id: string;
  name: string;
}

export interface Guide {
  uid: string; // Firestore document id
  firstName: string;
  lastName: string;
}

export interface PredefinedFlight {
  id: string;
  flightNumber: string;
  time: string;
  observations: string;
}

export interface Bus {
  id: string;
  name: string;
}

export interface ServiceOrderGuide extends Guide {
  fullName: string;
}

export interface ServiceOrderData {
  guia: string;
  file: string;
  ref: string;
  nPax: string;
  hotel: string;
  services: ServiceItem[];
  observations?: string;
  nota?: string;
  isSplitSeparated?: boolean;
}

export interface ServiceItem {
  id?: string;
  fecha: string;
  hora: string;
  servicio: string;
  vuelo?: string;
  guia?: string;
  bus?: string;
  chofer?: string;
  tarifa?: string;
  observaciones?: string;
}

// --- Default Data ---
const defaultBuses = ['Bus 8', 'Bus 9', 'Bus 10'];

// --- Initialization Functions ---
export async function initializeDefaultBuses(): Promise<void> {
  if (!db) throw new Error("Firestore not initialized.");
  const busesRef = collection(db, 'buses');
  console.log("Attempting to initialize default buses...");

  try {
    const batch = writeBatch(db);
    defaultBuses.forEach(busName => {
      // Use the bus name as the document ID to enforce uniqueness
      const docRef = doc(busesRef, busName.toUpperCase());
      // Use set with merge:true. This will create the doc if it doesn't exist,
      // or do nothing if it does. It will not overwrite existing data.
      batch.set(docRef, { name: busName.toUpperCase() }, { merge: true });
    });
    await batch.commit();
    console.log('Default buses initialization check complete.');
  } catch (error) {
    console.error("Error during default bus initialization:", error);
  }
}


// --- Data Fetching Functions ---

export async function getGuidesFromFirestore(forceRefresh: boolean = false): Promise<ServiceOrderGuide[]> {
  return fetchWithCache<ServiceOrderGuide>('guides', async () => {
    if (!db) throw new Error("Firestore not initialized.");
    const guidesRef = collection(db, 'guides');
    const snapshot = await getDocs(guidesRef);

    console.log(`📊 getGuidesFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`);

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
      const data = doc.data() as Omit<Guide, 'uid'>;
      const firstName = data.firstName.toUpperCase();
      const lastName = data.lastName.toUpperCase();
      return {
        uid: doc.id,
        firstName: firstName,
        lastName: lastName,
        fullName: `${firstName} ${lastName}`.trim()
      };
    }).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, forceRefresh);
}

export async function getHotelsFromFirestore(forceRefresh: boolean = false): Promise<Hotel[]> {
  return fetchWithCache<Hotel>('hotels', async () => {
    if (!db) throw new Error("Firestore not initialized.");
    const hotelsRef = collection(db, 'hotels');
    const snapshot = await getDocs(hotelsRef);

    console.log(`📊 getHotelsFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`);

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data().name as string).toUpperCase()
    } as Hotel))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}

export async function getActivitiesFromFirestore(forceRefresh: boolean = false): Promise<Activity[]> {
  return fetchWithCache<Activity>('activities', async () => {
    if (!db) throw new Error("Firestore not initialized.");
    const activitiesRef = collection(db, 'activities');
    const snapshot = await getDocs(activitiesRef);

    console.log(`📊 getActivitiesFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`);

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data().name as string).toUpperCase(),
      suggestedTime: doc.data().suggestedTime, // Also fetch the suggested time
    } as Activity))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}

export async function getDriversFromFirestore(forceRefresh: boolean = false): Promise<Driver[]> {
  return fetchWithCache<Driver>('drivers', async () => {
    if (!db) throw new Error("Firestore not initialized.");
    const driversRef = collection(db, 'drivers');
    const snapshot = await getDocs(driversRef);

    console.log(`📊 getDriversFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`);

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data().name as string).toUpperCase()
    } as Driver))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}

export async function getFlightsFromFirestore(forceRefresh: boolean = false): Promise<PredefinedFlight[]> {
  return fetchWithCache<PredefinedFlight>('flights', async () => {
    if (!db) throw new Error("Firestore not initialized.");
    const flightsRef = collection(db, 'flights');
    const snapshot = await getDocs(flightsRef);

    console.log(`📊 getFlightsFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`);

    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<PredefinedFlight, 'id'>)
    } as PredefinedFlight)).sort((a, b) => a.flightNumber.localeCompare(b.flightNumber));
  }, forceRefresh);
}

export async function getBusesFromFirestore(forceRefresh: boolean = false): Promise<Bus[]> {
  return fetchWithCache<Bus>('buses', async () => {
    if (!db) throw new Error("Firestore not initialized.");
    const busesRef = collection(db, 'buses');
    const snapshot = await getDocs(busesRef);

    console.log(`📊 getBusesFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`);

    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data().name as string).toUpperCase()
    } as Bus)).sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}


// --- Functions to Check for Duplicates ---

async function checkExists(collectionName: string, fieldName: string, value: string): Promise<boolean> {
  if (!db) return false;
  const q = query(collection(db, collectionName), where(fieldName, "==", value.toUpperCase()));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export const checkIfHotelExists = (name: string) => checkExists('hotels', 'name', name);
export const checkIfActivityExists = (name: string) => checkExists('activities', 'name', name);
export const checkIfDriverExists = (name: string) => checkExists('drivers', 'name', name);
export const checkIfFlightExists = (flightNumber: string) => checkExists('flights', 'flightNumber', flightNumber);

export async function checkIfBusExists(name: string): Promise<boolean> {
  if (!db) return false;
  const busDocRef = doc(db, 'buses', name.toUpperCase());
  const docSnap = await getDoc(busDocRef);
  return docSnap.exists();
}


export async function checkIfGuideExists(firstName: string, lastName: string): Promise<boolean> {
  if (!db) return false;
  const q = query(collection(db, 'guides'),
    where("firstName", "==", firstName.toUpperCase()),
    where("lastName", "==", lastName.toUpperCase())
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}


// --- Data Creation Functions (Single) ---

export const createGuide = async (guide: { firstName: string, lastName: string }) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'guides'));
  batch.set(ref, guide);
  const versionRef = doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID);
  batch.update(versionRef, { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const createHotel = async (name: string) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'hotels'));
  batch.set(ref, { name });
  const versionRef = doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID);
  batch.update(versionRef, { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const createActivity = async (name: string) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'activities'));
  batch.set(ref, { name });
  const versionRef = doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID);
  batch.update(versionRef, { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const createDriver = async (name: string) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'drivers'));
  batch.set(ref, { name });
  const versionRef = doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID);
  batch.update(versionRef, { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const createFlight = async (flight: Omit<PredefinedFlight, 'id'>) => {
  const batch = writeBatch(db!);
  const ref = doc(collection(db!, 'flights'));
  batch.set(ref, flight);
  const versionRef = doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID);
  batch.update(versionRef, { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const createBus = async (name: string) => {
  if (!db) throw new Error("Firestore not initialized.");
  const batch = writeBatch(db);
  const docRef = doc(db, 'buses', name.toUpperCase());
  batch.set(docRef, { name: name.toUpperCase() });
  const versionRef = doc(db, CACHE_COLLECTION, CACHE_VERSION_ID);
  batch.update(versionRef, { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};


// --- Data Update Functions ---
export const updateGuide = async (id: string, data: { firstName: string, lastName: string }) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'guides', id), data);
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const updateHotel = async (id: string, name: string) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'hotels', id), { name });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const updateActivity = async (id: string, name: string) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'activities', id), { name });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const updateDriver = async (id: string, name: string) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'drivers', id), { name });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const updateFlight = async (id: string, data: Omit<PredefinedFlight, 'id'>) => {
  const batch = writeBatch(db!);
  batch.set(doc(db!, 'flights', id), data);
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const updateBus = async (id: string, name: string) => {
  if (!db) throw new Error("Firestore not initialized.");
  const batch = writeBatch(db);
  batch.set(doc(db, 'buses', id), { name: name.toUpperCase() });
  batch.update(doc(db, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

// --- Data Creation Functions (Bulk) ---
const createBulk = async (collectionName: string, records: { [key: string]: any }[]) => {
  if (!db) throw new Error("Firestore not initialized");
  const batch = writeBatch(db);
  const collectionRef = collection(db, collectionName);
  records.forEach(record => {
    const docRef = doc(collectionRef);
    batch.set(docRef, record);
  });
  batch.update(doc(db, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const createBulkGuides = (guides: { firstName: string, lastName: string }[]) => createBulk('guides', guides);
export const createBulkHotels = (hotels: { name: string }[]) => createBulk('hotels', hotels);
export const createBulkActivities = (activities: { name: string }[]) => createBulk('activities', activities);
export const createBulkDrivers = (drivers: { name: string }[]) => createBulk('drivers', drivers);
export const createBulkFlights = (flights: Omit<PredefinedFlight, 'id'>[]) => createBulk('flights', flights);


// --- Data Deletion Functions ---

export const deleteGuide = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'guides', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteHotel = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'hotels', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteActivity = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'activities', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteDriver = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'drivers', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteFlight = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'flights', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteBus = async (id: string) => {
  const batch = writeBatch(db!);
  batch.delete(doc(db!, 'buses', id));
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

// --- Bulk Deletion Functions ---
const deleteBulk = async (collectionName: string, ids: string[]) => {
  if (!db) throw new Error("Firestore not initialized");
  const batch = writeBatch(db);
  ids.forEach(id => {
    const docRef = doc(db!, collectionName, id);
    batch.delete(docRef);
  });
  batch.update(doc(db!, CACHE_COLLECTION, CACHE_VERSION_ID), { version: increment(1), lastUpdate: serverTimestamp() });
  await batch.commit();
  clearMasterDataCache();
};

export const deleteBulkGuides = (ids: string[]) => deleteBulk('guides', ids);
export const deleteBulkHotels = (ids: string[]) => deleteBulk('hotels', ids);
export const deleteBulkActivities = (ids: string[]) => deleteBulk('activities', ids);
export const deleteBulkDrivers = (ids: string[]) => deleteBulk('drivers', ids);
export const deleteBulkFlights = (ids: string[]) => deleteBulk('flights', ids);


// --- AI/Learning Functions ---

/**
 * Records the usage of a specific time for an activity to build suggestions.
 * If a time is used more than twice, it becomes the new suggested time.
 * @param activityName The name of the activity.
 * @param time The time used for the activity (e.g., "09:00").
 */
export async function recordActivityTimeUsage(activityName: string, time: string): Promise<void> {
  if (!db || !activityName || !/^\d{2}:\d{2}$/.test(time)) return;

  const activityQuery = query(collection(db, 'activities'), where('name', '==', activityName.toUpperCase()));
  const querySnapshot = await getDocs(activityQuery);

  if (querySnapshot.empty) {
    console.warn(`Activity "${activityName}" not found. Cannot record time usage.`);
    return;
  }

  const activityDocRef = querySnapshot.docs[0].ref;

  try {
    await runTransaction(db, async (transaction) => {
      const activityDoc = await transaction.get(activityDocRef);
      if (!activityDoc.exists()) return;

      const currentCounts = activityDoc.data().timeCounts || {};
      const newCount = (currentCounts[time] || 0) + 1;

      // Update the count for the specific time
      const updates: { [key: string]: any } = {
        [`timeCounts.${time}`]: newCount,
      };

      // If the count reaches 2, set it as the new suggested time
      if (newCount >= 2) {
        updates.suggestedTime = time;
      }

      transaction.update(activityDocRef, updates);
    });
  } catch (error) {
    console.error(`Failed to record time usage for ${activityName}:`, error);
  }
}

/**
 * Gets the suggested time for a given activity from the 'activities' collection.
 * @param activityName The name of the activity.
 * @returns The suggested time as a string (e.g., "09:00") or null if no data exists.
 */
export async function getSuggestedTimeForActivity(activityName: string): Promise<string | null> {
  if (!db || !activityName) return null;

  const activityQuery = query(collection(db, 'activities'), where('name', '==', activityName.toUpperCase()));

  try {
    const querySnapshot = await getDocs(activityQuery);
    if (querySnapshot.empty) {
      return null;
    }
    const activityDoc = querySnapshot.docs[0];
    return activityDoc.data().suggestedTime || null;

  } catch (error) {
    console.error(`Failed to get suggested time for ${activityName}:`, error);
    return null;
  }
}

/**
 * NOTE: This function is temporarily disabled as it depends on `flightSyncService` which has been removed.
 * Searches for a flight in the local Firestore database and returns a formatted ServiceItem.
 * @param flightNumber The flight number to search.
 * @param serviceDate The date of the service in dd/MM/yy format.
 * @param transferType 'TRF IN' or 'TRF OUT'.
 * @returns A promise that resolves to a partial ServiceItem with flight details.
 */
/*
export async function getFlightServiceDetails(
  flightNumber: string,
  serviceDate: string,
  transferType: 'TRF IN' | 'TRF OUT'
): Promise<Partial<ServiceItem>> {
  try {
    const date = parse(serviceDate, 'dd/MM/yy', new Date());
    const dateString = format(date, 'yyyy-MM-dd');
    const flight = await getFlightFromFirestore(flightNumber, dateString);

    if (!flight) {
      return { vuelo: flightNumber.toUpperCase() }; // Return flight number even if not found
    }

    let newTime = '';
    let newObservation = '';
    const segment = `${flight.departure.iata}/${flight.arrival.iata}`;

    if (transferType === 'TRF IN' && flight.arrival.actual) {
      const arrivalTime = flight.arrival.actual;
      const pickupTime = new Date(arrivalTime.getTime() - 1 * 60 * 60 * 1000); // 1 hour before
      newTime = format(pickupTime, 'HH:mm');
      newObservation = `EL VUELO LLEGA A LAS ${format(arrivalTime, 'HH:mm')} ${segment}`;
    } else if (transferType === 'TRF OUT' && flight.departure.actual) {
      const departureTime = flight.departure.actual;
      const pickupTime = new Date(departureTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
      newTime = format(pickupTime, 'HH:mm');
      newObservation = `EL VUELO SALE A LAS ${format(departureTime, 'HH:mm')} ${segment}`;
    }

    return {
      vuelo: flight.flight.iata,
      hora: newTime || flight.type === 'arrival' ? format(flight.arrival.scheduled, 'HH:mm') : format(flight.departure.scheduled, 'HH:mm'),
      observaciones: newObservation.trim(),
    };
  } catch (error) {
    console.error(`Error getting flight service details for ${flightNumber}:`, error);
    return { vuelo: flightNumber.toUpperCase() }; // Graceful fallback
  }
}
*/
