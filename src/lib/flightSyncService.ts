
"use client";

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  writeBatch,
  getDocs,
  query,
  where,
  limit,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { format, parse, addDays, startOfToday, subDays } from 'date-fns';

// --- Interface for Stored Flight Data (matches AviationStack structure) ---
export interface StoredFlight {
  id: string; // Firestore document ID
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    scheduled: Date;
    actual?: Date;
  };
  arrival: {
    airport: string;
    timezone: string;
    iata: string;
    scheduled: Date;
    actual?: Date;
  };
  airline: {
    name: string;
    iata: string;
  };
  flight: {
    number: string;
    iata: string;
  };
  // To identify if it's an arrival or departure for LPB
  type: 'arrival' | 'departure';
}

// --- Helper Functions ---
function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    throw new Error("AviationStack API key is missing. Please set NEXT_PUBLIC_AVIATIONSTACK_API_KEY in your .env.local file.");
  }
  return apiKey;
}

// --- Main Sync Logic ---

/**
 * Fetches all flights (arrivals or departures) for a specific date from AviationStack API.
 * @param flightDate - The date to fetch flights for.
 * @param type - 'arrivals' or 'departures'.
 * @returns An array of flight data from the API.
 */
async function fetchFlightsForDate(flightDate: Date, type: 'arrivals' | 'departures'): Promise<any[]> {
  const apiKey = getApiKey();
  const dateString = format(flightDate, 'yyyy-MM-dd');
  const params = new URLSearchParams({
    access_key: apiKey,
    limit: '100', // Max limit
  });
  
  if (type === 'arrivals') {
    params.set('arr_iata', 'LPB');
  } else {
    params.set('dep_iata', 'LPB');
  }

  const url = `https://api.aviationstack.com/v1/flights?${params.toString()}&flight_date=${dateString}`;
  console.log(`[SYNC] Calling AviationStack URL: ${url}`);

  const response = await fetch(url, { cache: 'no-store' });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorBody: any = { message: errorText || `HTTP Error ${response.status}` };

    try {
      // Try to parse the error text as JSON, maybe it's a structured error
      const parsedJson = JSON.parse(errorText);
      errorBody = parsedJson;
    } catch (e) {
      // It wasn't JSON, so we stick with the text response
    }
    
    console.error(`[SYNC] AviationStack API Error for ${type} on ${dateString}:`, errorBody);
    
    const errorMessage = errorBody?.error?.message || errorBody.message || `API request failed for ${type} on ${dateString}.`;
    throw new Error(errorMessage);
  }

  const jsonResponse = await response.json();
  return jsonResponse.data || [];
}

/**
 * Saves fetched flight data to Firestore, overwriting existing data for that date and type.
 * @param flightDate - The date the flights are for.
 * @param flights - The array of flights from the API.
 * @param type - 'arrival' or 'departure'.
 */
async function saveFlightsToFirestore(flightDate: Date, flights: any[], type: 'arrival' | 'departure'): Promise<number> {
    if (!db) throw new Error("Firestore not initialized.");
    if (flights.length === 0) return 0;

    const batch = writeBatch(db);
    const dateString = format(flightDate, 'yyyy-MM-dd');

    flights.forEach(flight => {
        const flightId = `${dateString}_${flight.flight.iata}_${type}`;
        const docRef = doc(db, 'dailyFlights', flightId);

        // Convert date strings to Firestore Timestamps
        const scheduledDeparture = flight.departure.scheduled ? new Date(flight.departure.scheduled) : null;
        const actualDeparture = flight.departure.actual ? new Date(flight.departure.actual) : null;
        const scheduledArrival = flight.arrival.scheduled ? new Date(flight.arrival.scheduled) : null;
        const actualArrival = flight.arrival.actual ? new Date(flight.arrival.actual) : null;

        const dataToSave = {
            ...flight,
            flight_date: dateString,
            type: type,
            // Ensure dates are converted correctly for Firestore
            departure: { ...flight.departure, scheduled: scheduledDeparture, actual: actualDeparture },
            arrival: { ...flight.arrival, scheduled: scheduledArrival, actual: actualArrival },
        };
        batch.set(docRef, dataToSave);
    });

    await batch.commit();
    console.log(`[SYNC] Successfully saved ${flights.length} ${type}s for ${dateString} to Firestore.`);
    return flights.length;
}


/**
 * Fetches and stores all arrivals and departures for a given date.
 * @param dateToSync - The Date object for which to sync flights.
 * @returns A summary message of the sync operation.
 */
export async function syncDailyFlights(dateToSync: Date): Promise<string> {
  const dateString = format(dateToSync, 'yyyy-MM-dd');
  console.log(`[SYNC] Starting flight synchronization for ${dateString}...`);
  try {
    const [arrivals, departures] = await Promise.all([
      fetchFlightsForDate(dateToSync, 'arrivals'),
      fetchFlightsForDate(dateToSync, 'departures'),
    ]);
    
    console.log(`[SYNC] Fetched ${arrivals.length} arrivals and ${departures.length} departures for ${dateString}.`);

    const [savedArrivalsCount, savedDeparturesCount] = await Promise.all([
        saveFlightsToFirestore(dateToSync, arrivals, 'arrival'),
        saveFlightsToFirestore(dateToSync, departures, 'departure')
    ]);

    return `Sincronización completa para ${dateString}: ${savedArrivalsCount} llegadas y ${savedDeparturesCount} salidas guardadas.`;
  } catch (error: any) {
    console.error(`[SYNC] Failed to synchronize flights for ${dateString}:`, error);
    throw new Error(`Error en la sincronización para ${dateString}: ${error.message}`);
  }
}

/**
 * Triggers the flight synchronization based on the cron schedule logic.
 * On Fridays, it syncs for Saturday, Sunday, and Monday.
 * On other days, it syncs for the next day.
 * @returns An array of status messages for each day synced.
 */
export async function triggerSyncBasedOnSchedule(): Promise<string[]> {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
    const datesToSync: Date[] = [];

    if (dayOfWeek === 5) { // Friday
        console.log("[CRON] It's Friday. Syncing for Saturday, Sunday, and Monday.");
        datesToSync.push(addDays(today, 1)); // Saturday
        datesToSync.push(addDays(today, 2)); // Sunday
        datesToSync.push(addDays(today, 3)); // Monday
    } else {
        console.log("[CRON] Syncing for tomorrow.");
        datesToSync.push(addDays(today, 1)); // Tomorrow
    }

    const syncPromises = datesToSync.map(date => syncDailyFlights(date));
    const results = await Promise.allSettled(syncPromises);

    return results.map((result, index) => {
        const dateString = format(datesToSync[index], 'yyyy-MM-dd');
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            return `Falló la sincronización para ${dateString}: ${result.reason.message}`;
        }
    });
}

/**
 * Deletes flight records from Firestore that are older than a week.
 * @returns A summary message of the delete operation.
 */
export async function deleteOldFlights(): Promise<string> {
    if (!db) throw new Error("Firestore not initialized.");
    
    const oneWeekAgo = subDays(startOfToday(), 7);
    const dateString = format(oneWeekAgo, 'yyyy-MM-dd');
    console.log(`[CLEANUP] Deleting flights on or before ${dateString}...`);
    
    const flightsRef = collection(db, "dailyFlights");
    const q = query(flightsRef, where("flight_date", "<=", dateString));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        console.log("[CLEANUP] No old flights found to delete.");
        return "No se encontraron vuelos antiguos para eliminar.";
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`[CLEANUP] Successfully deleted ${snapshot.size} old flight documents.`);
    return `Se eliminaron ${snapshot.size} registros de vuelos antiguos.`;
}

// --- Data Fetching from Firestore ---

/**
 * Gets a specific flight from the Firestore database.
 * @param flightNumber - The IATA flight number (e.g., "OB304").
 * @param flightDate - The date of the flight in "yyyy-MM-dd" format.
 * @returns The stored flight data or null if not found.
 */
export async function getFlightFromFirestore(flightNumber: string, flightDate: string): Promise<StoredFlight | null> {
    if (!db) throw new Error("Firestore not initialized.");
    const iata = flightNumber.replace(/\s/g, '').toUpperCase();
    const flightsRef = collection(db, "dailyFlights");
    
    const q = query(
        flightsRef,
        where("flight_date", "==", flightDate),
        where("flight.iata", "==", iata),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }
    
    const docData = snapshot.docs[0].data();
    // Convert Firestore Timestamps back to JS Dates
    const scheduledDeparture = docData.departure.scheduled?.toDate();
    const actualDeparture = docData.departure.actual?.toDate();
    const scheduledArrival = docData.arrival.scheduled?.toDate();
    const actualArrival = docData.arrival.actual?.toDate();

    return {
        ...docData,
        id: snapshot.docs[0].id,
        departure: { ...docData.departure, scheduled: scheduledDeparture, actual: actualDeparture },
        arrival: { ...docData.arrival, scheduled: scheduledArrival, actual: actualArrival },
    } as StoredFlight;
}


/**
 * Gets all flights for a specific date from Firestore.
 */
export async function getFlightsForDate(date: string): Promise<StoredFlight[]> {
    if (!db) throw new Error("Firestore not initialized");

    const flightsRef = collection(db, "dailyFlights");
    const q = query(flightsRef, where("flight_date", "==", date));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        return [];
    }
    
    return snapshot.docs.map(doc => {
        const docData = doc.data();
        const scheduledDeparture = docData.departure.scheduled?.toDate();
        const actualDeparture = docData.departure.actual?.toDate();
        const scheduledArrival = docData.arrival.scheduled?.toDate();
        const actualArrival = docData.arrival.actual?.toDate();

        return {
            ...docData,
            id: doc.id,
            departure: { ...docData.departure, scheduled: scheduledDeparture, actual: actualDeparture },
            arrival: { ...docData.arrival, scheduled: scheduledArrival, actual: actualArrival },
        } as StoredFlight;
    }).sort((a, b) => {
        // Sort by scheduled time, prioritizing departures then arrivals
        const timeA = a.type === 'departure' ? a.departure.scheduled.getTime() : a.arrival.scheduled.getTime();
        const timeB = b.type === 'departure' ? b.departure.scheduled.getTime() : b.arrival.scheduled.getTime();
        return timeA - timeB;
    });
}

    