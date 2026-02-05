import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { resetMockFirestore, setCollectionDocs } from '../test-utils/firestore-mock';
import { createGuide, createHotel, createActivity, createDriver, createFlight, updateGuide, updateHotel, deleteGuide, deleteHotel } from '@/lib/serviceOrderService';
import { getGuidesFromFirestore, getHotelsFromFirestore } from '@/lib/serviceOrderService';

describe('CRUD operations (create/update/delete)', () => {
  beforeEach(() => resetMockFirestore());

  it('createGuide and getGuidesFromFirestore should reflect new guide', async () => {
    setCollectionDocs('appConfig', [{ id: 'masterDataVersion', data: { version: 1 } }]);
    await createGuide({ firstName: 'Luis', lastName: 'Gomez' } as any);
    const guides = await getGuidesFromFirestore();
    expect(guides.some(g => g.fullName.includes('LUIS'))).toBe(true);
  });

  it('createHotel then updateHotel and deleteHotel flow', async () => {
    setCollectionDocs('appConfig', [{ id: 'masterDataVersion', data: { version: 1 } }]);
    await createHotel('MiHotel');
    let hotels = await getHotelsFromFirestore();
    const created = hotels.find(h => h.name === 'MIHOTEL');
    expect(created).toBeTruthy();

    // update
    await updateHotel(created!.id, 'MiHotelUpdated');
    hotels = await getHotelsFromFirestore();
    expect(hotels.some(h => h.name === 'MIHOTELUPDATED')).toBe(true);

    // delete
    await deleteHotel(created!.id);
    hotels = await getHotelsFromFirestore();
    expect(hotels.some(h => h.id === created!.id)).toBe(false);
  });

  it('createActivity/createDriver/createFlight should not throw', async () => {
    setCollectionDocs('appConfig', [{ id: 'masterDataVersion', data: { version: 1 } }]);
    await createActivity('NewAct');
    await createDriver('Driver1');
    await createFlight({ flightNumber: 'X123', time: '12:00', observations: '' } as any);
  });
});
