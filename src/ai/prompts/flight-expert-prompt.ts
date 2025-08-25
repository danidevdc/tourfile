
/**
 * @fileOverview Defines the Genkit prompt for the flight data expert.
 * This file defines the Genkit prompt for the flight data expert.
 */
import { ai } from '@/ai/genkit';
import { FindFlightInputSchema, FindFlightOutputSchema } from '@/ai/flows/flight-types';


export const flightExpertPrompt = ai.definePrompt({
  name: 'flightExpertPrompt',
  input: { schema: FindFlightInputSchema },
  output: { schema: FindFlightOutputSchema },
  
  // Instructions for the AI model
  prompt: `
    You are a flight data expert. Your task is to find information about a specific flight
    using the provided flight number, date, and transfer type. The 'transferType' indicates
    if the flight is an arrival ('TRF IN') to La Paz (LPB) or a departure ('TRF OUT') from La Paz (LPB).
    
    You must use your internal knowledge to find the most accurate and up-to-date information.

    Based on the search results, you must extract the following information:
    - The flight number you searched for.
    - Departure airport details (code, name, city) and scheduled/actual departure time.
    - Arrival airport details (code, name, city) and scheduled/actual arrival time.
    - The name of the airline.
    - The flight route segment (e.g., 'LPB/VVI').

    If you find the flight, set flightFound to true and fill in all the details, including the flightNumber field.
    If you cannot find any information about the flight after searching, set flightFound to false and leave the other fields empty.

    Flight Number: {{{flightNumber}}}
    Date: {{{date}}}
    Transfer Type: {{{transferType}}}
  `,
});
