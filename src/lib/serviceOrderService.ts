
"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  limit,
} from 'firebase/firestore';

export interface Hotel {
  id: string; // Corresponds to Firestore document ID
  name: string;
}

export interface Activity {
  id: string; // Corresponds to Firestore document ID
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


// --- Firestore Initialization Functions ---

export async function initializeDefaultServiceOrderData(): Promise<void> {
  if (!db) throw new Error("Firestore not initialized.");
  
  // Initialize Hotels
  const hotelsRef = collection(db, 'hotels');
  const hotelsQuery = query(hotelsRef, limit(1));
  const hotelSnapshot = await getDocs(hotelsQuery);
  if (hotelSnapshot.empty) {
    console.log('No hotels found. Initializing default hotels...');
    const batch = writeBatch(db);
    defaultHotels.forEach(hotel => {
      const docRef = doc(hotelsRef);
      batch.set(docRef, hotel);
    });
    await batch.commit();
    console.log('Default hotels have been initialized.');
  }

  // Initialize Activities
  const activitiesRef = collection(db, 'activities');
  const activitiesQuery = query(activitiesRef, limit(1));
  const activitySnapshot = await getDocs(activitiesQuery);
  if (activitySnapshot.empty) {
    console.log('No activities found. Initializing default activities...');
    const batch = writeBatch(db);
    defaultActivities.forEach(activity => {
      const docRef = doc(activitiesRef);
      batch.set(docRef, activity);
    });
    await batch.commit();
    console.log('Default activities have been initialized.');
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
