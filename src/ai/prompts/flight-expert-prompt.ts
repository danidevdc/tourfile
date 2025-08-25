
/**
 * @fileOverview Defines the Genkit prompt for the flight data expert.
 * This file defines the Genkit prompt for the flight data expert.
 */
import { ai } from '@/ai/genkit';
import { FindFlightOutputSchema } from '@/ai/flows/flight-types';
import { z } from 'zod';


// Define a new tool for custom Google Search
export const customGoogleSearchTool = ai.defineTool(
  {
    name: 'customGoogleSearch',
    description: 'Searches Google for real-time flight information. Use this to find flight statuses, departure/arrival times, and airline details.',
    inputSchema: z.object({
      query: z.string().describe("The search query, e.g., 'vuelo OB305 en 27 de agosto de 2025'"),
    }),
    outputSchema: z.any(), // The AI will handle the unstructured JSON response
  },
  async (input) => {
    console.log(`[TOOL] Executing custom Google search with query: ${input.query}`);
    const apiKey = process.env.GEMINI_API_KEY; // Use existing key
    const searchEngineId = process.env.SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      console.error("[TOOL] Missing GOOGLE_API_KEY or SEARCH_ENGINE_ID in .env file.");
      return { error: "Missing API key or Search Engine ID." };
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(input.query)}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorBody = await response.json();
        console.error(`[TOOL] Google Search API error: ${response.status}`, errorBody);
        return { error: `API request failed with status ${response.status}` };
      }
      const data = await response.json();
      
      // Instead of returning the full complex object, return a simplified list of snippets.
      // This gives the AI cleaner data to work with.
      if (data.items && data.items.length > 0) {
        const snippets = data.items.map((item: any) => item.snippet).filter(Boolean);
        console.log(`[TOOL] Returning ${snippets.length} snippets to AI.`);
        return snippets;
      }
      
      return []; // Return an empty array if no items are found
    } catch (e) {
      console.error("[TOOL] Fetch request to Google Search API failed:", e);
      return { error: "Failed to fetch search results." };
    }
  }
);

const FlightExpertInputSchema = z.object({
    flightNumber: z.string().describe("The original flight number the user asked for."),
    searchResults: z.string().describe("A JSON string containing snippets from a Google search."),
    searchContext: z.string().describe("Provides context on the type of search performed, e.g., for a specific date or a general search.")
});

export const flightExpertPrompt = ai.definePrompt({
  name: 'flightExpertPrompt',
  input: { schema: FlightExpertInputSchema },
  output: { schema: FindFlightOutputSchema },
  
  // Instructions for the AI model
  prompt: `
    You are a flight data expert. Your task is to analyze the provided Google search results
    and extract flight information.

    The user is looking for flight number: {{{flightNumber}}}.
    Context of the search: {{{searchContext}}}

    The search results are provided as a JSON string of text snippets:
    {{{searchResults}}}

    Based on these search results, you must extract the following information:
    - Departure airport details (code, name, city) and scheduled/actual departure time.
    - Arrival airport details (code, name, city) and scheduled/actual arrival time.
    - The name of the airline.
    - The flight route segment (e.g., 'LPB/VVI').

    If you find the flight in the search results, set flightFound to true and fill in all the details. 
    The 'flightNumber' field in your output MUST match the one the user asked for.

    If you cannot find any clear information about the flight in the snippets, set flightFound to false and leave the other fields empty.
  `,
});
