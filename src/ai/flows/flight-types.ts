/**
 * @fileOverview Shared types for the flight-finding AI agent.
 */

import {z} from 'genkit';

const AirportInfoSchema = z.object({
  code: z.string().describe('The 3-letter IATA code for the airport (e.g., LPB, MIA).'),
  name: z.string().optional().describe('The full name of the airport (e.g., El Alto International Airport).'),
  city: z.string().optional().describe('The city where the airport is located.'),
});

const FlightTimeSchema = z.object({
  scheduled: z.string().describe("The scheduled time in HH:mm format."),
  actual: z.string().describe("The actual or estimated time in HH:mm format."),
});

export const FindFlightInputSchema = z.object({
  flightNumber: z.string().describe("The flight number to search for (e.g., 'OB304', 'AA923')."),
  date: z.string().describe("The date of the flight in yyyy-MM-dd format."),
});
export type FindFlightInput = z.infer<typeof FindFlightInputSchema>;


export const FindFlightOutputSchema = z.object({
  flightFound: z.boolean().describe('Whether a flight was successfully found based on the search results.'),
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
  flightSegment: z.string().optional().describe("The flight route segment as 'DEPARTURE_CODE/ARRIVAL_CODE' (e.g., 'LPB/VVI').")
});

export type FindFlightOutput = z.infer<typeof FindFlightOutputSchema>;
