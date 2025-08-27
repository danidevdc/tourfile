
'use server';
/**
 * @fileOverview Finds real-time flight information by calling the FlightAware AeroAPI.
 *
 * - findFlight - The exported server action to find flight details.
 */
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import type { FindFlightInput, FindFlightOutput } from './flight-types';
import { checkAndIncrementApiUsage } from '@/lib/apiUsageService';


function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_AEROAPI_KEY;
  if (!apiKey) {
    throw new Error("AeroAPI key is missing. Please set NEXT_PUBLIC_AEROAPI_KEY in your .env file.");
  }
  return apiKey;
}

// Normalizes the flight number to the format expected by AeroAPI.
// "ob 305" -> "OB305" -> "BOV305"
function normalizeIdent(flightNumber: string): string {
    const upperCaseNoSpace = flightNumber.replace(/\s/g, '').toUpperCase();
    if (upperCaseNoSpace.startsWith('OB')) {
        return upperCaseNoSpace.replace('OB', 'BOV');
    }
    return upperCaseNoSpace;
}

// Maps the AeroAPI response to our app's FindFlightOutput format
function mapApiResponseToFlightOutput(apiData: any, originalFlightNumber: string): FindFlightOutput {
  if (!apiData || !apiData.flights || apiData.flights.length === 0) {
    return { 
        flightFound: false, 
        flightNumber: originalFlightNumber, 
        errorMessage: `No flight found for this date. Please check if the flight operates on the selected day.` 
    };
  }

  // With start/end params, the API should only return flights for the correct day.
  // We can just take the first one. If there are multiple legs/diversions, the first is usually the primary one.
  const flight = apiData.flights[0];

  const formatTime = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      // The API returns ISO 8601 strings (UTC), so parseISO is correct.
      // format will then convert it to local time based on the server's timezone.
      // For HH:mm, this is generally what users expect to see.
      return format(parseISO(dateStr), 'HH:mm');
    } catch (e) {
      console.error(`Error formatting date: ${dateStr}`, e);
      return undefined;
    }
  };

  const operatorName = flight.operator_name || (flight.airline ? flight.airline.name : 'Unknown Airline');

  return {
    flightFound: true,
    flightNumber: flight.ident, // Return the official ident from the API
    airline: operatorName,
    departure: {
      airport: {
        code: flight.origin?.code_iata,
        name: flight.origin?.name,
        city: flight.origin?.city,
      },
      time: {
        scheduled: formatTime(flight.scheduled_out)!,
        actual: formatTime(flight.actual_out),
      },
    },
    arrival: {
      airport: {
        code: flight.destination?.code_iata,
        name: flight.destination?.name,
        city: flight.destination?.city,
      },
      time: {
        scheduled: formatTime(flight.scheduled_in)!,
        actual: formatTime(flight.actual_in),
      },
    },
    flightSegment: `${flight.origin?.code_iata}/${flight.destination?.code_iata}`,
  };
}


/**
 * Finds a flight by calling the AeroAPI.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  try {
    const apiKey = getApiKey(); // First, check for API key.

    // Then, check the rate limit before proceeding.
    const limitCheck = await checkAndIncrementApiUsage('AeroAPI');
    if (!limitCheck.allowed) {
      return {
        flightFound: false,
        flightNumber: input.flightNumber,
        errorMessage: "Límite de API excedido. Por favor, espera un minuto antes de volver a intentarlo."
      };
    }

    // Step 1: Normalize the flight number
    const flightIdent = normalizeIdent(input.flightNumber);
    
    // Step 2: Prepare date range for the API query according to docs
    const targetDate = parseISO(input.date);
    const startDate = format(startOfDay(targetDate), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    const endDate = format(endOfDay(targetDate), "yyyy-MM-dd'T'HH:mm:ss'Z'");


    // Step 3: Call the API endpoint with date filters
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${flightIdent}?start=${startDate}&end=${endDate}`;
    
    // --- SERVER-SIDE LOGGING ---
    console.log(`[SERVER] Requesting URL: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'x-apikey': apiKey },
      cache: 'no-store' // Avoid caching flight data
    });

    const responseBody = await response.json();
    
    // --- SERVER-SIDE LOGGING ---
    console.log('[SERVER] Raw API Response:', JSON.stringify(responseBody, null, 2));

    if (!response.ok) {
        const errorMessage = responseBody.title || responseBody.detail || `API request failed with status ${response.status}.`;
        return { flightFound: false, flightNumber: input.flightNumber, errorMessage };
    }
    
    // Step 4: Map the API response to our output format
    const result = mapApiResponseToFlightOutput(responseBody, input.flightNumber);
    
    return result;

  } catch (e: any) {
    console.error("[FATAL] An unhandled error occurred in the findFlight flow:", e);
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      errorMessage: e.message || 'An unknown error occurred during the flight search.',
    };
  }
}
