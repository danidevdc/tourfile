
'use server';
/**
 * @fileOverview Finds real-time flight information by calling the FlightAware AeroAPI.
 *
 * - findFlight - The exported server action to find flight details.
 */
import { addDays, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { formatTime, formatISO } from '@/lib/date-utils';
import type { FindFlightInput, FindFlightOutput, FlightRouteHint } from './flight-types';


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
      // AeroAPI returns ISO 8601 with UTC offset (e.g. "2026-04-23T13:10:00Z").
      // Convert to Bolivia local time (America/La_Paz = UTC-4, no DST).
      const utcDate = parseISO(dateStr);
      const localDate = toZonedTime(utcDate, 'America/La_Paz');
      return formatTime(localDate);
    } catch (e) {
      console.error(`Error formatting date: ${dateStr}`, e);
      return undefined;
    }
  };

  const formatDateWithTimezone = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      const utcDate = parseISO(dateStr);
      const localDate = toZonedTime(utcDate, 'America/La_Paz');
      const day = String(localDate.getDate()).padStart(2, '0');
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const year = localDate.getFullYear();
      return `${day}/${month}/${year}`;
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
        scheduledDate: formatDateWithTimezone(flight.scheduled_out),
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
        scheduledDate: formatDateWithTimezone(flight.scheduled_in),
      },
    },
    flightSegment: `${flight.origin?.code_iata}/${flight.destination?.code_iata}`,
    provider: 'aeroapi',
  };
}

interface GoogleFlightsProxyLeg {
  flightNumber?: string;
  airline?: string;
  origin?: string;
  originName?: string;
  originCity?: string;
  destination?: string;
  destinationName?: string;
  destinationCity?: string;
  departureTime?: string;
  departureDate?: string;
  arrivalTime?: string;
  arrivalDate?: string;
}

interface GoogleFlightsProxyResponse {
  flightFound?: boolean;
  flightNumber?: string;
  flightSegment?: string;
  errorMessage?: string;
  leg?: GoogleFlightsProxyLeg;
}

async function findFlightWithGoogleFlights(
  input: FindFlightInput,
  routeHint: FlightRouteHint
): Promise<FindFlightOutput> {
  const proxyUrl = process.env.GOOGLE_FLIGHTS_PROXY_URL;
  if (!proxyUrl) {
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'google_flights_hybrid',
      errorMessage: 'Google Flights experimental no está configurado. Falta GOOGLE_FLIGHTS_PROXY_URL.',
    };
  }

  try {
    const flightIdent = normalizeIdent(input.flightNumber);
    const endpoint = proxyUrl.endsWith('/search-flight')
      ? proxyUrl
      : `${proxyUrl.replace(/\/$/, '')}/search-flight`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        flightNumber: flightIdent,
        date: input.date,
        origin: routeHint.origin,
        destination: routeHint.destination,
      }),
    });

    const payload = await response.json() as GoogleFlightsProxyResponse;
    if (!response.ok || payload.errorMessage) {
      return {
        flightFound: false,
        flightNumber: input.flightNumber,
        provider: 'google_flights_hybrid',
        errorMessage: payload.errorMessage || 'Google Flights experimental no pudo completar la búsqueda.',
      };
    }

    const leg = payload.leg;
    if (!payload.flightFound || !leg) {
      return {
        flightFound: false,
        flightNumber: input.flightNumber,
        provider: 'google_flights_hybrid',
        errorMessage: `Google Flights no encontró el vuelo ${input.flightNumber} para esta fecha.`,
      };
    }

    return {
      flightFound: true,
      flightNumber: payload.flightNumber || leg.flightNumber || flightIdent,
      departure: {
        airport: {
          code: leg.origin || routeHint.origin,
          name: leg.originName,
          city: leg.originCity || leg.origin || routeHint.origin,
        },
        time: {
          scheduled: leg.departureTime || '--:--',
          scheduledDate: leg.departureDate,
        },
      },
      arrival: {
        airport: {
          code: leg.destination || routeHint.destination,
          name: leg.destinationName,
          city: leg.destinationCity || leg.destination || routeHint.destination,
        },
        time: {
          scheduled: leg.arrivalTime || '--:--',
          scheduledDate: leg.arrivalDate,
        },
      },
      flightSegment: payload.flightSegment || `${routeHint.origin}/${routeHint.destination}`,
      provider: 'google_flights_hybrid',
    };
  } catch (error) {
    console.error('[GOOGLE_FLIGHTS] Proxy search failed:', error);
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'google_flights_hybrid',
      errorMessage: 'Google Flights experimental no respondió. Revisa el proxy configurado.',
    };
  }
}


/**
 * Finds a flight by calling the AeroAPI.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  try {
    if (input.provider === 'google_flights_hybrid' && input.routeHint) {
      return findFlightWithGoogleFlights(input, input.routeHint);
    }

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
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${flightIdent}?start=${startDate}&end=${endDate}&max_pages=1`;
    
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
