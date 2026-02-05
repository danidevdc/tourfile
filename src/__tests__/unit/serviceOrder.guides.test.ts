import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { resetMockFirestore, setCollectionDocs } from '../test-utils/firestore-mock';
import { getGuidesFromFirestore, getHotelsFromFirestore, getActivitiesFromFirestore, getDriversFromFirestore, getFlightsFromFirestore } from '@/lib/serviceOrderService';

describe('Read helpers (guides/hotels/activities/drivers/flights)', () => {
  beforeEach(() => resetMockFirestore());

  it('getGuidesFromFirestore uppercases names and returns fullName sorted', async () => {
    setCollectionDocs('guides', [
      { id: 'g1', data: { firstName: 'juan', lastName: 'perez' } },
      { id: 'g2', data: { firstName: 'ana', lastName: 'lopez' } }
    ]);

    const guides = await getGuidesFromFirestore();
    expect(guides.length).toBe(2);
    expect(guides[0].fullName).toMatch(/[A-Z]+/);
    expect(guides.some(g => g.fullName.includes('JUAN'))).toBe(true);
  });

  it('getHotelsFromFirestore uppercases hotel names and sorts', async () => {
    setCollectionDocs('hotels', [
      { id: 'h1', data: { name: 'Hotel b' } },
      { id: 'h2', data: { name: 'Hotel a' } }
    ]);

    const hotels = await getHotelsFromFirestore();
    expect(hotels[0].name).toBe('HOTEL A');
  });

  it('getActivitiesFromFirestore includes suggestedTime and uppercases', async () => {
    setCollectionDocs('activities', [
      { id: 'a1', data: { name: 'city tour', suggestedTime: '09:00' } }
    ]);

    const acts = await getActivitiesFromFirestore();
    expect(acts[0].name).toBe('CITY TOUR');
    expect(acts[0].suggestedTime).toBe('09:00');
  });

  it('getDriversFromFirestore uppercases names', async () => {
    setCollectionDocs('drivers', [ { id: 'd1', data: { name: 'juan' } } ]);
    const drivers = await getDriversFromFirestore();
    expect(drivers[0].name).toBe('JUAN');
  });

  it('getFlightsFromFirestore returns flight objects sorted by flightNumber', async () => {
    setCollectionDocs('flights', [
      { id: 'f1', data: { flightNumber: 'B200', time: '10:00' } },
      { id: 'f2', data: { flightNumber: 'A100', time: '08:00' } }
    ]);

    const flights = await getFlightsFromFirestore();
    expect(flights[0].flightNumber).toBe('A100');
  });
});
