
'use server';
/**
 * @fileOverview Finds flight information by calling the AviationStack API directly.
 * This file replaces the previous Firestore-based implementation for direct API testing.
 *
 * - findFlight - The exported server action to find flight details from the AviationStack API.
 */
import { format, parse } from 'date-fns';
import type { FindFlightInput, FindFlightOutput } from './flight-types';


// Helper to get the API key from environment variables
function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    throw new Error("AviationStack API key is missing. Please set NEXT_PUBLIC_AVIATIONSTACK_API_KEY in your .env.local file.");
  }
  return apiKey;
}


// Maps the API response to our app's FindFlightOutput format
function mapApiResponseToFlightOutput(apiData: any): FindFlightOutput {
  if (!apiData) {
    return { flightFound: false };
  }

  const formatTime = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      // API returns ISO 8601 format (e.g., "2025-08-27T10:40:00+00:00")
      return format(new Date(dateStr), 'HH:mm');
    } catch (e) {
      console.warn("Invalid date for formatting:", dateStr, e);
      return undefined;
    }
  };

  return {
    flightFound: true,
    flightNumber: apiData.flight.iata,
    airline: apiData.airline.name,
    departure: {
      airport: {
        code: apiData.departure.iata,
        name: apiData.departure.airport,
        city: apiData.departure.timezone,
      },
      time: {
        scheduled: formatTime(apiData.departure.scheduled)!,
        actual: formatTime(apiData.departure.actual),
      },
    },
    arrival: {
      airport: {
        code: apiData.arrival.iata,
        name: apiData.arrival.airport,
        city: apiData.arrival.timezone,
      },
      time: {
        scheduled: formatTime(apiData.arrival.scheduled)!,
        actual: formatTime(apiData.arrival.actual),
      },
    },
    flightSegment: `${apiData.departure.iata}/${apiData.arrival.iata}`,
  };
}


/**
 * Finds a flight by calling the AviationStack API directly.
 * This is a server action that can be called from client components.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  console.log("[SERVER] Calling AviationStack API for:", JSON.stringify(input, null, 2));

  try {
    const apiKey = getApiKey();
    const flightIata = input.flightNumber.replace(/\s/g, '').toUpperCase();
    const params = new URLSearchParams({
        access_key: apiKey,
        flight_iata: flightIata,
        flight_date: input.date,
        limit: '1',
    });

    const url = `https://api.aviationstack.com/v1/flights?${params.toString()}`;
    
    console.log(`[SERVER] Fetching URL: ${url}`);
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
        const errorText = await response.text();
        let errorBody: any = {};
        try {
            errorBody = JSON.parse(errorText);
        } catch {
            errorBody.message = errorText || `HTTP Error ${response.status}`;
        }
        const errorMessage = errorBody?.error?.message || errorBody.message || `API request failed with status ${response.status}.`;
        console.error("[SERVER] AviationStack API Error:", errorMessage);
        return { flightFound: false, errorMessage };
    }

    const jsonResponse = await response.json();
    const flightData = jsonResponse.data?.[0];

    if (!flightData) {
      console.log("[SERVER] No flight data returned from API for this criteria.");
      return { 
          flightFound: false, 
          flightNumber: input.flightNumber,
          errorMessage: `Vuelo ${input.flightNumber} no encontrado en la API para la fecha ${input.date}.`
      };
    }
    
    console.log("[SERVER] Found flight data from API:", JSON.stringify(flightData, null, 2));
    const result = mapApiResponseToFlightOutput(flightData);

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
