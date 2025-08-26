
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
} from 'firebase/firestore';
import { getFlightFromFirestore } from './flightSyncService';
import { format } from 'date-fns';

// --- Interface Definitions ---

export interface Hotel {
  id: string; 
  name: string;
}

export interface Activity {
  id: string; 
  name: string;
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

export interface ServiceOrderGuide extends Guide {
  fullName: string;
}

export interface ServiceItem {
  fecha: string;
  hora: string;
  servicio: string;
  vuelo?: string;
  guia?: string;
  bus?: string;
  chofer?: string;
  observaciones?: string;
}

// --- Data Fetching Functions ---

export async function getGuidesFromFirestore(): Promise<ServiceOrderGuide[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const guidesRef = collection(db, 'guides');
  const snapshot = await getDocs(guidesRef);
  
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
}

export async function getHotelsFromFirestore(): Promise<Hotel[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const hotelsRef = collection(db, 'hotels');
  const snapshot = await getDocs(hotelsRef);

  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    name: (doc.data().name as string).toUpperCase() 
  } as Hotel))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActivitiesFromFirestore(): Promise<Activity[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const activitiesRef = collection(db, 'activities');
  const snapshot = await getDocs(activitiesRef);

  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    name: (doc.data().name as string).toUpperCase() 
  } as Activity))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDriversFromFirestore(): Promise<Driver[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const driversRef = collection(db, 'drivers');
  const snapshot = await getDocs(driversRef);

  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    name: (doc.data().name as string).toUpperCase() 
  } as Driver))
    .sort((a, b) => a.name.localeCompare(b.name));
}


// --- Data Creation Functions (Single) ---

export const createGuide = (guide: {firstName: string, lastName: string}) => addDoc(collection(db!, 'guides'), guide);
export const createHotel = (name: string) => addDoc(collection(db!, 'hotels'), { name });
export const createActivity = (name: string) => addDoc(collection(db!, 'activities'), { name });
export const createDriver = (name: string) => addDoc(collection(db!, 'drivers'), { name });

// --- Data Creation Functions (Bulk) ---
const createBulk = async (collectionName: string, records: { [key: string]: any }[]) => {
  if (!db) throw new Error("Firestore not initialized");
  const batch = writeBatch(db);
  const collectionRef = collection(db, collectionName);
  records.forEach(record => {
    const docRef = doc(collectionRef);
    batch.set(docRef, record);
  });
  await batch.commit();
};

export const createBulkGuides = (guides: {firstName: string, lastName: string}[]) => createBulk('guides', guides);
export const createBulkHotels = (hotels: {name: string}[]) => createBulk('hotels', hotels);
export const createBulkActivities = (activities: {name: string}[]) => createBulk('activities', activities);
export const createBulkDrivers = (drivers: {name: string}[]) => createBulk('drivers', drivers);


// --- Data Deletion Functions ---

export const deleteGuide = (id: string) => deleteDoc(doc(db!, 'guides', id));
export const deleteHotel = (id: string) => deleteDoc(doc(db!, 'hotels', id));
export const deleteActivity = (id: string) => deleteDoc(doc(db!, 'activities', id));
export const deleteDriver = (id: string) => deleteDoc(doc(db!, 'drivers', id));


// --- AI/Learning Functions ---

/**
 * Records the usage of a specific time for an activity to build suggestions.
 * @param activityName The name of the activity.
 * @param time The time used for the activity (e.g., "09:00").
 */
export async function recordActivityTimeUsage(activityName: string, time: string): Promise<void> {
  if (!db || !activityName || !/^\d{2}:\d{2}$/.test(time)) return;

  const suggestionRef = doc(db, 'activityTimeSuggestions', activityName.toUpperCase());

  try {
    await runTransaction(db, async (transaction) => {
      const suggestionDoc = await transaction.get(suggestionRef);
      if (!suggestionDoc.exists()) {
        transaction.set(suggestionRef, {
          activityName: activityName.toUpperCase(),
          timeCounts: { [time]: 1 },
        });
      } else {
        const currentCounts = suggestionDoc.data().timeCounts || {};
        const newCount = (currentCounts[time] || 0) + 1;
        transaction.update(suggestionRef, {
          [`timeCounts.${time}`]: newCount,
        });
      }
    });
  } catch (error) {
    console.error(`Failed to record time usage for ${activityName}:`, error);
    // Fail silently to not interrupt user flow
  }
}

/**
 * Gets the most frequently used time for a given activity.
 * @param activityName The name of the activity.
 * @returns The most popular time as a string (e.g., "09:00") or null if no data exists.
 */
export async function getSuggestedTimeForActivity(activityName: string): Promise<string | null> {
  if (!db || !activityName) return null;

  const suggestionRef = doc(db, 'activityTimeSuggestions', activityName.toUpperCase());
  try {
    const suggestionDoc = await getDoc(suggestionRef);
    if (suggestionDoc.exists()) {
      const data = suggestionDoc.data();
      const timeCounts = data.timeCounts;
      if (timeCounts && Object.keys(timeCounts).length > 0) {
        // Find the time with the highest count
        const mostPopularTime = Object.keys(timeCounts).reduce((a, b) =>
          timeCounts[a] > timeCounts[b] ? a : b
        );
        return mostPopularTime;
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to get suggested time for ${activityName}:`, error);
    return null;
  }
}

/**
 * Searches for a flight in the local Firestore database and returns a formatted ServiceItem.
 * @param flightNumber The flight number to search.
 * @param serviceDate The date of the service in dd/MM/yy format.
 * @param transferType 'TRF IN' or 'TRF OUT'.
 * @returns A promise that resolves to a partial ServiceItem with flight details.
 */
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
