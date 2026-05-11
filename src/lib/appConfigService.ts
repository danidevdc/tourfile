
"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { AppModule } from '@/hooks/useAuth';
import type { FlightSearchProvider } from '@/ai/flows/flight-types';

const CONFIG_COLLECTION = 'appConfig';
const SPECIAL_ROLES_DOC_ID = 'specialRoles';
const EDITORS_LIST_KEY = 'allowedEditors';
const FLIGHT_SEARCH_SETTINGS_DOC_ID = 'flightSearchSettings';

export interface FlightSearchSettings {
  provider: FlightSearchProvider;
}

const DEFAULT_FLIGHT_SEARCH_SETTINGS: FlightSearchSettings = {
  provider: 'aeroapi',
};

/**
 * Sets the email for the intermediate user role in Firestore.
 * @param email The email address to set. Can be an empty string to remove the role.
 */
export async function setIntermediateUserEmail(emails: string[]): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized.");

  const configDocRef = doc(db, CONFIG_COLLECTION, SPECIAL_ROLES_DOC_ID);

  try {
    // Save as an array of lowercase emails
    const cleanEmails = emails.map(e => e.trim().toLowerCase()).filter(Boolean);
    await setDoc(configDocRef, {
      [EDITORS_LIST_KEY]: cleanEmails
    }, { merge: true });
  } catch (error) {
    console.error("Error setting allowed editors:", error);
    throw new Error("Failed to update special roles in database.");
  }
}

/**
 * Retrieves the email of the user with the intermediate role.
 * @returns The email address as a string, or null if it's not set or an error occurs.
 */
export async function getIntermediateUserEmails(): Promise<string[]> {
  if (!db) {
    console.error("Firestore is not initialized.");
    return [];
  }

  const configDocRef = doc(db, CONFIG_COLLECTION, SPECIAL_ROLES_DOC_ID);

  try {
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Support both new list and old single field for backward compatibility
      const list = data[EDITORS_LIST_KEY] || [];
      const oldSingle = data.intermediateUserEmail ? [data.intermediateUserEmail] : [];

      const combined = new Set([...list, ...oldSingle]);
      return Array.from(combined);
    }
    return [];
  } catch (error) {
    console.warn("Silent error getting special roles (likely permission/session):", error);
    return [];
  }
}

export async function setUserModules(uid: string, modules: AppModule[]): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized.");
  await updateDoc(doc(db, 'userProfiles', uid), { modules });
}

export async function getUserModules(uid: string): Promise<AppModule[]> {
  if (!db) return [];
  try {
    const snap = await getDoc(doc(db, 'userProfiles', uid));
    if (snap.exists()) return (snap.data().modules as AppModule[]) || [];
    return [];
  } catch {
    return [];
  }
}

export async function getFlightSearchSettings(): Promise<FlightSearchSettings> {
  if (!db) return DEFAULT_FLIGHT_SEARCH_SETTINGS;

  try {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, FLIGHT_SEARCH_SETTINGS_DOC_ID));
    if (!snap.exists()) return DEFAULT_FLIGHT_SEARCH_SETTINGS;

    const provider = snap.data().provider;
    return provider === 'airlabs' || provider === 'aeroapi'
      ? { provider }
      : DEFAULT_FLIGHT_SEARCH_SETTINGS;
  } catch (error) {
    console.warn("Silent error getting flight search settings:", error);
    return DEFAULT_FLIGHT_SEARCH_SETTINGS;
  }
}

export async function setFlightSearchProvider(provider: FlightSearchProvider): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized.");
  if (provider !== 'aeroapi' && provider !== 'airlabs') {
    throw new Error("Invalid flight search provider.");
  }

  await setDoc(doc(db, CONFIG_COLLECTION, FLIGHT_SEARCH_SETTINGS_DOC_ID), {
    provider,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}
