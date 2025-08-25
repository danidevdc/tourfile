
/**
 * @fileOverview Defines the Genkit prompt for the flight data expert.
 * This prompt uses the AI's built-in search tool to find flight data.
 */

import { ai } from '@/ai/genkit';
import { FindFlightInputSchema, FindFlightOutputSchema } from '@/ai/flows/flight-types';
import { googleAI } from '@genkit-ai/googleai';


export const flightExpertPrompt = ai.definePrompt({
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
  
  tools: [googleAI.googleSearchTool],
});

    