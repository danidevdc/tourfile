
'use server';
/**
 * @fileOverview A flight information retrieval agent using Genkit's AI capabilities.
 * This agent uses the AI's built-in search tool to find flight data and extracts it into a structured format.
 *
 * - findFlight - A function that handles finding flight details.
 */

import { ai } from '@/ai/genkit';
import { FindFlightInputSchema, FindFlightOutputSchema, type FindFlightInput, type FindFlightOutput } from './flight-types';

const flightExpertPrompt = ai.definePrompt({
  name: 'flightExpertPrompt',
  input: { schema: FindFlightInputSchema },
  output: { schema: FindFlightOutputSchema },
  
  // Instructions for the AI model
  prompt: `
    You are a flight data expert. Your task is to find information about a specific flight
    using the provided flight number and date. You MUST use your search tool to find the most accurate
    and up-to-date information from reliable sources like Google Flights, FlightAware, or FlightRadar24.

    Based on the search results, you must extract the following information:
    - Departure airport code and scheduled departure time.
    - Arrival airport code and scheduled arrival time.
    - The name of the airline.
    - The flight route segment (e.g., 'LPB/VVI').

    If you find the flight, set flightFound to true and fill in all the details.
    If you cannot find any information about the flight after searching, set flightFound to false and leave the other fields empty.

    Flight Number: {{{flightNumber}}}
    Date: {{{date}}}
  `,
  
  // Configuration to enable the search tool
  config: {
    tools: [ai.tool.googleSearch()],
  },
});

const findFlightFlow = ai.defineFlow(
  {
    name: 'findFlightFlow',
    inputSchema: FindFlightInputSchema,
    outputSchema: FindFlightOutputSchema,
  },
  async (input) => {
    const { output } = await flightExpertPrompt(input);
    if (!output || !output.flightFound) {
      return { flightFound: false };
    }
    return output;
  }
);


// Exported async wrapper function to be used as a Server Action
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  // Execute the flow and return its output.
  // This wrapper ensures Next.js can correctly handle the server action.
  return findFlightFlow(input);
}
