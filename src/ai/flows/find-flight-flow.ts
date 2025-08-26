
'use server';
/**
 * @fileOverview Finds flight information by querying the local Firestore database.
 * This file replaces the previous direct API implementation.
 *
 * - findFlight - The exported server action to find flight details from the Firestore cache.
 */
import { format, parse } from 'date-fns';
import type { FindFlightInput, FindFlightOutput } from './flight-types';
import { getFlightFromFirestore, type StoredFlight } from '@/lib/flightSyncService';

// Maps the stored flight data from Firestore to our app's format
function mapStoredFlightToFlightOutput(storedFlight: StoredFlight | null): FindFlightOutput {
    if (!storedFlight) {
        return { flightFound: false };
    }

    // AviationStack returns times in UTC, so we can format them directly
    const formatTime = (date: Date | null | undefined): string | undefined => {
      if (!date) return undefined;
      try {
        // Ensure date is treated as UTC
        const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
        return format(utcDate, 'HH:mm');
      } catch (e) {
        console.warn("Invalid date for formatting:", date, e);
        return undefined;
      }
    };
    
    return {
        flightFound: true,
        flightNumber: storedFlight.flight.iata,
        airline: storedFlight.airline.name,
        departure: {
            airport: {
                code: storedFlight.departure.iata,
                name: storedFlight.departure.airport,
                city: storedFlight.departure.timezone, 
            },
            time: {
                scheduled: formatTime(storedFlight.departure.scheduled)!,
                actual: formatTime(storedFlight.departure.actual),
            },
        },
        arrival: {
            airport: {
                code: storedFlight.arrival.iata,
                name: storedFlight.arrival.airport,
                city: storedFlight.arrival.timezone,
            },
            time: {
                scheduled: formatTime(storedFlight.arrival.scheduled)!,
                actual: formatTime(storedFlight.arrival.actual),
            },
        },
        flightSegment: `${storedFlight.departure.iata}/${storedFlight.arrival.iata}`,
    };
}


/**
 * Finds a flight by querying the `dailyFlights` collection in Firestore.
 * This is a server action that can be called from client components.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
    console.log("[SERVER] Searching Firestore for:", JSON.stringify(input, null, 2));

    try {
        const flightData = await getFlightFromFirestore(input.flightNumber, input.date);
        
        if (!flightData) {
            console.log("[SERVER] No flight data found in Firestore for this criteria.");
            return { 
                flightFound: false, 
                flightNumber: input.flightNumber,
                errorMessage: "Vuelo no encontrado en la base de datos local. Sincroniza los vuelos desde el panel de administración."
            };
        }

        console.log("[SERVER] Found flight data in Firestore:", JSON.stringify(flightData, null, 2));

        const result = mapStoredFlightToFlightOutput(flightData);

        // Ensure the original flight number is preserved in the response.
        return {
            ...result,
            flightNumber: input.flightNumber,
        };

    } catch (e: any) {
        console.error("[SERVER] An error occurred in the findFlight flow:", e);
        return {
            flightFound: false,
            flightNumber: input.flightNumber,
            errorMessage: e.message || 'An unknown error occurred during the flight search.',
        };
    }
}
