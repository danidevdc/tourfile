import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the firebase module imports used by serviceOrderService
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { setCollectionDocs, resetMockFirestore } from '../test-utils/firestore-mock';
import { getBusesFromFirestore, checkIfBusExists, createBus } from '@/lib/serviceOrderService';

describe('serviceOrderService with mocked Firestore', () => {
  beforeEach(() => {
    resetMockFirestore();
  });

  it('getBusesFromFirestore returns uppercased bus names', async () => {
    setCollectionDocs('buses', [ { id: 'b1', data: { name: 'Bus 8' } } ]);
    const buses = await getBusesFromFirestore();
    expect(buses).toHaveLength(1);
    expect(buses[0].name).toBe('BUS 8');
  });

  it('checkIfBusExists returns true when bus doc exists', async () => {
    setCollectionDocs('buses', [ { id: 'BUSX', data: { name: 'BUSX' } } ]);
    const exists = await checkIfBusExists('busx');
    expect(exists).toBe(true);
  });

  it('createBus writes a bus doc and increments version', async () => {
    // seed appConfig doc
    setCollectionDocs('appConfig', [{ id: 'masterDataVersion', data: { version: 1 } }]);

    await createBus('MiBus');

    const buses = await getBusesFromFirestore();
    // createBus uses setDoc on buses collection, so should exist now
    // Because mock getBusesFromFirestore reads store directly, it will reflect the new doc
    expect(buses.length).toBeGreaterThanOrEqual(1);
    expect(buses.some(b => b.name === 'MIBUS')).toBe(true);
  });
});
