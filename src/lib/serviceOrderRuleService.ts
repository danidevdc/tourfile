
"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  limit,
} from 'firebase/firestore';

export interface ServiceOrderRule {
  id: string; // Firestore document ID
  keyword: string; // Keyword to search for in Excel
  activity: string; // Activity name from the 'activities' collection
  isActive: boolean;
  order: number; // For sorting purposes
}

const defaultServiceOrderRules: Omit<ServiceOrderRule, 'id'>[] = [
    { keyword: 'CITY TOUR', activity: 'CITY TOUR LA PAZ', isActive: true, order: 10 },
    { keyword: 'TIWANAKU', activity: 'FD TIWANAKU', isActive: true, order: 20 },
    { keyword: 'COPACABANA', activity: 'FD COPACABANA', isActive: true, order: 30 },
    { keyword: 'CHACALTAYA', activity: 'HD CHACALTAYA', isActive: true, order: 40 },
    { keyword: 'VALLE DE LA LUNA', activity: 'HD VALLE DE LA LUNA', isActive: true, order: 50 },
    { keyword: 'TRANSFER IN', activity: 'TRF IN', isActive: true, order: 1 },
    { keyword: 'TRANSFER OUT', activity: 'TRF OUT', isActive: true, order: 2 },
];


export async function initializeDefaultServiceOrderRules(): Promise<void> {
    if (!db) throw new Error("Firestore not initialized.");
    const rulesRef = collection(db, 'serviceOrderRules');
    const q = query(rulesRef, limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log('No default service order rules found. Initializing...');
        const batch = writeBatch(db);
        defaultServiceOrderRules.forEach(ruleData => {
            const docRef = doc(rulesRef);
            batch.set(docRef, ruleData);
        });
        await batch.commit();
        console.log('Default service order rules have been initialized in Firestore.');
    }
}


export async function getServiceOrderRules(): Promise<ServiceOrderRule[]> {
  if (!db) throw new Error("Firestore not initialized");
  const rulesRef = collection(db, 'serviceOrderRules');
  const q = query(rulesRef);
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceOrderRule));
}

export async function saveServiceOrderRules(rules: ServiceOrderRule[]): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const batch = writeBatch(db);
  const rulesRef = collection(db, 'serviceOrderRules');

  rules.forEach(rule => {
    const docRef = rule.id.startsWith('new_') ? doc(rulesRef) : doc(rulesRef, rule.id);
    const { id, ...dataToSave } = rule; 
    batch.set(docRef, dataToSave);
  });

  await batch.commit();
}

export async function deleteServiceOrderRule(ruleId: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  if (!ruleId || ruleId.startsWith('new_')) throw new Error("Invalid ID for deletion.");
  
  const ruleDocRef = doc(db, 'serviceOrderRules', ruleId);
  await deleteDoc(ruleDocRef);
}
