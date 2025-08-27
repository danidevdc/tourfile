
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

const TIME_ZONE = 'America/La_Paz'; // GMT-4

/**
 * Increments the flight search counter for the current day and hour based on the specified timezone.
 * This function uses a transaction to ensure atomic updates.
 */
export async function incrementFlightSearchCount(): Promise<void> {
  if (!db) {
    console.error("Firestore not initialized.");
    return;
  }

  // Get current time and convert it to the target timezone (GMT-4)
  const nowUtc = new Date();
  const zonedDate = utcToZonedTime(nowUtc, TIME_ZONE);
  
  // Use the date and hour from the converted time
  const dateKey = format(zonedDate, 'yyyy-MM-dd'); // e.g., "2024-08-01"
  const hourKey = zonedDate.getHours(); // 0-23 in GMT-4

  const statDocRef: DocumentReference<DailyStats> = doc(db, 'flightSearchStats', dateKey) as DocumentReference<DailyStats>;

  try {
    await runTransaction(db, async (transaction) => {
      const statDoc = await transaction.get(statDocRef);

      if (!statDoc.exists()) {
        // If document for today (in GMT-4) doesn't exist, create it
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
 * Retrieves the flight search statistics for the current day based on the specified timezone.
 * @returns An array of stats formatted for the chart, or an empty array on error.
 */
export async function getTodaysFlightSearchStats(): Promise<FlightSearchStat[]> {
  if (!db) {
    console.error("Firestore not initialized.");
    return [];
  }

  // Get the current date in the target timezone to fetch the correct document
  const nowUtc = new Date();
  const zonedDate = utcToZonedTime(nowUtc, TIME_ZONE);
  const dateKey = format(zonedDate, 'yyyy-MM-dd');

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
