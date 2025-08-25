'use server';
/**
 * @fileOverview A flight information retrieval AI agent.
 *
 * - findFlight - A function that handles finding flight details.
 * - FindFlightInput - The input type for the findFlight function.
 * - FindFlightOutput - The return type for the findFlight function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {format} from 'date-fns';

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


const findRealFlightInfoTool = ai.defineTool(
  {
    name: 'findRealFlightInfo',
    description: 'Searches for real-time flight information for a given flight number and date. The primary airport of reference, unless specified otherwise, is El Alto International Airport (LPB) in La Paz, Bolivia.',
    inputSchema: FindFlightInputSchema,
    outputSchema: FindFlightOutputSchema,
  },
  async (input) => {
    // In a real application, this would make an API call to a flight data provider.
    // For this demonstration, we will return realistic mock data.
    console.log(`Tool: Simulating flight search for ${input.flightNumber} on ${input.date}`);

    // Mock data simulation based on flight number
    const mocks: {[key: string]: Partial<FindFlightOutput>} = {
        'OB304': {
            flightFound: true,
            airline: 'Boliviana de Aviación',
            departure: { airport: { code: 'LPB', name: 'El Alto International', city: 'La Paz' }, time: { scheduled: '07:40', actual: '07:45' } },
            arrival: { airport: { code: 'UYU', name: 'Joya Andina Airport', city: 'Uyuni' }, time: { scheduled: '08:40', actual: '08:48' } },
        },
        'AV638': {
            flightFound: true,
            airline: 'Avianca',
            departure: { airport: { code: 'BOG', name: 'El Dorado International', city: 'Bogota' }, time: { scheduled: '14:00', actual: '14:00' } },
            arrival: { airport: { code: 'LPB', name: 'El Alto International', city: 'La Paz' }, time: { scheduled: '17:00', actual: '17:00' } },
        },
        'AA923': {
            flightFound: true,
            airline: 'American Airlines',
            departure: { airport: { code: 'MIA', name: 'Miami International', city: 'Miami' }, time: { scheduled: '21:30', actual: '21:35' } },
            arrival: { airport: { code: 'LPB', name: 'El Alto International', city: 'La Paz' }, time: { scheduled: '05:00', actual: '05:05' } },
        }
    };
    
    const flightKey = input.flightNumber.toUpperCase().trim();
    return (mocks[flightKey] as FindFlightOutput) || { flightFound: false };
  }
);


const prompt = ai.definePrompt({
  name: 'findFlightPrompt',
  input: {schema: FindFlightInputSchema},
  output: {schema: FindFlightOutputSchema},
  tools: [findRealFlightInfoTool],
  prompt: `Based on the user's request for flight number {{flightNumber}} on {{date}} for a {{transferType}}, use the findRealFlightInfo tool to get the flight details. Your primary reference airport is El Alto (LPB). Return the full details provided by the tool. If the flight is not found, ensure flightFound is false.`,
});

const findFlightFlow = ai.defineFlow(
  {
    name: 'findFlightFlow',
    inputSchema: FindFlightInputSchema,
    outputSchema: FindFlightOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output || !output.flightFound) {
      return { flightFound: false };
    }
    return output;
  }
);

export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  return findFlightFlow(input);
}
