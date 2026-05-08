
/**
 * @fileOverview Shared types for the flight-finding agent.
 * These types are used for API communication.
 */

import {z} from 'genkit';

// Schema for input when a user searches for a flight.
export const FlightSearchProviderSchema = z.enum(['aeroapi', 'google_flights_hybrid', 'naabol']);
export type FlightSearchProvider = z.infer<typeof FlightSearchProviderSchema>;

export const FlightRouteHintSchema = z.object({
  origin: z.string().length(3).describe("Origin airport IATA code."),
  destination: z.string().length(3).describe("Destination airport IATA code."),
});
export type FlightRouteHint = z.infer<typeof FlightRouteHintSchema>;

export const FindFlightInputSchema = z.object({
  flightNumber: z.string().describe("The flight number to search for (e.g., 'OB304', 'AA923')."),
  date: z.string().describe("The date of the flight in 'YYYY-MM-DD' format."),
  provider: FlightSearchProviderSchema.optional().describe("The flight data provider to use."),
  routeHint: FlightRouteHintSchema.optional().describe("Known route used by Google Flights hybrid provider."),
  routeDurationMinutes: z.number().int().positive().optional().describe("Known duration for the route, used to estimate missing NAABOL times."),
});
export type FindFlightInput = z.infer<typeof FindFlightInputSchema>;


// --- Schema for the output provided to the user ---
const AirportInfoSchema = z.object({
  code: z.string().optional().describe('The 3-letter IATA code for the airport (e.g., LPB, MIA).'),
  name: z.string().optional().describe('The full name of the airport (e.g., El Alto International Airport).'),
  city: z.string().optional().describe('The city where the airport is located.'),
});

const FlightTimeSchema = z.object({
  scheduled: z.string().describe("The scheduled time in HH:mm format."),
  scheduledDate: z.string().optional().describe("The scheduled date in DD/MM/YYYY format, converted to Bolivia local time."),
});

export const FindFlightOutputSchema = z.object({
  flightFound: z.boolean().describe('Whether a flight was successfully found.'),
  flightNumber: z.string().optional().describe("The flight number that was found (e.g., 'AAL923')."),
  departure: z.object({
    airport: AirportInfoSchema,
    time: FlightTimeSchema,
  }).optional(),
  arrival: z.object({
    airport: AirportInfoSchema,
    time: FlightTimeSchema,
  }).optional(),
  flightSegment: z.string().optional().describe("The flight route segment as 'DEPARTURE_CODE/ARRIVAL_CODE' (e.g., 'MIA/LPB')."),
  provider: FlightSearchProviderSchema.optional().describe("Provider that produced the result."),
  errorMessage: z.string().optional().describe("An error message if the search flow failed.")
});

export type FindFlightOutput = z.infer<typeof FindFlightOutputSchema>;
