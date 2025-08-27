
'use server';

import { db } from '@/lib/firebase';
import {
  doc,
  runTransaction,
  Timestamp,
  serverTimestamp,
  increment,
  getDoc
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
    console.error("[FATAL] Firestore not initialized. Cannot check API usage.");
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
      let monthCount = 0;

      if (usageDoc.exists()) {
        const data = usageDoc.data();
        const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();
        monthCount = data.monthCount || 0;
        
        // Only use the minuteCount if we are in the exact same minute of the same hour of the same day.
        if (lastUpdate && lastUpdate.getUTCDate() === currentDay && lastUpdate.getUTCHours() === currentHour && lastUpdate.getUTCMinutes() === currentMinute) {
          minuteCount = data.minuteCount || 0;
        }
      }
      
      // Check limits BEFORE incrementing
      if (minuteCount >= limits.perMinute || monthCount >= limits.perMonth) {
        return false; // Return false from transaction to indicate limit reached
      }

      // If we are here, it means we are allowed. Proceed with increment.
      const updatePayload: { [key: string]: any } = {
        lastUpdate: serverTimestamp(),
        monthCount: increment(1),
        apiName: apiName // Ensure apiName is always present
      };
      
      if(usageDoc.exists()) {
        const data = usageDoc.data();
        const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();

        const isNewDay = !lastUpdate || lastUpdate.getUTCDate() !== currentDay;
        const isNewHour = isNewDay || lastUpdate.getUTCHours() !== currentHour;
        const isNewMinute = isNewHour || lastUpdate.getUTCMinutes() !== currentMinute;

        updatePayload.dayCount = isNewDay ? 1 : increment(1);
        updatePayload.hourCount = isNewHour ? 1 : increment(1);
        updatePayload.minuteCount = isNewMinute ? 1 : increment(1);
        
        transaction.update(usageDocRef, updatePayload);
      } else {
        // If the document doesn't exist, it's the first call for the month.
        updatePayload.createdAt = serverTimestamp();
        updatePayload.monthCount = 1;
        updatePayload.dayCount = 1;
        updatePayload.hourCount = 1;
        updatePayload.minuteCount = 1;
        transaction.set(usageDocRef, updatePayload);
      }
      
      return true; // Return true from transaction to indicate success
    });

    return { allowed };

  } catch (error) {
    console.error(`[FATAL] Error in checkAndIncrementApiUsage transaction for ${apiName}:`, error);
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
    console.error("[FATAL] Firestore not initialized.");
    return { minute: 0, hour: 0, day: 0, month: 0 };
  }

  const docId = getUsageDocumentId(apiName);
  const usageDocRef = doc(db, 'apiUsageCounters', docId);

  try {
    const docSnap = await getDoc(usageDocRef);
    if (!docSnap.exists()) {
      return { minute: 0, hour: 0, day: 0, month: 0 };
    }
    const data = docSnap.data();
    
     const now = new Date();
     const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();
     
     // Check if the last update was in the same time window as now (all UTC)
     const isSameMinute = lastUpdate && now.getUTCMinutes() === lastUpdate.getUTCMinutes() && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate() && now.getUTCFullYear() === lastUpdate.getUTCFullYear();
     const isSameHour = lastUpdate && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate() && now.getUTCFullYear() === lastUpdate.getUTCFullYear();
     const isSameDay = lastUpdate && now.getUTCDate() === lastUpdate.getUTCDate() && now.getUTCFullYear() === lastUpdate.getUTCFullYear();
     
    return {
      minute: isSameMinute ? data.minuteCount || 0 : 0,
      hour: isSameHour ? data.hourCount || 0 : 0,
      day: isSameDay ? data.dayCount || 0 : 0,
      month: data.monthCount || 0,
    };
  } catch (error) {
    console.error("[ERROR] Error fetching API usage stats:", error);
    return { minute: 0, hour: 0, day: 0, month: 0 };
  }
}
