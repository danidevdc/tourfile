"use client";

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import { serverTimestamp } from 'firebase/firestore';
import {
  fetchWithCache,
  getRemoteVersion,
  getLocalVersion,
  setLocalVersion,
  getCachedData,
  setCachedData,
  clearMasterDataCache,
  checkForMasterDataUpdates,
  initializeCacheVersion,
} from './serviceOrderCache';

// --- Interface Definitions ---

export interface Hotel {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  name: string;
  suggestedTime?: string;
  timeCounts?: { [time: string]: number };
}

export interface Driver {
  id: string;
  name: string;
}

export interface Guide {
  uid: string;
  firstName: string;
  lastName: string;
}

export interface ServiceOrderGuide extends Guide {
  fullName: string;
}

export interface Bus {
  id: string;
  name: string;
}

export interface PredefinedFlight {
  id: string;
  flightNumber: string;
  time: string;
  observations: string;
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
const DEFAULT_BUSES = ['Bus 8', 'Bus 9', 'Bus 10'];

// --- Cache Config ---
const CACHE_VERSION_ID = 'masterDataVersion';
const CACHE_COLLECTION = 'appConfig';

// --- Initialization Functions ---

/**
 * Initialize default buses in Firestore.
 */
export async function initializeDefaultBuses(): Promise<void> {
  if (!db) throw new Error('Firestore not initialized.');
  const busesRef = collection(db, 'buses');
  console.log('Attempting to initialize default buses...');

  try {
    const batch = writeBatch(db);
    DEFAULT_BUSES.forEach((busName) => {
      const docRef = doc(busesRef, busName.toUpperCase());
      batch.set(docRef, { name: busName.toUpperCase() }, { merge: true });
    });
    await batch.commit();
    console.log('Default buses initialization check complete.');
  } catch (error) {
    console.error('Error during default bus initialization:', error);
  }
}

// --- Data Fetching Functions (Queries) ---

/**
 * Get all guides from Firestore with caching.
 */
export async function getGuidesFromFirestore(forceRefresh: boolean = false): Promise<ServiceOrderGuide[]> {
  return fetchWithCache<ServiceOrderGuide>('guides', async () => {
    if (!db) throw new Error('Firestore not initialized.');
    const guidesRef = collection(db, 'guides');
    const snapshot = await getDocs(guidesRef);

    console.log(
      `📊 getGuidesFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`
    );

    if (snapshot.empty) return [];

    return snapshot.docs
      .map((doc) => {
        const data = doc.data() as Omit<Guide, 'uid'>;
        const firstName = data.firstName.toUpperCase();
        const lastName = data.lastName.toUpperCase();
        return {
          uid: doc.id,
          firstName: firstName,
          lastName: lastName,
          fullName: `${firstName} ${lastName}`.trim(),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, forceRefresh);
}

/**
 * Get all hotels from Firestore with caching.
 */
export async function getHotelsFromFirestore(forceRefresh: boolean = false): Promise<Hotel[]> {
  return fetchWithCache<Hotel>('hotels', async () => {
    if (!db) throw new Error('Firestore not initialized.');
    const hotelsRef = collection(db, 'hotels');
    const snapshot = await getDocs(hotelsRef);

    console.log(
      `📊 getHotelsFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`
    );

    if (snapshot.empty) return [];

    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        name: (doc.data().name as string).toUpperCase(),
      } as Hotel))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}

/**
 * Get all activities from Firestore with caching.
 */
export async function getActivitiesFromFirestore(forceRefresh: boolean = false): Promise<Activity[]> {
  return fetchWithCache<Activity>('activities', async () => {
    if (!db) throw new Error('Firestore not initialized.');
    const activitiesRef = collection(db, 'activities');
    const snapshot = await getDocs(activitiesRef);

    console.log(
      `📊 getActivitiesFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`
    );

    if (snapshot.empty) return [];

    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        name: (doc.data().name as string).toUpperCase(),
        suggestedTime: doc.data().suggestedTime,
      } as Activity))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}

/**
 * Get all drivers from Firestore with caching.
 */
export async function getDriversFromFirestore(forceRefresh: boolean = false): Promise<Driver[]> {
  return fetchWithCache<Driver>('drivers', async () => {
    if (!db) throw new Error('Firestore not initialized.');
    const driversRef = collection(db, 'drivers');
    const snapshot = await getDocs(driversRef);

    console.log(
      `📊 getDriversFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`
    );

    if (snapshot.empty) return [];

    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        name: (doc.data().name as string).toUpperCase(),
      } as Driver))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}

/**
 * Get all flights from Firestore with caching.
 */
export async function getFlightsFromFirestore(forceRefresh: boolean = false): Promise<PredefinedFlight[]> {
  return fetchWithCache<PredefinedFlight>('flights', async () => {
    if (!db) throw new Error('Firestore not initialized.');
    const flightsRef = collection(db, 'flights');
    const snapshot = await getDocs(flightsRef);

    console.log(
      `📊 getFlightsFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`
    );

    if (snapshot.empty) return [];
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<PredefinedFlight, 'id'>),
      } as PredefinedFlight))
      .sort((a, b) => a.flightNumber.localeCompare(b.flightNumber));
  }, forceRefresh);
}

/**
 * Get all buses from Firestore with caching.
 */
export async function getBusesFromFirestore(forceRefresh: boolean = false): Promise<Bus[]> {
  return fetchWithCache<Bus>('buses', async () => {
    if (!db) throw new Error('Firestore not initialized.');
    const busesRef = collection(db, 'buses');
    const snapshot = await getDocs(busesRef);

    console.log(
      `📊 getBusesFromFirestore() - Read ${snapshot.size} documents (${snapshot.size} reads)`
    );

    if (snapshot.empty) return [];
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        name: (doc.data().name as string).toUpperCase(),
      } as Bus))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, forceRefresh);
}

// --- Existence Check Functions ---

import { query, where } from 'firebase/firestore';

/**
 * Generic function to check if a document with a specific field value exists.
 */
async function checkExists(collectionName: string, fieldName: string, value: string): Promise<boolean> {
  if (!db) return false;
  const q = query(collection(db, collectionName), where(fieldName, '==', value.toUpperCase()));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export const checkIfHotelExists = (name: string) => checkExists('hotels', 'name', name);
export const checkIfActivityExists = (name: string) => checkExists('activities', 'name', name);
export const checkIfDriverExists = (name: string) => checkExists('drivers', 'name', name);
export const checkIfFlightExists = (flightNumber: string) => checkExists('flights', 'flightNumber', flightNumber);

/**
 * Check if a bus exists by document ID.
 */
export async function checkIfBusExists(name: string): Promise<boolean> {
  if (!db) return false;
  const busDocRef = doc(db, 'buses', name.toUpperCase());
  const docSnap = await getDoc(busDocRef);
  return docSnap.exists();
}

/**
 * Check if a guide exists by firstName and lastName.
 */
export async function checkIfGuideExists(firstName: string, lastName: string): Promise<boolean> {
  if (!db) return false;
  const q = query(
    collection(db, 'guides'),
    where('firstName', '==', firstName.toUpperCase()),
    where('lastName', '==', lastName.toUpperCase())
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

// --- CRUD Operations (delegated to serviceOrderCRUD) ---
// Export all CRUD functions from serviceOrderCRUD
export {
  createGuide,
  updateGuide,
  deleteGuide,
  createHotel,
  updateHotel,
  deleteHotel,
  createActivity,
  updateActivity,
  deleteActivity,
  createDriver,
  updateDriver,
  deleteDriver,
  createFlight,
  updateFlight,
  deleteFlight,
  createBus,
  updateBus,
  deleteBus,
  createBulkGuides,
  createBulkHotels,
  createBulkActivities,
  createBulkDrivers,
  createBulkFlights,
  deleteBulkGuides,
  deleteBulkHotels,
  deleteBulkActivities,
  deleteBulkDrivers,
  deleteBulkFlights,
} from './serviceOrderCRUD';

// --- Cache Functions (delegated to serviceOrderCache) ---
export {
  getRemoteVersion,
  getLocalVersion,
  setLocalVersion,
  getCachedData,
  setCachedData,
  clearMasterDataCache,
  checkForMasterDataUpdates,
  initializeCacheVersion,
  fetchWithCache,
} from './serviceOrderCache';

// --- AI/Learning Functions ---

import { runTransaction } from 'firebase/firestore';

/**
 * Records the usage of a specific time for an activity.
 * If time is used >= 2 times, it becomes the suggested time.
 */
export async function recordActivityTimeUsage(activityName: string, time: string): Promise<void> {
  if (!db || !activityName || !/^\d{2}:\d{2}$/.test(time)) return;

  const activityQuery = query(
    collection(db, 'activities'),
    where('name', '==', activityName.toUpperCase())
  );
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

      const updates: { [key: string]: any } = {
        [`timeCounts.${time}`]: newCount,
      };

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
 * Get the suggested time for an activity.
 */
export async function getSuggestedTimeForActivity(activityName: string): Promise<string | null> {
  if (!db || !activityName) return null;

  const activityQuery = query(
    collection(db, 'activities'),
    where('name', '==', activityName.toUpperCase())
  );

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
