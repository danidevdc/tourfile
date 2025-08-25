
'use server';
/**
 * @fileOverview A flight information retrieval agent using Genkit's AI capabilities.
 * This file defines the server action that clients call to find flight details.
 *
 * - findFlight - The exported server action to find flight details.
 */

import { flightExpertPrompt, customGoogleSearchTool } from '@/ai/prompts/flight-expert-prompt';
import type { FindFlightInput, FindFlightOutput } from './flight-types';
import { z } from 'zod';
import { parse, format } from 'date-fns';
import { es } from 'date-fns/locale';


// The exported function that will be the Server Action
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
    console.log("[SERVER] Received from client:", JSON.stringify(input, null, 2));

    // --- 1. First Attempt: Search with the specific date ---
    
    // Parse the incoming YYYY-MM-DD date string
    const parsedDate = parse(input.date, 'yyyy-MM-dd', new Date());
    // Format the date into a more search-friendly, natural language format
    const friendlyDate = format(parsedDate, "d 'de' MMMM 'de' yyyy", { locale: es });
    // Construct a more natural search query
    const queryWithDate = `vuelo ${input.flightNumber.replace(/\s/g, '')} en ${friendlyDate}`;
    console.log(`[SERVER] Attempt 1: Constructed natural search query: ${queryWithDate}`);

    // Call the Google Search tool directly
    let searchResults = await customGoogleSearchTool.run({ query: queryWithDate });
    console.log("[SERVER] Snippets from Google Search (Attempt 1):", searchResults);
    
    let result = await flightExpertPrompt({ 
        flightNumber: input.flightNumber,
        searchResults: JSON.stringify(searchResults),
        searchContext: `Búsqueda para el ${friendlyDate}.`
    });
    
    // --- 2. Second Attempt (Fallback): If not found, search without the date ---
    if (!result.output || !result.output.flightFound) {
        console.log(`[SERVER] Flight not found with date. Fallback to searching with flight number only.`);
        const queryWithoutDate = `vuelo ${input.flightNumber.replace(/\s/g, '')}`;
        console.log(`[SERVER] Attempt 2: Constructed general query: ${queryWithoutDate}`);

        searchResults = await customGoogleSearchTool.run({ query: queryWithoutDate });
        console.log("[SERVER] Snippets from Google Search (Attempt 2):", searchResults);

        // Call the AI again with the new search results and a different context
        result = await flightExpertPrompt({
            flightNumber: input.flightNumber,
            searchResults: JSON.stringify(searchResults),
            searchContext: "Búsqueda general sin fecha específica. Devuelve la información más reciente que encuentres."
        });
    }

    console.log("[SERVER] Final AI response:", JSON.stringify(result.output, null, 2));
    
    if (!result.output || !result.output.flightFound) {
      return { flightFound: false, flightNumber: input.flightNumber };
    }
    
    // Ensure the flight number from the original input is in the final output
    return {
      ...result.output,
      flightNumber: input.flightNumber,
    };
}
