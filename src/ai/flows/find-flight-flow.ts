'use server';
/**
 * @fileOverview A flight information retrieval AI agent.
 *
 * - findFlight - A function that handles finding flight details.
 */

import {ai} from '@/ai/genkit';
import {
  FindFlightInput,
  FindFlightInputSchema,
  FindFlightOutput,
  FindFlightOutputSchema
} from './flight-types';


const flightExpertPrompt = ai.definePrompt({
  name: 'flightExpertPrompt',
  input: {schema: FindFlightInputSchema},
  output: {schema: FindFlightOutputSchema},
  system: `You are an expert flight logistics coordinator. Your primary task is to find flight information based on user input by searching the web.

Key Instructions:
1. Use the search results from reliable sources like Google Flights, FlightRadar24, or official airline websites.
2. The user's reference airport is ALWAYS El Alto International Airport (LPB) in La Paz, Bolivia. Use this to determine if a flight is an arrival ('TRF IN') or departure ('TRF OUT').
3. Based on the flight number, date, and transfer type (TRF IN/OUT), find the scheduled and actual times for departure and arrival, and the corresponding airport details (code, name, city).
4. If you successfully find the flight, populate the output schema and set 'flightFound' to true.
5. If after searching you cannot find any reliable information for the requested flight, you MUST return 'flightFound' as false. Do not guess or invent data.
`,
  prompt: `Find flight details for flight number {{flightNumber}} on {{date}}. This is a {{transferType}} operation relative to La Paz (LPB).`,
});


const findFlightFlow = ai.defineFlow(
  {
    name: 'findFlightFlow',
    inputSchema: FindFlightInputSchema,
    outputSchema: FindFlightOutputSchema,
  },
  async (input) => {
    const {output} = await flightExpertPrompt(input);
    if (!output || !output.flightFound) {
      return { flightFound: false };
    }
    return output;
  }
);

export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  return findFlightFlow(input);
}
