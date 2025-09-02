
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
} from 'firebase/firestore';
// import { getFlightFromFirestore } from './flightSyncService'; // This file was removed.
import { format, parse } from 'date-fns';

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
    name: (doc.data().name as string).toUpperCase(),
    suggestedTime: doc.data().suggestedTime, // Also fetch the suggested time
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

export async function getFlightsFromFirestore(): Promise<PredefinedFlight[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const flightsRef = collection(db, 'flights');
  const snapshot = await getDocs(flightsRef);
  if (snapshot.empty) return [];
  return snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...(doc.data() as Omit<PredefinedFlight, 'id'>)
  } as PredefinedFlight)).sort((a, b) => a.flightNumber.localeCompare(b.flightNumber));
}

// --- Data Creation Functions (Single) ---

export const createGuide = (guide: {firstName: string, lastName: string}) => addDoc(collection(db!, 'guides'), guide);
export const createHotel = (name: string) => addDoc(collection(db!, 'hotels'), { name });
export const createActivity = (name: string) => addDoc(collection(db!, 'activities'), { name });
export const createDriver = (name: string) => addDoc(collection(db!, 'drivers'), { name });
export const createFlight = (flight: Omit<PredefinedFlight, 'id'>) => addDoc(collection(db!, 'flights'), flight);

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
export const createBulkFlights = (flights: Omit<PredefinedFlight, 'id'>[]) => createBulk('flights', flights);


// --- Data Deletion Functions ---

export const deleteGuide = (id: string) => deleteDoc(doc(db!, 'guides', id));
export const deleteHotel = (id: string) => deleteDoc(doc(db!, 'hotels', id));
export const deleteActivity = (id: string) => deleteDoc(doc(db!, 'activities', id));
export const deleteDriver = (id: string) => deleteDoc(doc(db!, 'drivers', id));
export const deleteFlight = (id: string) => deleteDoc(doc(db!, 'flights', id));


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
