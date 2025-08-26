
'use server';
/**
 * @fileOverview Client for the AviationStack API to find flight information.
 * This file replaces the previous AI-based implementation.
 *
 * - findFlight - The exported server action to find flight details using AviationStack.
 */
import { format, parse } from 'date-fns';
import type { FindFlightInput, FindFlightOutput } from './flight-types';


// Helper function to safely get the API key from environment variables
function getApiKey(): string {
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
        console.error("[SERVER] AviationStack API key is missing. Please set AVIATIONSTACK_API_KEY in your .env file.");
        throw new Error("AviationStack API key is not configured.");
    }
    return apiKey;
}

// Maps the flight data from AviationStack API to our app's format
function mapApiDataToFlightOutput(apiData: any): FindFlightOutput {
    if (!apiData) {
        return { flightFound: false };
    }

    // AviationStack returns times in UTC, so we can format them directly
    const formatTime = (dateString: string | null) => {
      if (!dateString) return undefined;
      try {
        return format(new Date(dateString), 'HH:mm');
      } catch (e) {
        return undefined;
      }
    };
    
    return {
        flightFound: true,
        flightNumber: apiData.flight?.iata,
        airline: apiData.airline?.name,
        departure: {
            airport: {
                code: apiData.departure?.iata,
                name: apiData.departure?.airport,
                city: apiData.departure?.timezone, // Often timezone represents the city area
            },
            time: {
                scheduled: formatTime(apiData.departure?.scheduled)!,
                actual: formatTime(apiData.departure?.actual || apiData.departure?.estimated),
            },
        },
        arrival: {
            airport: {
                code: apiData.arrival?.iata,
                name: apiData.arrival?.airport,
                city: apiData.arrival?.timezone,
            },
            time: {
                scheduled: formatTime(apiData.arrival?.scheduled)!,
                actual: formatTime(apiData.arrival?.actual || apiData.arrival?.estimated),
            },
        },
        flightSegment: `${apiData.departure?.iata}/${apiData.arrival?.iata}`,
    };
}


/**
 * Finds a flight by calling the AviationStack API.
 * This is a server action that can be called from client components.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
    console.log("[SERVER] Searching with AviationStack for:", JSON.stringify(input, null, 2));

    try {
        const apiKey = getApiKey();
        const baseUrl = 'http://api.aviationstack.com/v1/flights'; // Use http as per free plan
        
        const params = new URLSearchParams({
            access_key: apiKey,
            flight_iata: input.flightNumber.replace(/\s/g, ''),
            flight_date: format(parse(input.date, 'yyyy-MM-dd', new Date()), 'yyyy-MM-dd'),
            limit: '5' // Get a few results to find the best match
        });
        
        const url = `${baseUrl}?${params.toString()}`;
        console.log(`[SERVER] Calling AviationStack URL: ${url}`);

        const response = await fetch(url, { cache: 'no-store' }); // Disable caching for real-time data
        
        if (!response.ok) {
            const errorBody = await response.json();
            console.error("[SERVER] AviationStack API Error:", errorBody);
            const errorInfo = errorBody?.error?.info || `API request failed with status ${response.status}`;
            return {
                flightFound: false,
                flightNumber: input.flightNumber,
                errorMessage: `Error de API: ${errorInfo}`,
            };
        }

        const jsonResponse = await response.json();
        
        if (!jsonResponse.data || jsonResponse.data.length === 0) {
            console.log("[SERVER] No flight data returned from AviationStack.");
            return { flightFound: false, flightNumber: input.flightNumber };
        }
        
        // Find the most relevant flight from the results (e.g., non-codeshare)
        // AviationStack often returns the main flight first. We'll use that one.
        const flightData = jsonResponse.data.find((f: any) => f.flight.iata.toUpperCase() === input.flightNumber.toUpperCase().replace(/\s/g, '')) || jsonResponse.data[0];

        console.log("[SERVER] Found flight data:", JSON.stringify(flightData, null, 2));

        const result = mapApiDataToFlightOutput(flightData);

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
