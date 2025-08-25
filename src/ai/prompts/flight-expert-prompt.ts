
/**
 * @fileOverview Defines the Genkit prompt for the flight data expert and the custom search tool.
 */
import { ai } from '@/ai/genkit';
import { FindFlightOutputSchema } from '@/ai/flows/flight-types';
import { z } from 'zod';


// Define a new tool for custom Google Search based on user's improved approach.
export const customGoogleSearchTool = ai.defineTool(
  {
    name: 'customGoogleSearch',
    description: 'Searches Google for real-time flight information. Use this to find flight statuses, departure/arrival times, and airline details.',
    inputSchema: z.object({
      query: z.string().describe("The search query, e.g., 'vuelo OB305 en 27 de agosto de 2025'"),
    }),
    // Define a stricter output schema as suggested by the user.
    outputSchema: z.array(z.string()).describe("A list of search result snippets."),
  },
  async (input) => {
    console.log(`[TOOL] Executing custom Google search with query: ${input.query}`);
    
    // Use the correct API key for the Google Custom Search API, not the Gemini key.
    // The user will need to provide this in their .env file.
    const apiKey = process.env.GEMINI_API_KEY; 
    const searchEngineId = process.env.SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      const errorMsg = "[TOOL] Missing GEMINI_API_KEY or SEARCH_ENGINE_ID in .env file.";
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(input.query)}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        // Improved error logging to show the actual error from Google's API.
        console.error(`[TOOL] Google Search API error: ${response.status}`, data.error);
        throw new Error(data.error?.message || `API request failed with status ${response.status}`);
      }
      
      // Instead of returning the full complex object, return a simplified list of snippets.
      // This gives the AI cleaner data to work with.
      if (data.items && data.items.length > 0) {
        const snippets: string[] = data.items.map((item: any) => item.snippet).filter(Boolean);
        console.log(`[TOOL] Returning ${snippets.length} snippets to AI.`);
        return snippets;
      }
      
      console.log("[TOOL] No items found in search results.");
      return []; // Return an empty array if no items are found
    } catch (e: any) {
      console.error("[TOOL] Fetch request to Google Search API failed:", e);
      throw new Error(`Failed to fetch search results: ${e.message}`);
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
  tools: [customGoogleSearchTool], // The tool is available to the prompt
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

    Based *only* on these search results, you must extract the following information:
    - Departure airport details (code, name, city) and scheduled/actual departure time.
    - Arrival airport details (code, name, city) and scheduled/actual arrival time.
    - The name of the airline.
    - The flight route segment (e.g., 'LPB/VVI').

    If you find the flight in the search results, set flightFound to true and fill in all the details you can find. 
    The 'flightNumber' field in your output MUST match the original {{{flightNumber}}} the user asked for.

    If you cannot find any clear information about the flight in the snippets, set flightFound to false and leave all other fields empty.
  `,
});
