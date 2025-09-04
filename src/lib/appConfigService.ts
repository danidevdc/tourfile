
"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CONFIG_COLLECTION = 'appConfig';
const SPECIAL_ROLES_DOC_ID = 'specialRoles';

/**
 * Sets the email for the intermediate user role in Firestore.
 * @param email The email address to set. Can be an empty string to remove the role.
 */
export async function setIntermediateUserEmail(email: string): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized.");
  
  const configDocRef = doc(db, CONFIG_COLLECTION, SPECIAL_ROLES_DOC_ID);
  
  try {
    // setDoc with merge: true will create the document if it doesn't exist,
    // or update it if it does, without overwriting other fields.
    await setDoc(configDocRef, { 
      intermediateUserEmail: email 
    }, { merge: true });
  } catch (error) {
    console.error("Error setting intermediate user email:", error);
    throw new Error("Failed to update special role in database.");
  }
}

/**
 * Retrieves the email of the user with the intermediate role.
 * @returns The email address as a string, or null if it's not set or an error occurs.
 */
export async function getIntermediateUserEmail(): Promise<string | null> {
  if (!db) {
    console.error("Firestore is not initialized.");
    return null;
  }

  const configDocRef = doc(db, CONFIG_COLLECTION, SPECIAL_ROLES_DOC_ID);

  try {
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists()) {
      return docSnap.data().intermediateUserEmail || null;
    } else {
      // Document doesn't exist, so no email is set
      return null;
    }
  } catch (error) {
    console.error("Error getting intermediate user email:", error);
    // Return null to ensure the app doesn't break if Firestore fails
    return null; 
  }
}
