
'use server';
/**
 * @fileOverview Finds real-time flight information by calling the FlightAware AeroAPI.
 *
 * - findFlight - The exported server action to find flight details.
 */
import { format, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
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
function mapApiResponseToFlightOutput(apiData: any, requestedDate: string, originalFlightNumber: string): FindFlightOutput {
  if (!apiData || !apiData.flights || apiData.flights.length === 0) {
    return { flightFound: false, flightNumber: originalFlightNumber, errorMessage: `No flights found for ident ${originalFlightNumber}.` };
  }

  // --- Date Filtering Logic ---
  // The API returns all recent/scheduled flights for an ident. We must filter by the requested date.
  const targetDate = parseISO(requestedDate);
  const interval = { start: startOfDay(targetDate), end: endOfDay(targetDate) };

  const flightForDate = apiData.flights.find((f: any) => {
    // scheduled_out is the primary field to check for departures
    if (f.scheduled_out) {
      try {
        const scheduledOutDate = parseISO(f.scheduled_out);
        return isWithinInterval(scheduledOutDate, interval);
      } catch(e) {
        // Ignore flights with invalid date formats
        return false;
      }
    }
    return false;
  });

  if (!flightForDate) {
      return { flightFound: false, flightNumber: originalFlightNumber, errorMessage: `No flight found for ${format(targetDate, 'dd/MM/yyyy')}. Check if the flight operates on this date.` };
  }
  // --- End of Date Filtering ---


  const formatTime = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch (e) {
      return undefined;
    }
  };

  const operatorName = flightForDate.operator_name || 
                       (flightForDate.airline ? flightForDate.airline.name : 'Unknown Airline');

  return {
    flightFound: true,
    flightNumber: flightForDate.ident,
    airline: operatorName,
    departure: {
      airport: {
        code: flightForDate.origin?.code_iata,
        name: flightForDate.origin?.name,
        city: flightForDate.origin?.city,
      },
      time: {
        scheduled: formatTime(flightForDate.scheduled_out)!,
        actual: formatTime(flightForDate.actual_out),
      },
    },
    arrival: {
      airport: {
        code: flightForDate.destination?.code_iata,
        name: flightForDate.destination?.name,
        city: flightForDate.destination?.city,
      },
      time: {
        scheduled: formatTime(flightForDate.scheduled_in)!,
        actual: formatTime(flightForDate.actual_in),
      },
    },
    flightSegment: `${flightForDate.origin?.code_iata}/${flightForDate.destination?.code_iata}`,
  };
}


/**
 * Finds a flight by calling the AeroAPI.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  try {
    const limitCheck = await checkAndIncrementApiUsage('AeroAPI');
    if (!limitCheck.allowed) {
      return {
        flightFound: false,
        flightNumber: input.flightNumber,
        errorMessage: "Límite de API excedido. Por favor, espera un minuto antes de volver a intentarlo."
      };
    }

    const apiKey = getApiKey();
    // Step 1: Normalize the flight number
    const flightIdent = normalizeIdent(input.flightNumber);
    
    // Step 2: Call the API endpoint without date filters
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${flightIdent}`;
    
    const response = await fetch(url, {
      headers: { 'x-apikey': apiKey },
      cache: 'no-store' // Avoid caching flight data
    });

    const responseBody = await response.json();

    if (!response.ok) {
        const errorMessage = responseBody.title || responseBody.detail || `API request failed with status ${response.status}.`;
        return { flightFound: false, flightNumber: input.flightNumber, errorMessage };
    }
    
    // Step 3: Filter the results on our server
    const result = mapApiResponseToFlightOutput(responseBody, input.date, input.flightNumber);

    return {
        ...result,
        flightNumber: input.flightNumber, // Return the original requested number for consistency
    };

  } catch (e: any) {
    console.error("[FATAL] An unhandled error occurred in the findFlight flow:", e);
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      errorMessage: e.message || 'An unknown error occurred during the flight search.',
    };
  }
}
