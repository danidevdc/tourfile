
"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  limit,
  addDoc,
  deleteDoc,
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

export interface ServiceOrderGuide {
  uid: string;
  fullName: string;
  firstName: string;
}

// --- Default Data for Initialization (Now handled by admin UI) ---

// This function can be kept for potential future use, but the default data arrays are removed.
export async function initializeDefaultServiceOrderData(): Promise<void> {
  if (!db) throw new Error("Firestore not initialized.");
  
  // The collections are now managed via the admin UI.
  // This function will no longer auto-populate data to prevent confusion
  // and give the admin full control from a clean slate.
  console.log("Service order data is now managed manually via the Admin UI.");
  
  return Promise.resolve();
}

// --- Data Fetching Functions ---

export async function getGuidesFromUsers(): Promise<ServiceOrderGuide[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const usersRef = collection(db, 'userProfiles');
  const snapshot = await getDocs(usersRef);
  
  if (snapshot.empty) return [];

  return snapshot.docs.map(doc => {
    const data = doc.data();
    const firstName = data.firstName || data.email.split('@')[0] || 'Usuario';
    const lastName = data.lastName || '';
    return {
      uid: doc.id,
      firstName: firstName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`.trim()
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

export const createHotel = (name: string) => addDoc(collection(db!, 'hotels'), { name });
export const createActivity = (name: string) => addDoc(collection(db!, 'activities'), { name });
export const createDriver = (name: string) => addDoc(collection(db!, 'drivers'), { name });


// --- Data Deletion Functions ---

export const deleteHotel = (id: string) => deleteDoc(doc(db!, 'hotels', id));
export const deleteActivity = (id: string) => deleteDoc(doc(db!, 'activities', id));
export const deleteDriver = (id: string) => deleteDoc(doc(db!, 'drivers', id));
