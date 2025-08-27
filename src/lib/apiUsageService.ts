
'use server';

import { db } from '@/lib/firebase';
import {
  doc,
  runTransaction,
  Timestamp,
  serverTimestamp,
  increment
} from 'firebase/firestore';

const API_LIMITS = {
  AeroAPI: {
    perMinute: 5,
    perMonth: 500,
  },
};

type ApiName = keyof typeof API_LIMITS;

export interface ApiUsageStats {
  minute: number;
  hour: number;
  day: number;
  month: number;
  total: number;
}

function getUsageDocumentId(apiName: ApiName): string {
    const now = new Date();
    // Creates a new document for each month to keep documents small and performant.
    return `${apiName}_${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Atomically increments the API usage counters and checks against limits.
 * @param apiName The name of the API being used.
 * @returns A promise resolving to { allowed: boolean }.
 */
export async function checkAndIncrementApiUsage(apiName: ApiName): Promise<{ allowed: boolean }> {
  if (!db) {
    console.error("Firestore not initialized. Cannot check API usage.");
    return { allowed: false };
  }

  const limits = API_LIMITS[apiName];
  const docId = getUsageDocumentId(apiName);
  const usageDocRef = doc(db, 'apiUsageCounters', docId);

  try {
    const allowed = await runTransaction(db, async (transaction) => {
      const usageDoc = await transaction.get(usageDocRef);

      const now = new Date();
      const currentMinute = now.getUTCMinutes();
      const currentHour = now.getUTCHours();
      const currentDay = now.getUTCDate();

      let minuteCount = 0;
      let isNewMinute = true;
      let isNewHour = true;
      let isNewDay = true;

      if (usageDoc.exists()) {
        const data = usageDoc.data();
        const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();
        
        if (lastUpdate) {
            isNewDay = lastUpdate.getUTCDate() !== currentDay;
            isNewHour = isNewDay || lastUpdate.getUTCHours() !== currentHour;
            isNewMinute = isNewHour || lastUpdate.getUTCMinutes() !== currentMinute;
        }
        
        minuteCount = isNewMinute ? 0 : (data.minuteCount || 0);
      }
      
      // Check if limit is exceeded BEFORE incrementing
      if (minuteCount >= limits.perMinute) {
        console.warn(`${apiName} rate limit would be exceeded. Current count: ${minuteCount}`);
        return false; // Return false from transaction to indicate limit reached
      }

      // If we are here, it means we are allowed. Proceed with increment.
      const updatePayload = {
        lastUpdate: serverTimestamp(),
        minuteCount: increment(1),
        hourCount: isNewHour ? 1 : increment(1),
        dayCount: isNewDay ? 1 : increment(1),
        monthCount: increment(1),
        totalCount: increment(1),
        // Reset counters if it's a new time window
        ...(isNewMinute && { minuteCount: 1 }),
        ...(isNewHour && { hourCount: 1 }),
        ...(isNewDay && { dayCount: 1 }),
        ...(usageDoc.exists() === false && {
            apiName: apiName,
            createdAt: serverTimestamp(),
            monthCount: 1,
            totalCount: 1
        })
      };
      
      if (usageDoc.exists()) {
        transaction.update(usageDocRef, updatePayload);
      } else {
        transaction.set(usageDocRef, updatePayload);
      }
      
      return true; // Return true from transaction to indicate success
    });

    return { allowed };

  } catch (error) {
    console.error(`Error in checkAndIncrementApiUsage transaction for ${apiName}:`, error);
    return { allowed: false }; // Fail closed on error
  }
}

/**
 * Retrieves the current API usage stats from the counter document.
 * @param apiName The name of the API.
 * @returns The current usage stats.
 */
export async function getApiUsageStats(apiName: ApiName): Promise<ApiUsageStats> {
  if (!db) {
    console.error("Firestore not initialized.");
    return { minute: 0, hour: 0, day: 0, month: 0, total: 0 };
  }

  const docId = getUsageDocumentId(apiName);
  const usageDocRef = doc(db, 'apiUsageCounters', docId);

  try {
    const docSnap = await getDoc(usageDocRef);
    if (!docSnap.exists()) {
      return { minute: 0, hour: 0, day: 0, month: 0, total: 0 };
    }
    const data = docSnap.data();

     const now = new Date();
     const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();
     const isSameMinute = lastUpdate && now.getUTCMinutes() === lastUpdate.getUTCMinutes() && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate();
     const isSameHour = lastUpdate && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate();
     const isSameDay = lastUpdate && now.getUTCDate() === lastUpdate.getUTCDate();
     

    return {
      minute: isSameMinute ? data.minuteCount || 0 : 0,
      hour: isSameHour ? data.hourCount || 0 : 0,
      day: isSameDay ? data.dayCount || 0 : 0,
      month: data.monthCount || 0,
      total: data.totalCount || 0
    };
  } catch (error) {
    console.error("Error fetching API usage stats:", error);
    return { minute: 0, hour: 0, day: 0, month: 0, total: 0 };
  }
}
