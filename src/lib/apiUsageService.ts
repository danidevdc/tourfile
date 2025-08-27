
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

export interface ApiUsageStats {
  minute: number;
  hour: number;
  day: number;
  month: number;
}

function getUsageDocumentId(apiName: string): string {
    const now = new Date();
    // Creates a new document for each month to keep documents small and performant.
    return `${apiName}_${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Atomically increments the API usage counters. This function is for tracking only and does not enforce limits.
 * @param apiName The name of the API being used.
 * @returns A promise that resolves when the transaction is complete.
 */
export async function checkAndIncrementApiUsage(apiName: string): Promise<void> {
  if (!db) {
    console.error("[FATAL] Firestore not initialized. Cannot increment API usage.");
    return;
  }
  
  const docId = getUsageDocumentId(apiName);
  const usageDocRef = doc(db, 'apiUsageCounters', docId);

  try {
    await runTransaction(db, async (transaction) => {
      const usageDoc = await transaction.get(usageDocRef);
      const now = new Date();
      
      const updatePayload: { [key: string]: any } = {
        lastUpdate: serverTimestamp(),
        monthCount: increment(1),
        apiName: apiName // Ensure apiName is always present
      };
      
      if(usageDoc.exists()) {
        const data = usageDoc.data();
        const lastUpdate = (data.lastUpdate as Timestamp)?.toDate();
        
        // Determine if we are in a new time window compared to the last update
        const isNewDay = !lastUpdate || lastUpdate.getUTCDate() !== now.getUTCDate() || lastUpdate.getUTCFullYear() !== now.getUTCFullYear() || lastUpdate.getUTCMonth() !== now.getUTCMonth();
        const isNewHour = isNewDay || lastUpdate.getUTCHours() !== now.getUTCHours();
        const isNewMinute = isNewHour || lastUpdate.getUTCMinutes() !== now.getUTCMinutes();

        // Reset counters if we are in a new window, otherwise increment
        updatePayload.dayCount = isNewDay ? 1 : increment(1);
        updatePayload.hourCount = isNewHour ? 1 : increment(1);
        updatePayload.minuteCount = isNewMinute ? 1 : increment(1);
        
        transaction.update(usageDocRef, updatePayload);
      } else {
        // If the document doesn't exist, it's the first call for the month.
        // Initialize all counters to 1.
        updatePayload.createdAt = serverTimestamp();
        updatePayload.monthCount = 1;
        updatePayload.dayCount = 1;
        updatePayload.hourCount = 1;
        updatePayload.minuteCount = 1;
        transaction.set(usageDocRef, updatePayload);
      }
    });

  } catch (error) {
    console.error(`[FATAL] Error in checkAndIncrementApiUsage transaction for ${apiName}:`, error);
    // Don't throw, just log the error. We don't want to block the main flow for a counter error.
  }
}

/**
 * Retrieves the current API usage stats from the counter document.
 * @param apiName The name of the API.
 * @returns The current usage stats.
 */
export async function getApiUsageStats(apiName: string): Promise<ApiUsageStats> {
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
     const isSameMinute = lastUpdate && now.getUTCMinutes() === lastUpdate.getUTCMinutes() && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate() && now.getUTCFullYear() === lastUpdate.getUTCFullYear() && now.getUTCMonth() === lastUpdate.getUTCMonth();
     const isSameHour = lastUpdate && now.getUTCHours() === lastUpdate.getUTCHours() && now.getUTCDate() === lastUpdate.getUTCDate() && now.getUTCFullYear() === lastUpdate.getUTCFullYear() && now.getUTCMonth() === lastUpdate.getUTCMonth();
     const isSameDay = lastUpdate && now.getUTCDate() === lastUpdate.getUTCDate() && now.getUTCFullYear() === lastUpdate.getUTCFullYear() && now.getUTCMonth() === lastUpdate.getUTCMonth();
     
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
