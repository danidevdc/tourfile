
'use client';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getCountFromServer,
} from 'firebase/firestore';

const API_LIMITS = {
  AeroAPI: {
    requests: 5,
    perMinutes: 1,
  },
};

type ApiName = keyof typeof API_LIMITS;

export interface ApiUsageStats {
  lastMinute: number;
  lastHour: number;
  last24Hours: number;
}

/**
 * Checks if an API call is allowed based on usage limits.
 * If allowed, it logs the request.
 * @param apiName The name of the API to check ('AeroAPI').
 * @returns A promise that resolves to an object { allowed: boolean }.
 */
export async function checkApiLimit(apiName: ApiName): Promise<{ allowed: boolean }> {
  if (!db) {
    console.error("Firestore not initialized. Cannot check API limit.");
    // Fail open or closed? Failing closed is safer.
    return { allowed: false };
  }

  const limits = API_LIMITS[apiName];
  const usageRef = collection(db, 'apiUsage');
  
  // Calculate the timestamp for the start of the rate limit window
  const now = new Date();
  const windowStart = new Date(now.getTime() - limits.perMinutes * 60 * 1000);

  // Query for requests made within the last minute
  const q = query(
    usageRef,
    where('apiName', '==', apiName),
    where('timestamp', '>=', windowStart)
  );

  try {
    const snapshot = await getCountFromServer(q);
    const count = snapshot.data().count;
    
    if (count >= limits.requests) {
      console.warn(`${apiName} rate limit exceeded. Found ${count} requests in the last ${limits.perMinutes} minute(s).`);
      return { allowed: false };
    }

    // If allowed, log the new request
    await addDoc(usageRef, {
      apiName: apiName,
      timestamp: serverTimestamp(),
    });

    return { allowed: true };
  } catch (error) {
    console.error(`Error checking API rate limit for ${apiName}:`, error);
    // If there's an error checking, fail closed to be safe
    return { allowed: false };
  }
}

/**
 * Retrieves API usage statistics for display on the admin dashboard.
 * @param apiName The name of the API to get stats for.
 * @returns A promise that resolves to an ApiUsageStats object.
 */
export async function getApiUsageStats(apiName: ApiName): Promise<ApiUsageStats> {
    if (!db) {
        console.error("Firestore not initialized. Cannot get API usage stats.");
        return { lastMinute: 0, lastHour: 0, last24Hours: 0 };
    }

    const usageRef = collection(db, 'apiUsage');
    const now = Date.now();

    const oneMinuteAgo = Timestamp.fromMillis(now - 60 * 1000);
    const oneHourAgo = Timestamp.fromMillis(now - 60 * 60 * 1000);
    const twentyFourHoursAgo = Timestamp.fromMillis(now - 24 * 60 * 60 * 1000);

    const qMinute = query(usageRef, where('apiName', '==', apiName), where('timestamp', '>=', oneMinuteAgo));
    const qHour = query(usageRef, where('apiName', '==', apiName), where('timestamp', '>=', oneHourAgo));
    const q24Hours = query(usageRef, where('apiName', '==', apiName), where('timestamp', '>=', twentyFourHoursAgo));

    try {
        const [minuteSnap, hourSnap, daySnap] = await Promise.all([
            getCountFromServer(qMinute),
            getCountFromServer(qHour),
            getCountFromServer(q24Hours)
        ]);

        return {
            lastMinute: minuteSnap.data().count,
            lastHour: hourSnap.data().count,
            last24Hours: daySnap.data().count
        };
    } catch (error) {
        console.error(`Error getting API usage stats for ${apiName}:`, error);
        return { lastMinute: 0, lastHour: 0, last24Hours: 0 };
    }
}
