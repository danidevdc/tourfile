
"use client";

import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, DocumentReference } from 'firebase/firestore';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

// Interface for the data we'll show in the chart
export interface FlightSearchStat {
  hour: string; // "00", "01", ..., "23"
  searches: number;
}

// The structure of our document in Firestore
interface DailyStats {
  total: number;
  hourly: { [hour: number]: number };
}

/**
 * Increments the flight search counter for the current day and hour (UTC).
 * This function uses a transaction to ensure atomic updates.
 */
export async function incrementFlightSearchCount(): Promise<void> {
  if (!db) {
    console.error("Firestore not initialized.");
    return;
  }

  // Get current UTC date and hour
  const nowUtc = new Date();
  const dateKey = format(nowUtc, 'yyyy-MM-dd'); // e.g., "2024-08-01"
  const hourKey = nowUtc.getUTCHours(); // 0-23

  const statDocRef: DocumentReference<DailyStats> = doc(db, 'flightSearchStats', dateKey) as DocumentReference<DailyStats>;

  try {
    await runTransaction(db, async (transaction) => {
      const statDoc = await transaction.get(statDocRef);

      if (!statDoc.exists()) {
        // If document for today doesn't exist, create it
        const newDailyStat: DailyStats = {
          total: 1,
          hourly: { [hourKey]: 1 }
        };
        transaction.set(statDocRef, newDailyStat);
      } else {
        // If it exists, increment atomically
        const currentData = statDoc.data();
        const newTotal = (currentData.total || 0) + 1;
        const newHourlyCount = (currentData.hourly?.[hourKey] || 0) + 1;

        transaction.update(statDocRef, {
          total: newTotal,
          [`hourly.${hourKey}`]: newHourlyCount
        });
      }
    });
  } catch (error) {
    console.error("Error incrementing flight search count:", error);
    // Fail silently to not interrupt the user's main task
  }
}

/**
 * Retrieves the flight search statistics for the current day (UTC).
 * @returns An array of stats formatted for the chart, or an empty array on error.
 */
export async function getTodaysFlightSearchStats(): Promise<FlightSearchStat[]> {
  if (!db) {
    console.error("Firestore not initialized.");
    return [];
  }

  const dateKey = format(new Date(), 'yyyy-MM-dd');
  const statDocRef: DocumentReference<DailyStats> = doc(db, 'flightSearchStats', dateKey) as DocumentReference<DailyStats>;

  try {
    const statDoc = await getDoc(statDocRef);
    if (!statDoc.exists()) {
      return []; // No stats for today yet
    }

    const data = statDoc.data();
    const hourlyData = data?.hourly || {};
    
    // Create a full 24-hour array for the chart
    const chartData: FlightSearchStat[] = Array.from({ length: 24 }, (_, i) => {
      const hourString = i.toString().padStart(2, '0');
      return {
        hour: hourString,
        searches: hourlyData[i] || 0
      };
    });
    
    return chartData;

  } catch (error) {
    console.error("Error fetching today's flight search stats:", error);
    return [];
  }
}
