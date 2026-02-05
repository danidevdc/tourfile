import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { resetMockFirestore, setCollectionDocs } from '../test-utils/firestore-mock';
import { recordActivityTimeUsage, getSuggestedTimeForActivity } from '@/lib/serviceOrderService';

describe('Activity time usage and suggestions', () => {
  beforeEach(() => resetMockFirestore());

  it('recordActivityTimeUsage increments timeCounts and sets suggestedTime when threshold reached', async () => {
    setCollectionDocs('activities', [ { id: 'act1', data: { name: 'CITY TOUR', timeCounts: { '09:00': 1 } } } ] );

    // First call should bring count from 1 -> 2 and set suggestedTime
    await recordActivityTimeUsage('city tour', '09:00');

    const suggested = await getSuggestedTimeForActivity('city tour');
    expect(suggested).toBe('09:00');
  });

  it('getSuggestedTimeForActivity returns null when activity missing', async () => {
    resetMockFirestore();
    const s = await getSuggestedTimeForActivity('no existe');
    expect(s).toBeNull();
  });
});
