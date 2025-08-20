
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

// --- Default Data for Initialization ---

const defaultHotels: Omit<Hotel, 'id'>[] = [
  { name: "HOTEL ROSARIO" },
  { name: "CASA DE PIEDRA" },
  { name: "STANNUN" },
  { name: "HOTEL MITRU" },
  { name: "QANTU" },
];

const defaultActivities: Omit<Activity, 'id'>[] = [
    { name: "Recojo del Hotel" },
    { name: "City Tour La Paz" },
    { name: "Almuerzo en restaurante típico" },
    { name: "Visita al Valle de la Luna" },
    { name: "Retorno al Hotel" },
    { name: "Traslado al aeropuerto" },
    { name: "Cena Show" },
];

const defaultDrivers: Omit<Driver, 'id'>[] = [
    { name: "8" },
    { name: "9" },
    { name: "10" },
    { name: "CONT Juan Perez" },
];

// --- Firestore Initialization Function ---

export async function initializeDefaultServiceOrderData(): Promise<void> {
  if (!db) throw new Error("Firestore not initialized.");
  
  const collectionsToInit = [
    { ref: collection(db, 'hotels'), data: defaultHotels, name: 'hotels' },
    { ref: collection(db, 'activities'), data: defaultActivities, name: 'activities' },
    { ref: collection(db, 'drivers'), data: defaultDrivers, name: 'drivers' }
  ];

  const batch = writeBatch(db);
  let batchHasWrites = false;

  for (const { ref, data, name } of collectionsToInit) {
    const q = query(ref, limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log(`No ${name} found. Initializing default ${name}...`);
      data.forEach(item => {
        const docRef = doc(ref);
        batch.set(docRef, item);
      });
      batchHasWrites = true;
    }
  }

  if (batchHasWrites) {
    await batch.commit();
    console.log('Default service order data has been initialized.');
  }
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
