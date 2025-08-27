
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
    console.error("[FATAL] Firestore not initialized. Cannot check API usage.");
    return { allowed: false };
  }
  console.log(`--- [START] checkAndIncrementApiUsage for ${apiName} ---`);

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
      
      console.log(`[DEBUG] Current Time (UTC): Day=${currentDay}, Hour=${currentHour}, Minute=${currentMinute}`);

      let minuteCount = 0;
      let isNewMinute = true;
      let isNewHour = true;
      let isNewDay = true;

      if (usageDoc.exists()) {
        const data = usageDoc.data();
        const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();
        
        if (lastUpdate) {
            console.log(`[DEBUG] Last update was at (UTC): Day=${lastUpdate.getUTCDate()}, Hour=${lastUpdate.getUTCHours()}, Minute=${lastUpdate.getUTCMinutes()}`);
            isNewDay = lastUpdate.getUTCDate() !== currentDay;
            isNewHour = isNewDay || lastUpdate.getUTCHours() !== currentHour;
            isNewMinute = isNewHour || lastUpdate.getUTCMinutes() !== currentMinute;
        }
        
        minuteCount = isNewMinute ? 0 : (data.minuteCount || 0);
        console.log(`[DEBUG] isNewMinute: ${isNewMinute}. Current minuteCount before check: ${minuteCount}`);
      } else {
        console.log('[DEBUG] No existing usage document found. This is the first call for this month.');
      }
      
      // Check if limit is exceeded BEFORE incrementing
      if (minuteCount >= limits.perMinute) {
        console.warn(`[LIMIT] ${apiName} rate limit would be exceeded. Count (${minuteCount}) >= Limit (${limits.perMinute}). Blocking call.`);
        return false; // Return false from transaction to indicate limit reached
      }
      console.log(`[DEBUG] Limit check passed. Count (${minuteCount}) < Limit (${limits.perMinute}).`);

      // If we are here, it means we are allowed. Proceed with increment.
      const updatePayload: { [key: string]: any } = {
        lastUpdate: serverTimestamp(),
        minuteCount: increment(1),
        monthCount: increment(1), // Always increment monthly and total
        totalCount: increment(1),
      };

      if(isNewDay) {
        console.log('[DEBUG] It is a new day. Resetting day, hour, and minute counts.');
        updatePayload.dayCount = 1;
        updatePayload.hourCount = 1;
        updatePayload.minuteCount = 1;
      } else if (isNewHour) {
         console.log('[DEBUG] It is a new hour. Resetting hour and minute counts.');
        updatePayload.hourCount = 1;
        updatePayload.minuteCount = 1;
      } else if (isNewMinute) {
         console.log('[DEBUG] It is a new minute. Resetting minute count.');
        updatePayload.minuteCount = 1;
      } else {
        // Not a new minute, hour, or day, so just increment existing counts
        console.log('[DEBUG] Same minute. Incrementing existing counts.');
        updatePayload.dayCount = increment(1);
        updatePayload.hourCount = increment(1);
      }
      
      if (usageDoc.exists()) {
        console.log('[DEBUG] Updating existing document with payload:', updatePayload);
        transaction.update(usageDocRef, updatePayload);
      } else {
        // For a new doc, we need to set the base values, not increment them
        updatePayload.apiName = apiName;
        updatePayload.createdAt = serverTimestamp();
        updatePayload.monthCount = 1;
        updatePayload.totalCount = 1;
        updatePayload.dayCount = 1;
        updatePayload.hourCount = 1;
        updatePayload.minuteCount = 1;
        console.log('[DEBUG] Creating new document with payload:', updatePayload);
        transaction.set(usageDocRef, updatePayload);
      }
      
      return true; // Return true from transaction to indicate success
    });

    console.log(`--- [END] checkAndIncrementApiUsage. Allowed: ${allowed} ---`);
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
    console.log("[Admin Dashboard] Fetched stats data:", data);

     const now = new Date();
     const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();
     
     // Check if the last update was in the same time window as now (all UTC)
     const isSameMinute = lastUpdate && now.getUTCMinutes() === lastUpdate.getUTCMinutes() && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate();
     const isSameHour = lastUpdate && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate();
     const isSameDay = lastUpdate && now.getUTCDate() === lastUpdate.getUTCDate();
     
     console.log(`[Admin Dashboard] isSameMinute: ${isSameMinute}, isSameHour: ${isSameHour}, isSameDay: ${isSameDay}`);

    return {
      minute: isSameMinute ? data.minuteCount || 0 : 0,
      hour: isSameHour ? data.hourCount || 0 : 0,
      day: isSameDay ? data.dayCount || 0 : 0,
      month: data.monthCount || 0,
      total: data.totalCount || 0
    };
  } catch (error) {
    console.error("[ERROR] Error fetching API usage stats:", error);
    return { minute: 0, hour: 0, day: 0, month: 0, total: 0 };
  }
}
