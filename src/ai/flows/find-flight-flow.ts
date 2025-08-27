
'use server';
/**
 * @fileOverview Finds real-time flight information by calling the FlightAware AeroAPI.
 *
 * - findFlight - The exported server action to find flight details.
 */
import { format, parseISO } from 'date-fns';
import type { FindFlightInput, FindFlightOutput } from './flight-types';


function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_AEROAPI_KEY;
  if (!apiKey) {
    throw new Error("AeroAPI key is missing. Please set NEXT_PUBLIC_AEROAPI_KEY in your .env file.");
  }
  return apiKey;
}

// Maps the AeroAPI response to our app's FindFlightOutput format
function mapApiResponseToFlightOutput(apiData: any, inputFlightNumber: string): FindFlightOutput {
  if (!apiData || !apiData.flights || apiData.flights.length === 0) {
    return { flightFound: false, flightNumber: inputFlightNumber };
  }

  const flight = apiData.flights[0];

  const formatTime = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch (e) {
      console.warn("Invalid date for formatting:", dateStr, e);
      return undefined;
    }
  };

  return {
    flightFound: true,
    flightNumber: flight.ident,
    airline: flight.airline.name || flight.airline.shortname,
    departure: {
      airport: {
        code: flight.origin.code_iata,
        name: flight.origin.name,
        city: flight.origin.city,
      },
      time: {
        scheduled: formatTime(flight.scheduled_out)!,
        actual: formatTime(flight.actual_out),
      },
    },
    arrival: {
      airport: {
        code: flight.destination.code_iata,
        name: flight.destination.name,
        city: flight.destination.city,
      },
      time: {
        scheduled: formatTime(flight.scheduled_in)!,
        actual: formatTime(flight.actual_in),
      },
    },
    flightSegment: `${flight.origin.code_iata}/${flight.destination.code_iata}`,
  };
}


/**
 * Finds a flight by calling the AeroAPI.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  console.log("[SERVER] Calling AeroAPI for:", JSON.stringify(input, null, 2));

  try {
    const apiKey = getApiKey();
    const flightIdent = input.flightNumber.replace(/\s/g, '').toUpperCase();
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${flightIdent}?start=${input.date}`;
    
    console.log(`[SERVER] Fetching URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'x-apikey': apiKey
      },
      cache: 'no-store'
    });

    const responseBody = await response.json();

    if (!response.ok) {
        const errorMessage = responseBody.title || responseBody.detail || `API request failed with status ${response.status}.`;
        console.error("[SERVER] AeroAPI Error:", errorMessage, JSON.stringify(responseBody, null, 2));
        return { flightFound: false, flightNumber: input.flightNumber, errorMessage };
    }
    
    console.log("[SERVER] Found flight data from API:", JSON.stringify(responseBody, null, 2));
    const result = mapApiResponseToFlightOutput(responseBody, input.flightNumber);

    return {
        ...result,
        flightNumber: input.flightNumber, // Return the original requested number for consistency
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
