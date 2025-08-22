
"use client";

import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface Activity {
  id: string; 
  name: string;
  defaultTime?: string; // e.g., "09:00"
}

export async function getActivitiesFromFirestore(): Promise<Activity[]> {
  if (!db) throw new Error("Firestore not initialized.");
  const activitiesRef = collection(db, 'activities');
  const snapshot = await getDocs(activitiesRef);

  if (snapshot.empty) return [];

  // Default times can be defined here or fetched from Firestore if added to the data model
  const defaultTimes: { [key: string]: string } = {
    "TRANSFER IN": "08:30",
    "TRANSFER OUT": "08:30",
    "CITY TOUR": "09:00",
    "VALLE DE LA LUNA": "14:00",
  };

  return snapshot.docs.map(doc => {
    const data = doc.data();
    const name = (data.name as string).toUpperCase();
    return { 
      id: doc.id, 
      name: name,
      // Assign a default time if one is defined for this activity, otherwise fallback
      defaultTime: defaultTimes[name] || '09:00' 
    } as Activity
  }).sort((a, b) => a.name.localeCompare(b.name));
}
