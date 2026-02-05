import { describe, it, expect, beforeEach } from 'vitest';
import { clearMasterDataCache, checkForMasterDataUpdates } from '@/lib/serviceOrderService';

describe('Master data cache utilities', () => {
  beforeEach(() => {
    // Clear jsdom sessionStorage between tests
    sessionStorage.clear();
  });

  it('clearMasterDataCache should remove keys with cache prefix and version key', () => {
    sessionStorage.setItem('tourfile_cache_guides', JSON.stringify([{ id: 1 }]));
    sessionStorage.setItem('tourfile_cache_hotels', JSON.stringify([{ id: 2 }]));
    sessionStorage.setItem('tourfile_master_data_version', '5');

    expect(sessionStorage.getItem('tourfile_cache_guides')).not.toBeNull();
    expect(sessionStorage.getItem('tourfile_master_data_version')).toBe('5');

    clearMasterDataCache();

    expect(sessionStorage.getItem('tourfile_cache_guides')).toBeNull();
    expect(sessionStorage.getItem('tourfile_cache_hotels')).toBeNull();
    expect(sessionStorage.getItem('tourfile_master_data_version')).toBeNull();
  });

  it('checkForMasterDataUpdates returns false when remote version cannot be fetched (no db)', async () => {
    // If Firebase is not initialized in tests, getRemoteVersion will return 0
    sessionStorage.setItem('tourfile_master_data_version', '1');
    const changed = await checkForMasterDataUpdates();
    expect(changed).toBe(false);
  });
});
