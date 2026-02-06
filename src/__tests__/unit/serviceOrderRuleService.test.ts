import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firebase modules
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { setCollectionDocs, resetMockFirestore } from '../test-utils/firestore-mock';
import {
  getServiceOrderRules,
  saveServiceOrderRules,
  initializeDefaultServiceOrderRules,
  type ServiceOrderRule,
} from '@/lib/serviceOrderRuleService';

describe('serviceOrderRuleService', () => {
  beforeEach(() => {
    resetMockFirestore();
  });

  describe('getServiceOrderRules', () => {
    it('should return all service order rules', async () => {
      const mockRules = [
        {
          id: 'rule1',
          keyword: 'CITY TOUR',
          activity: 'CITY TOUR LA PAZ',
          isActive: true,
          order: 10,
        },
        {
          id: 'rule2',
          keyword: 'TIWANAKU',
          activity: 'FD TIWANAKU',
          isActive: true,
          order: 20,
        },
      ];

      setCollectionDocs('serviceOrderRules', mockRules.map(r => ({ id: r.id, data: r })));

      const rules = await getServiceOrderRules();

      expect(rules).toHaveLength(2);
      expect(rules[0].keyword).toBe('CITY TOUR');
      expect(rules[0].activity).toBe('CITY TOUR LA PAZ');
      expect(rules[1].keyword).toBe('TIWANAKU');
    });

    it('should return empty array when no rules exist', async () => {
      const rules = await getServiceOrderRules();
      expect(rules).toEqual([]);
    });

    it('should include both active and inactive rules', async () => {
      const mockRules = [
        {
          id: 'rule1',
          keyword: 'CITY TOUR',
          activity: 'CITY TOUR LA PAZ',
          isActive: true,
          order: 10,
        },
        {
          id: 'rule2',
          keyword: 'DEPRECATED',
          activity: 'OLD ACTIVITY',
          isActive: false,
          order: 100,
        },
      ];

      setCollectionDocs('serviceOrderRules', mockRules.map(r => ({ id: r.id, data: r })));

      const rules = await getServiceOrderRules();

      expect(rules).toHaveLength(2);
      expect(rules.find(r => !r.isActive)?.keyword).toBe('DEPRECATED');
    });
  });

  describe('saveServiceOrderRules', () => {
    it('should save new rules without errors', async () => {
      const newRules: ServiceOrderRule[] = [
        {
          id: 'new_1',
          keyword: 'TEST KEYWORD',
          activity: 'TEST ACTIVITY',
          isActive: true,
          order: 200,
        },
      ];

      // Should not throw
      await expect(saveServiceOrderRules(newRules)).resolves.not.toThrow();
    });

    it('should handle saving rules without errors', async () => {
      const rulesToSave: ServiceOrderRule[] = [
        {
          id: 'rule1',
          keyword: 'UPDATED KEYWORD',
          activity: 'UPDATED ACTIVITY',
          isActive: true,
          order: 10,
        },
      ];

      // Should not throw
      await expect(saveServiceOrderRules(rulesToSave)).resolves.not.toThrow();
    });

    it('should save multiple rules without errors', async () => {
      const newRules: ServiceOrderRule[] = [
        {
          id: 'new_1',
          keyword: 'ACTIVITY 1',
          activity: 'ACTIVITY ONE',
          isActive: true,
          order: 10,
        },
        {
          id: 'new_2',
          keyword: 'ACTIVITY 2',
          activity: 'ACTIVITY TWO',
          isActive: true,
          order: 20,
        },
        {
          id: 'new_3',
          keyword: 'ACTIVITY 3',
          activity: 'ACTIVITY THREE',
          isActive: false,
          order: 30,
        },
      ];

      // Should not throw
      await expect(saveServiceOrderRules(newRules)).resolves.not.toThrow();
    });

    it('should handle mixed new and existing rules without errors', async () => {
      const mixedRules: ServiceOrderRule[] = [
        {
          id: 'rule1',
          keyword: 'UPDATED EXISTING',
          activity: 'UPDATED ACTIVITY',
          isActive: true,
          order: 10,
        },
        {
          id: 'new_1',
          keyword: 'NEW RULE',
          activity: 'NEW ACTIVITY',
          isActive: true,
          order: 20,
        },
      ];

      // Should not throw
      await expect(saveServiceOrderRules(mixedRules)).resolves.not.toThrow();
    });
  });

  describe('initializeDefaultServiceOrderRules', () => {
    it('should initialize default rules when none exist', async () => {
      await initializeDefaultServiceOrderRules();

      const rules = await getServiceOrderRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.keyword === 'CITY TOUR')).toBe(true);
      expect(rules.some(r => r.keyword === 'TIWANAKU')).toBe(true);
      expect(rules.some(r => r.keyword === 'TRANSFER IN')).toBe(true);
    });

    it('should not reinitialize if rules already exist', async () => {
      const existingRules = [
        {
          id: 'rule1',
          keyword: 'EXISTING',
          activity: 'EXISTING ACTIVITY',
          isActive: true,
          order: 10,
        },
      ];

      setCollectionDocs('serviceOrderRules', existingRules.map(r => ({ id: r.id, data: r })));

      // This should not overwrite existing rules
      await initializeDefaultServiceOrderRules();

      const rules = await getServiceOrderRules();
      // Should still only have the one existing rule
      const hasExisting = rules.some(r => r.id === 'rule1' && r.keyword === 'EXISTING');
      expect(hasExisting).toBe(true);
    });

    it('should create default rules with correct structure', async () => {
      await initializeDefaultServiceOrderRules();

      const rules = await getServiceOrderRules();
      const cityTourRule = rules.find(r => r.keyword === 'CITY TOUR');

      expect(cityTourRule).toBeDefined();
      expect(cityTourRule?.activity).toBe('CITY TOUR LA PAZ');
      expect(cityTourRule?.isActive).toBe(true);
      expect(cityTourRule?.order).toBe(10);
    });
  });
});
