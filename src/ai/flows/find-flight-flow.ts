
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

    // --- User's Approach: Build the query directly in the code ---
    
    // Parse the incoming YYYY-MM-DD date string
    const parsedDate = parse(input.date, 'yyyy-MM-dd', new Date());

    // Format the date into a more search-friendly, natural language format
    // e.g., "27 de agosto de 2025"
    const friendlyDate = format(parsedDate, "d 'de' MMMM 'de' yyyy", { locale: es });

    // Construct a more natural search query
    const query = `vuelo ${input.flightNumber.replace(/\s/g, '')} en ${friendlyDate}`;

    console.log(`[SERVER] Constructed natural search query: ${query}`);

    // --- Call the Google Search tool directly ---
    const searchResults = await customGoogleSearchTool.run({ query });
    
    console.log("[SERVER] Snippets from Google Search:", searchResults);

    // --- Pass the search results to the AI for interpretation ---
    const result = await flightExpertPrompt({ 
        flightNumber: input.flightNumber,
        searchResults: JSON.stringify(searchResults) 
    });
    
    console.log("[SERVER] AI response:", JSON.stringify(result.output, null, 2));
    
    if (!result.output || !result.output.flightFound) {
      return { flightFound: false, flightNumber: input.flightNumber };
    }
    
    // Ensure the flight number from the original input is in the final output
    return {
      ...result.output,
      flightNumber: input.flightNumber,
    };
}

    