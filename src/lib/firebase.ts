
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

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

// Check if all critical Firebase config keys are present
const requiredConfigKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  console.error(`Firebase initialization failed: Missing config values for ${missingKeys.join(', ')}. Please check your .env.local file and ensure all NEXT_PUBLIC_FIREBASE_ variables are set.`);
  // If critical keys are missing, app and db will remain undefined.
} else {
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
      console.log("Firebase app initialized successfully.");
    } catch (error: any) {
      console.error("Firebase app initialization error:", error.message, error.code);
      // app will remain undefined if initialization fails
    }
  } else {
    app = getApps()[0];
    console.log("Firebase app already initialized.");
  }

  if (app) { // Only try to get Firestore if app was successfully initialized/obtained
    try {
      db = getFirestore(app);
      console.log("Firestore instance obtained successfully.");
      // --- IMPORTANT ---
      // If you see "Missing or insufficient permissions" errors in your app,
      // it's very likely due to your Firestore Security Rules.
      // You need to configure them in the Firebase Console:
      // Firestore Database > Rules tab.
      // For development, you might use open rules like:
      //
      // rules_version = '2';
      // service cloud.firestore {
      //   match /databases/{database}/documents {
      //     match /{document=**} { // Or be more specific, e.g., match /users/{userId}
      //       allow read, write: if true;
      //     }
      //   }
      // }
      //
      // WARNING: Such open rules are insecure for production.
      // Define proper security rules before deploying your app.
      // --- END IMPORTANT ---
    } catch (error: any) {
      console.error("Firestore instance initialization error:", error.message, error.code);
      // db will remain undefined if Firestore initialization fails
    }
  } else {
    console.error("Firebase app is not available, Firestore instance cannot be obtained. This usually means the Firebase config in .env.local is missing or incorrect.");
  }
}

export { db, app };
