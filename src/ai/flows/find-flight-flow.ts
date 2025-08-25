'use server';
/**
 * @fileOverview A flight information retrieval AI agent.
 *
 * - findFlight - A function that handles finding flight details.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  FindFlightInput,
  FindFlightInputSchema,
  FindFlightOutput,
  FindFlightOutputSchema
} from './flight-types';


const searchGoogleFlights = ai.defineTool(
  {
    name: 'searchGoogleFlights',
    description: 'Searches for flight information on Google Flights for a specific flight number and date.',
    inputSchema: z.object({
      flightNumber: z.string().describe("The flight number, e.g., OB304."),
      date: z.string().describe("The date of the flight in YYYY-MM-DD format."),
    }),
    outputSchema: z.string(),
  },
  async ({flightNumber, date}) => {
    // This is a placeholder for a real web search implementation.
    // In a real scenario, this would use a library like Cheerio or Puppeteer
    // to scrape the results from the constructed URL.
    // For now, it returns a string indicating the search query.
    return `Simulated search for ${flightNumber} on ${date} at https://www.google.com/flights?q=${encodeURIComponent(flightNumber + ' ' + date)}`;
  }
);


const flightExpertPrompt = ai.definePrompt({
  name: 'flightExpertPrompt',
  input: {schema: FindFlightInputSchema},
  output: {schema: FindFlightOutputSchema},
  tools: [searchGoogleFlights],
  system: `You are an expert flight logistics coordinator. Your primary task is to find real-time flight information based on user input.

Key Instructions:
1.  You MUST use the 'searchGoogleFlights' tool to get flight information. Do not use any other method.
2.  The user's reference airport is ALWAYS El Alto International Airport (LPB) in La Paz, Bolivia. Use this to determine if a flight is an arrival ('TRF IN') or departure ('TRF OUT').
3.  Based on the flight number, date, and transfer type (TRF IN/OUT) found using the tool, find the scheduled and actual times for departure and arrival, and the corresponding airport details (code, name, city).
4.  If you successfully find the flight, populate the output schema and set 'flightFound' to true.
5.  If after using the tool you cannot find any information for the requested flight, you MUST return 'flightFound' as false. Do not guess or invent data.
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
