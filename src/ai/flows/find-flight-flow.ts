
'use server';
/**
 * @fileOverview A flight information retrieval agent using Genkit's AI capabilities.
 * This file defines the server action that clients call to find flight details.
 *
 * - findFlight - The exported server action to find flight details.
 */

import { flightExpertPrompt } from '@/ai/prompts/flight-expert-prompt';
import type { FindFlightInput, FindFlightOutput } from './flight-types';


// The exported function that will be the Server Action
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
    console.log("[SERVER] Recibido del cliente:", JSON.stringify(input, null, 2));

    const result = await flightExpertPrompt(input);
    
    console.log("[SERVER] Respuesta de la IA:", JSON.stringify(result.output, null, 2));
    
    if (!result.output || !result.output.flightFound) {
      return { flightFound: false };
    }
    return result.output;
}
