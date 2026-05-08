
"use client";

import { db } from '@/lib/firebase';
import { collection, doc, documentId, getDoc, getDocs, query, runTransaction, where, DocumentReference } from 'firebase/firestore';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { formatISO } from '@/lib/formatters';

// Interface for the data we'll show in the chart
export interface FlightSearchStat {
  hour: string; // "00", "01", ..., "23"
  searches: number;
}

export interface FlightSearchUsageStats {
  today: FlightSearchStat[];
  todayTotal: number;
  monthTotal: number;
  estimatedTodayCost: number;
  estimatedMonthCost: number;
  freeCreditUsd: number;
  remainingCreditUsd: number;
  creditUsedPercent: number;
  costPerResultSet: number;
  lastUpdated: Date;
}

// The structure of our document in Firestore
interface DailyStats {
  total: number;
  hourly: { [hour: number]: number };
}

const TIME_ZONE = 'America/La_Paz'; // GMT-4
const COST_PER_RESULT_SET = 0.005;
const FREE_CREDIT_USD = 5;

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
  const zonedDate = toZonedTime(nowUtc, TIME_ZONE);
  
  // Use the date and hour from the converted time
  const dateKey = formatISO(zonedDate); // e.g., "2024-08-01"
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
  const zonedDate = toZonedTime(nowUtc, TIME_ZONE);
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

/**
 * Retrieves current usage estimates for AeroAPI searches.
 * The estimate assumes max_pages=1, so each app search costs at most one result set.
 */
export async function getFlightSearchUsageStats(): Promise<FlightSearchUsageStats> {
  const today = await getTodaysFlightSearchStats();
  const todayTotal = today.reduce((sum, item) => sum + item.searches, 0);

  let monthTotal = todayTotal;
  if (db) {
    try {
      const nowUtc = new Date();
      const zonedDate = toZonedTime(nowUtc, TIME_ZONE);
      const year = zonedDate.getFullYear();
      const month = String(zonedDate.getMonth() + 1).padStart(2, '0');
      const firstDayKey = `${year}-${month}-01`;
      const nextMonth = new Date(year, zonedDate.getMonth() + 1, 1);
      const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      const statsRef = collection(db, 'flightSearchStats');
      const monthQuery = query(
        statsRef,
        where(documentId(), '>=', firstDayKey),
        where(documentId(), '<', nextMonthKey)
      );
      const snapshot = await getDocs(monthQuery);
      monthTotal = snapshot.docs.reduce((sum, docSnap) => {
        const data = docSnap.data() as Partial<DailyStats>;
        return sum + (data.total || 0);
      }, 0);
    } catch (error) {
      console.error("Error fetching monthly flight search stats:", error);
    }
  }

  const estimatedTodayCost = todayTotal * COST_PER_RESULT_SET;
  const estimatedMonthCost = monthTotal * COST_PER_RESULT_SET;
  const remainingCreditUsd = Math.max(0, FREE_CREDIT_USD - estimatedMonthCost);
  const creditUsedPercent = Math.min(100, (estimatedMonthCost / FREE_CREDIT_USD) * 100);

  return {
    today,
    todayTotal,
    monthTotal,
    estimatedTodayCost,
    estimatedMonthCost,
    freeCreditUsd: FREE_CREDIT_USD,
    remainingCreditUsd,
    creditUsedPercent,
    costPerResultSet: COST_PER_RESULT_SET,
    lastUpdated: new Date(),
  };
}
