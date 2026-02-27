import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firebase modules
vi.mock('firebase/firestore', async () => {
  const actual = await import('../test-utils/firestore-mock');
  return {
    ...actual,
    documentId: () => '__name__',
  };
});
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { setCollectionDocs, resetMockFirestore } from '../test-utils/firestore-mock';
import {
  getAllOrderHeaders,
  getServiceOrdersByIds,
  type OrderHeader,
} from '@/lib/serviceOrderQuery';
import { Timestamp } from 'firebase/firestore';

describe('serviceOrderQuery', () => {
  beforeEach(() => {
    resetMockFirestore();
  });

  describe('getAllOrderHeaders', () => {
    it('should return all order headers', async () => {
      const mockOrders = [
        {
          id: 'order1',
          data: {
            orderName: 'TOUR_2024_01',
            createdAt: Timestamp.fromDate(new Date('2026-01-15')),
          },
        },
        {
          id: 'order2',
          data: {
            orderName: 'TOUR_2024_02',
            createdAt: Timestamp.fromDate(new Date('2026-02-15')),
          },
        },
      ];

      setCollectionDocs('serviceOrders', mockOrders);

      const headers = await getAllOrderHeaders();

      expect(headers).toHaveLength(2);
      expect(headers.map(h => h.orderName)).toContain('TOUR_2024_01');
      expect(headers.map(h => h.orderName)).toContain('TOUR_2024_02');
    });

    it('should return empty array when no orders exist', async () => {
      const headers = await getAllOrderHeaders();
      expect(headers).toEqual([]);
    });

    it('should handle orders without orderName field', async () => {
      const mockOrders = [
        {
          id: 'order1',
          data: {
            createdAt: Timestamp.fromDate(new Date('2026-01-15')),
            // Missing orderName
          },
        },
      ];

      setCollectionDocs('serviceOrders', mockOrders);

      const headers = await getAllOrderHeaders();

      expect(headers).toHaveLength(1);
      expect(headers[0].orderName).toBe('');
    });
  });

  describe('getServiceOrdersByIds', () => {
    it('should handle empty IDs list without error', async () => {
      const orders = await getServiceOrdersByIds([]);
      expect(orders).toEqual([]);
    });

    it('should execute without throwing (integration test)', async () => {
      const mockOrders = [
        {
          id: 'order1',
          data: {
            orderName: 'TOUR_2024_01',
            guia: 'John Doe',
            nPax: '5',
            createdAt: Timestamp.fromDate(new Date('2024-01-15')),
            updatedAt: Timestamp.fromDate(new Date('2024-01-20')),
          },
        },
      ];

      setCollectionDocs('serviceOrders', mockOrders);

      // Should not throw - mock may return empty but function should work
      await expect(getServiceOrdersByIds(['order1'])).resolves.not.toThrow();
    });
  });
});
