
'use server';

import { db } from '@/lib/firebase';
import {
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  getDoc
} from 'firebase/firestore';

export interface ApiUsageStats {
  day: number;
}

function getDailyUsageDocumentId(apiName: string): string {
    const now = new Date();
    // Creates a new document for each day (UTC).
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${apiName}_${year}-${month}-${day}`;
}

/**
 * Atomically increments the daily API usage counter.
 * @param apiName The name of the API being used.
 */
export async function checkAndIncrementApiUsage(apiName: string): Promise<void> {
  if (!db) {
    console.error("[FATAL] Firestore not initialized. Cannot increment API usage.");
    return;
  }
  
  const docId = getDailyUsageDocumentId(apiName);
  const usageDocRef = doc(db, 'apiUsageCounters', docId);

  try {
    await runTransaction(db, async (transaction) => {
      const usageDoc = await transaction.get(usageDocRef);
      
      const updatePayload: { [key: string]: any } = {
        lastUpdate: serverTimestamp(),
        count: increment(1),
        apiName: apiName
      };
      
      if(usageDoc.exists()) {
        transaction.update(usageDocRef, updatePayload);
      } else {
        // If the document for today doesn't exist, it's the first call.
        // Initialize the counter.
        updatePayload.createdAt = serverTimestamp();
        updatePayload.count = 1; // Start count at 1
        transaction.set(usageDocRef, updatePayload);
      }
    });

  } catch (error) {
    console.error(`[FATAL] Error in checkAndIncrementApiUsage transaction for ${apiName}:`, error);
    // Fail silently
  }
}

/**
 * Retrieves the current daily API usage stats.
 * @param apiName The name of the API.
 * @returns The current usage stats for the day.
 */
export async function getApiUsageStats(apiName: string): Promise<ApiUsageStats> {
  if (!db) {
    console.error("[FATAL] Firestore not initialized.");
    return { day: 0 };
  }

  const docId = getDailyUsageDocumentId(apiName);
  const usageDocRef = doc(db, 'apiUsageCounters', docId);

  try {
    const docSnap = await getDoc(usageDocRef);
    if (!docSnap.exists()) {
      return { day: 0 };
    }
    const data = docSnap.data();
    return {
      day: data.count || 0,
    };
  } catch (error) {
    console.error("[ERROR] Error fetching API usage stats:", error);
    return { day: 0 };
  }
}
