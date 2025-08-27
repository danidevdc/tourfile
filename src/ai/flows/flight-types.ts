/**
 * @fileOverview Shared types for the flight-finding agent.
 * These types are used for API communication.
 */

import {z} from 'genkit';

// Schema for input when a user searches for a flight.
// Date is removed to comply with the free tier of AviationStack API.
export const FindFlightInputSchema = z.object({
  flightNumber: z.string().describe("The flight number to search for (e.g., 'OB304', 'AA923')."),
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
  actual: z.string().optional().describe("The actual or estimated time in HH:mm format."),
});

export const FindFlightOutputSchema = z.object({
  flightFound: z.boolean().describe('Whether a flight was successfully found.'),
  flightNumber: z.string().optional().describe("The flight number that was found (e.g., 'OB305')."),
  departure: z.object({
    airport: AirportInfoSchema,
    time: FlightTimeSchema,
  }).optional(),
  arrival: z.object({
    airport: AirportInfoSchema,
    time: FlightTimeSchema,
  }).optional(),
  airline: z.string().optional().describe("The name of the airline (e.g., 'Boliviana de Aviación')."),
  flightSegment: z.string().optional().describe("The flight route segment as 'DEPARTURE_CODE/ARRIVAL_CODE' (e.g., 'LPB/VVI')."),
  errorMessage: z.string().optional().describe("An error message if the search flow failed.")
});

export type FindFlightOutput = z.infer<typeof FindFlightOutputSchema>;
