
"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

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

// --- Default Data for Initialization ---
export async function initializeDefaultServiceOrderData(): Promise<void> {
  if (!db) throw new Error("Firestore not initialized.");
  // Data is now managed manually via the Admin UI. This function is kept for potential future use.
  return Promise.resolve();
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
