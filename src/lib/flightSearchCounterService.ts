
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
  dailyLimit: number;
  todayRemaining: number;
  limitUsedPercent: number;
  monthTotal: number;
  estimatedTodayCost: number;
  estimatedMonthCost: number;
  freeCreditUsd: number;
  remainingCreditUsd: number;
  creditUsedPercent: number;
  costPerResultSet: number;
  lastUpdated: Date;
}

export type CountedFlightSearchProvider = 'aeroapi' | 'airlabs';

// The structure of our document in Firestore
interface DailyStats {
  total: number;
  hourly: { [hour: number]: number };
}

const TIME_ZONE = 'America/La_Paz'; // GMT-4
const COST_PER_RESULT_SET = 0.005;
const FREE_CREDIT_USD = 5;
export const FLIGHTAWARE_DAILY_LIMIT = 30;
export const AIRLABS_DAILY_LIMIT = 100;
const AIRLABS_COST_PER_REQUEST = 0;
const AIRLABS_FREE_CREDIT_USD = 0;

export interface FlightAwareSearchConsumption {
  allowed: boolean;
  total: number;
  remaining: number;
  limit: number;
}

function getStatsCollection(provider: CountedFlightSearchProvider): string {
  return provider === 'airlabs' ? 'airlabsFlightSearchStats' : 'flightSearchStats';
}

function getDailyLimit(provider: CountedFlightSearchProvider): number {
  return provider === 'airlabs' ? AIRLABS_DAILY_LIMIT : FLIGHTAWARE_DAILY_LIMIT;
}

function getTodayStatRef(provider: CountedFlightSearchProvider = 'aeroapi'): DocumentReference<DailyStats> | null {
  if (!db) return null;

  const nowUtc = new Date();
  const zonedDate = toZonedTime(nowUtc, TIME_ZONE);
  const dateKey = formatISO(zonedDate);
  return doc(db, getStatsCollection(provider), dateKey) as DocumentReference<DailyStats>;
}

/**
 * Increments the flight search counter for the current day and hour based on the specified timezone.
 * This function uses a transaction to ensure atomic updates.
 */
export async function incrementFlightSearchCount(): Promise<void> {
  await tryConsumeFlightAwareSearch();
}

/**
 * Atomically reserves one FlightAware/AeroAPI search for today.
 * AirLabs and NAABOL calls should not use this because they do not consume AeroAPI credit.
 */
export async function tryConsumeFlightAwareSearch(
  options: { enforceLimit?: boolean } = {}
): Promise<FlightAwareSearchConsumption> {
  return tryConsumeCountedFlightSearch('aeroapi', options);
}

export async function tryConsumeAirLabsSearch(
  options: { enforceLimit?: boolean } = {}
): Promise<FlightAwareSearchConsumption> {
  return tryConsumeCountedFlightSearch('airlabs', options);
}

async function tryConsumeCountedFlightSearch(
  provider: CountedFlightSearchProvider,
  options: { enforceLimit?: boolean } = {}
): Promise<FlightAwareSearchConsumption> {
  const statDocRef = getTodayStatRef(provider);
  const dailyLimit = getDailyLimit(provider);
  if (!db || !statDocRef) {
    console.error("Firestore not initialized.");
    return {
      allowed: true,
      total: 0,
      remaining: dailyLimit,
      limit: dailyLimit,
    };
  }

  const nowUtc = new Date();
  const zonedDate = toZonedTime(nowUtc, TIME_ZONE);
  const hourKey = zonedDate.getHours();

  try {
    return await runTransaction(db, async (transaction) => {
      const statDoc = await transaction.get(statDocRef);
      const currentData = statDoc.exists() ? statDoc.data() : null;
      const currentTotal = currentData?.total || 0;

      if (options.enforceLimit !== false && currentTotal >= dailyLimit) {
        return {
          allowed: false,
          total: currentTotal,
          remaining: 0,
          limit: dailyLimit,
        };
      }

      const newTotal = currentTotal + 1;
      const newHourlyCount = (currentData?.hourly?.[hourKey] || 0) + 1;

      if (!statDoc.exists()) {
        const newDailyStat: DailyStats = {
          total: 1,
          hourly: { [hourKey]: 1 }
        };
        transaction.set(statDocRef, newDailyStat);
      } else {
        transaction.update(statDocRef, {
          total: newTotal,
          [`hourly.${hourKey}`]: newHourlyCount
        });
      }

      return {
        allowed: true,
        total: newTotal,
        remaining: Math.max(0, dailyLimit - newTotal),
        limit: dailyLimit,
      };
    });
  } catch (error) {
    console.error("Error incrementing flight search count:", error);
    return {
      allowed: true,
      total: 0,
      remaining: dailyLimit,
      limit: dailyLimit,
    };
  }
}

/**
 * Retrieves the flight search statistics for the current day based on the specified timezone.
 * @returns An array of stats formatted for the chart, or an empty array on error.
 */
export async function getTodaysFlightSearchStats(provider: CountedFlightSearchProvider = 'aeroapi'): Promise<FlightSearchStat[]> {
  if (!db) {
    console.error("Firestore not initialized.");
    return [];
  }

  // Get the current date in the target timezone to fetch the correct document
  const nowUtc = new Date();
  const zonedDate = toZonedTime(nowUtc, TIME_ZONE);
  const dateKey = format(zonedDate, 'yyyy-MM-dd');

  const statDocRef: DocumentReference<DailyStats> = doc(db, getStatsCollection(provider), dateKey) as DocumentReference<DailyStats>;

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
export async function getFlightSearchUsageStats(
  provider: CountedFlightSearchProvider = 'aeroapi'
): Promise<FlightSearchUsageStats> {
  const today = await getTodaysFlightSearchStats(provider);
  const todayTotal = today.reduce((sum, item) => sum + item.searches, 0);
  const dailyLimit = getDailyLimit(provider);
  const costPerResultSet = provider === 'airlabs' ? AIRLABS_COST_PER_REQUEST : COST_PER_RESULT_SET;
  const freeCreditUsd = provider === 'airlabs' ? AIRLABS_FREE_CREDIT_USD : FREE_CREDIT_USD;

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

      const statsRef = collection(db, getStatsCollection(provider));
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

  const estimatedTodayCost = todayTotal * costPerResultSet;
  const estimatedMonthCost = monthTotal * costPerResultSet;
  const remainingCreditUsd = Math.max(0, freeCreditUsd - estimatedMonthCost);
  const creditUsedPercent = freeCreditUsd > 0 ? Math.min(100, (estimatedMonthCost / freeCreditUsd) * 100) : 0;

  return {
    today,
    todayTotal,
    dailyLimit,
    todayRemaining: Math.max(0, dailyLimit - todayTotal),
    limitUsedPercent: Math.min(100, (todayTotal / dailyLimit) * 100),
    monthTotal,
    estimatedTodayCost,
    estimatedMonthCost,
    freeCreditUsd,
    remainingCreditUsd,
    creditUsedPercent,
    costPerResultSet,
    lastUpdated: new Date(),
  };
}
