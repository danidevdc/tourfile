import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { logger } from './logger';

// Ensure environment variables are being loaded. You might need to restart your dev server
// if you've recently created or modified the .env.local file.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

let app: FirebaseApp | undefined = undefined;
let db: Firestore | undefined = undefined;
let auth: Auth | undefined = undefined; // Declare auth

// Check if all critical Firebase config keys are present
const requiredConfigKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  throw new Error(`Firebase initialization failed: Missing config values for ${missingKeys.join(', ')}. Please check your .env.local file and ensure all NEXT_PUBLIC_FIREBASE_ variables are set.`);
} else {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      logger.debug("Firebase app initialized successfully.");
    } catch (error: any) {
      throw new Error(`Firebase app initialization error: ${error.message}`);
    }
  } else {
    app = getApps()[0];
    logger.debug("Firebase app already initialized.");
  }

  if (app) { // Only try to get Firestore and Auth if app was successfully initialized/obtained
    try {
      db = getFirestore(app);
      logger.debug("Firestore instance obtained successfully.");
    } catch (error: any) {
      logger.error("Firestore instance initialization error:", error.message, error.code);
    }
    try {
      auth = getAuth(app); // Initialize Auth
      // Set persistence to local browser storage.
      setPersistence(auth, browserLocalPersistence)
        .then(() => {
          logger.debug("Firebase Auth persistence set to local browser storage.");
        })
        .catch((error) => {
          logger.error("Error setting Firebase Auth persistence:", error);
        });
      logger.debug("Firebase Auth instance obtained successfully.");
    } catch (error: any) {
      logger.error("Firebase Auth instance initialization error:", error.message, error.code);
    }
  } else {
    logger.error("Firebase app is not available, Firestore and Auth instances cannot be obtained. This usually means the Firebase config in .env.local is missing or incorrect.");
  }
}

export { db, auth, app }; // Export auth

