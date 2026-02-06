
"use client";

/**
 * @file serviceOrderService.ts
 * @description Re-exports all master data functions from specialized modules.
 * 
 * This file serves as the main public API for master data (guides, hotels, buses, flights, etc.)
 * and is backward-compatible with existing imports.
 * 
 * Internal implementation is split into:
 * - serviceOrderCache.ts - caching logic
 * - serviceOrderCRUD.ts - create, update, delete operations
 * - serviceOrderMasterData.ts - queries and data fetching
 */

// Re-export all interfaces and functions from master data module
export * from './serviceOrderMasterData';

/**
 * NOTE: This function is temporarily disabled as it depends on `flightSyncService` which has been removed.
 * Searches for a flight in the local Firestore database and returns a formatted ServiceItem.
 * @param flightNumber The flight number to search.
 * @param serviceDate The date of the service in dd/MM/yy format.
 * @param transferType 'TRF IN' or 'TRF OUT'.
 * @returns A promise that resolves to a partial ServiceItem with flight details.
 */
/*
export async function getFlightServiceDetails(
  flightNumber: string,
  serviceDate: string,
  transferType: 'TRF IN' | 'TRF OUT'
): Promise<Partial<ServiceItem>> {
  try {
    const date = parse(serviceDate, 'dd/MM/yy', new Date());
    const dateString = format(date, 'yyyy-MM-dd');
    const flight = await getFlightFromFirestore(flightNumber, dateString);

    if (!flight) {
      return { vuelo: flightNumber.toUpperCase() }; // Return flight number even if not found
    }

    let newTime = '';
    let newObservation = '';
    const segment = `${flight.departure.iata}/${flight.arrival.iata}`;

    if (transferType === 'TRF IN' && flight.arrival.actual) {
      const arrivalTime = flight.arrival.actual;
      const pickupTime = new Date(arrivalTime.getTime() - 1 * 60 * 60 * 1000); // 1 hour before
      newTime = format(pickupTime, 'HH:mm');
      newObservation = `EL VUELO LLEGA A LAS ${format(arrivalTime, 'HH:mm')} ${segment}`;
    } else if (transferType === 'TRF OUT' && flight.departure.actual) {
      const departureTime = flight.departure.actual;
      const pickupTime = new Date(departureTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
      newTime = format(pickupTime, 'HH:mm');
      newObservation = `EL VUELO SALE A LAS ${format(departureTime, 'HH:mm')} ${segment}`;
    }

    return {
      vuelo: flight.flight.iata,
      hora: newTime || flight.type === 'arrival' ? format(flight.arrival.scheduled, 'HH:mm') : format(flight.departure.scheduled, 'HH:mm'),
      observaciones: newObservation.trim(),
    };
  } catch (error) {
    console.error(`Error getting flight service details for ${flightNumber}:`, error);
    return { vuelo: flightNumber.toUpperCase() }; // Graceful fallback
  }
}
*/
