
/**
 * @fileOverview Defines the Genkit prompt for the flight data expert.
 * This file defines the Genkit prompt for the flight data expert.
 */
import { ai } from '@/ai/genkit';
import { FindFlightInputSchema, FindFlightOutputSchema } from '@/ai/flows/flight-types';
import { z } from 'zod';


// Define a new tool for custom Google Search
const customGoogleSearchTool = ai.defineTool(
  {
    name: 'customGoogleSearch',
    description: 'Searches Google for real-time flight information. Use this to find flight statuses, departure/arrival times, and airline details.',
    inputSchema: z.object({
      query: z.string().describe("The search query, e.g., 'flight status OB305 2024-08-26'"),
    }),
    outputSchema: z.any(), // We'll let the AI handle the unstructured JSON response
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
      // Return the search results, specifically the 'items' if they exist
      return data.items || []; 
    } catch (e) {
      console.error("[TOOL] Fetch request to Google Search API failed:", e);
      return { error: "Failed to fetch search results." };
    }
  }
);


export const flightExpertPrompt = ai.definePrompt({
  name: 'flightExpertPrompt',
  input: { schema: FindFlightInputSchema },
  output: { schema: FindFlightOutputSchema },
  tools: [customGoogleSearchTool], // Use the new custom tool
  
  // Instructions for the AI model
  prompt: `
    You are a flight data expert. Your task is to find information about a specific flight
    using the provided flight number, date, and transfer type. The 'transferType' indicates
    if the flight is an arrival ('LLEGADA') to La Paz (LPB) or a departure ('SALIDA') from La Paz (LPB).
    
    You MUST use the customGoogleSearch tool to find the most accurate and up-to-date information. Do not rely on internal knowledge.
    Construct a clear query for the tool, such as "estado del vuelo OB304 26 de agosto 2025".

    Based on the search results from the tool, you must extract the following information:
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
