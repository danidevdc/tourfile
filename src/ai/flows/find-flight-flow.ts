
'use server';
/**
 * @fileOverview Finds real-time flight information by calling the FlightAware AeroAPI.
 *
 * - findFlight - The exported server action to find flight details.
 */
import { addDays, parseISO, subHours } from 'date-fns';
import { formatTime, formatISO } from '@/lib/date-utils';
import type { FindFlightInput, FindFlightOutput } from './flight-types';


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

  // Filter flights to find one that involves La Paz airport (El Alto)
  const laPazFlight = apiData.flights.find((f: any) => 
    (f.origin?.code_iata === 'LPB' && f.origin?.name?.toLowerCase().includes('el alto')) ||
    (f.destination?.code_iata === 'LPB' && f.destination?.name?.toLowerCase().includes('el alto'))
  );

  if (!laPazFlight) {
    return {
      flightFound: false,
      flightNumber: originalFlightNumber,
      errorMessage: `Flight found, but it does not originate from or fly to La Paz.`
    };
  }
  
  const flight = laPazFlight;

  const formatTimeWithTimezone = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      // The API returns ISO 8601 strings (UTC). Parse it.
      const utcDate = parseISO(dateStr);
      // Subtract 4 hours to adjust from UTC to GMT-4.
      const adjustedDate = subHours(utcDate, 4);
      // Format the adjusted date using the centralized formatter
      return formatTime(adjustedDate);
    } catch (e) {
      console.error(`Error formatting date: ${dateStr}`, e);
      return undefined;
    }
  };

  return {
    flightFound: true,
    flightNumber: flight.ident, // Return the official ident from the API
    departure: {
      airport: {
        code: flight.origin?.code_iata,
        name: flight.origin?.name,
        city: flight.origin?.city,
      },
      time: {
        scheduled: formatTimeWithTimezone(flight.scheduled_out)!,
      },
    },
    arrival: {
      airport: {
        code: flight.destination?.code_iata,
        name: flight.destination?.name,
        city: flight.destination?.city,
      },
      time: {
        scheduled: formatTimeWithTimezone(flight.scheduled_in)!,
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
    
    // Step 1: Normalize the flight number
    const flightIdent = normalizeIdent(input.flightNumber);
    
    // Step 2: Prepare date range for the API query according to docs
    // The API expects a range. For a single day, we use the day itself as start
    // and the next day as the end (since 'end' is exclusive).
    const targetDate = parseISO(input.date);
    const startDate = formatISO(targetDate);
    const endDate = formatISO(addDays(targetDate, 1));


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
        // If the API itself returns an error (like 429 Too Many Requests), handle it here.
        if (response.status === 429) {
            return {
                flightFound: false,
                flightNumber: input.flightNumber,
                errorMessage: "El límite de la API de FlightAware ha sido excedido. Por favor, inténtalo de nuevo más tarde."
            };
        }
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
