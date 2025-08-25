'use server';
/**
 * @fileOverview A flight information retrieval AI agent.
 * This agent uses a tool-based approach to first perform a targeted web search
 * for a flight and then extracts structured data from the results.
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
  // By enabling the googleSearch tool, we instruct the model to use it when needed
  // to fulfill the user's request. This is more reliable than a generic instruction.
  tools: [ai.googleSearch],
  system: `You are an expert flight logistics coordinator. Your primary task is to find flight information based on a flight number and date by searching the web.

You will be given a flight number, a date, and a transfer type.
Your task is to use your search tool to find the flight details and then extract the following information:
1. The scheduled departure and arrival times.
2. The departure and arrival airport codes (e.g., LPB, VVI).
3. The name of the airline.

Key Instructions:
- Based on the flight number, date, and transfer type (TRF IN/OUT), find the scheduled and actual times for departure and arrival.
- Populate the output schema with the data you find. The 'flightSegment' should be in the format 'DEPARTURE_CODE/ARRIVAL_CODE'.
- The user's reference airport is ALWAYS El Alto International Airport (LPB) in La Paz, Bolivia.
- If you successfully find the flight, populate the output schema and set 'flightFound' to true.
- If after searching you cannot find any reliable information for the requested flight, you MUST return 'flightFound' as false. Do not guess or invent data.
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
