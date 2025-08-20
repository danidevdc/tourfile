
"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  setDoc,
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
  console.log("Service order data is now managed manually via the Admin UI.");
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
    return {
      uid: doc.id,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`.trim()
    };
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getHotelsFromFirestore(): Promise<Hotel[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const hotelsRef = collection(db, 'hotels');
  const snapshot = await getDocs(hotelsRef);

  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hotel))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActivitiesFromFirestore(): Promise<Activity[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const activitiesRef = collection(db, 'activities');
  const snapshot = await getDocs(activitiesRef);

  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDriversFromFirestore(): Promise<Driver[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const driversRef = collection(db, 'drivers');
  const snapshot = await getDocs(driversRef);

  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver))
    .sort((a, b) => a.name.localeCompare(b.name));
}


// --- Data Creation Functions ---

export const createGuide = (guide: {firstName: string, lastName: string}) => addDoc(collection(db!, 'guides'), guide);
export const createHotel = (name: string) => addDoc(collection(db!, 'hotels'), { name });
export const createActivity = (name: string) => addDoc(collection(db!, 'activities'), { name });
export const createDriver = (name: string) => addDoc(collection(db!, 'drivers'), { name });


// --- Data Deletion Functions ---

export const deleteGuide = (id: string) => deleteDoc(doc(db!, 'guides', id));
export const deleteHotel = (id: string) => deleteDoc(doc(db!, 'hotels', id));
export const deleteActivity = (id: string) => deleteDoc(doc(db!, 'activities', id));
export const deleteDriver = (id: string) => deleteDoc(doc(db!, 'drivers', id));
