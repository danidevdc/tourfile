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
  system: `You are an expert flight logistics coordinator. Your primary task is to find real-time flight information based on user input.

Key Instructions:
1.  You MUST use your web search capabilities to get accurate, real-time flight information.
2.  Prioritize searching on Google Flights first. If you cannot find the information there, use FlightRadar24 as a secondary source.
3.  The user's reference airport is ALWAYS El Alto International Airport (LPB) in La Paz, Bolivia. Use this to determine if a flight is an arrival ('TRF IN') or departure ('TRF OUT').
4.  Based on the flight number, date, and transfer type (TRF IN/OUT), find the scheduled and actual times for departure and arrival, and the corresponding airport details (code, name, city).
5.  If you successfully find the flight, populate the output schema and set 'flightFound' to true.
6.  If after searching you cannot find any information for the requested flight, you MUST return 'flightFound' as false. Do not guess or invent data.
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
