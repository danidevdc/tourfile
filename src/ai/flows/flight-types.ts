/**
 * @fileOverview Shared types for the flight-finding AI agent.
 */

import {z} from 'genkit';

const AirportSchema = z.object({
  code: z.string().describe('The 3-letter IATA code for the airport (e.g., LPB, MIA).'),
  name: z.string().describe('The full name of the airport (e.g., El Alto International Airport).'),
  city: z.string().describe('The city where the airport is located.'),
});

const FlightTimeSchema = z.object({
  scheduled: z.string().describe('The scheduled time in HH:mm format.'),
  actual: z.string().describe('The actual or estimated time in HH:mm format.'),
});

export const FindFlightInputSchema = z.object({
  flightNumber: z.string().describe('The flight number to search for (e.g., OB304, AA923).'),
  date: z.string().describe('The date of the flight in yyyy-MM-dd format.'),
  transferType: z.enum(['TRF IN', 'TRF OUT']).describe('Whether the flight is an arrival (TRF IN) or a departure (TRF OUT) relative to the primary airport.'),
});
export type FindFlightInput = z.infer<typeof FindFlightInputSchema>;

export const FindFlightOutputSchema = z.object({
  flightFound: z.boolean().describe('Whether a flight was successfully found.'),
  departure: z.object({
    airport: AirportSchema,
    time: FlightTimeSchema,
  }).optional(),
  arrival: z.object({
    airport: AirportSchema,
    time: FlightTimeSchema,
  }).optional(),
  airline: z.string().optional().describe('The name of the airline.'),
});
export type FindFlightOutput = z.infer<typeof FindFlightOutputSchema>;
