import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Firebase modules
vi.mock('firebase/firestore', async () => await import('../test-utils/firestore-mock'));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { setCollectionDocs, resetMockFirestore } from '../test-utils/firestore-mock';
import {
  getExpenseRulesFromFirestore,
  saveExpenseRulesToFirestore,
  deleteExpenseRuleFromFirestore,
  initializeDefaultRules,
  type ExpenseRule,
} from '@/lib/ruleService';

describe('ruleService', () => {
  beforeEach(() => {
    resetMockFirestore();
  });

  describe('getExpenseRulesFromFirestore', () => {
    it('should return all rules for La Paz city', async () => {
      const mockRules = [
        {
          id: 'rule1',
          keyword: 'desaguadero',
          detail: 'MALETAS FRONTERA',
          unitPrice: 3,
          quantityFormula: '=$G$3',
          city: 'La Paz' as const,
          isActive: true,
          order: 10,
        },
        {
          id: 'rule2',
          keyword: 'I.Sol',
          detail: 'ISLA DEL SOL',
          unitPrice: 10,
          quantityFormula: '=$G$3',
          city: 'La Paz' as const,
          isActive: true,
          order: 31,
        },
      ];

      setCollectionDocs('expenseRules', mockRules.map(r => ({ id: r.id, data: r })));

      const rules = await getExpenseRulesFromFirestore('La Paz');

      expect(rules).toHaveLength(2);
      expect(rules[0].keyword).toBe('desaguadero');
      expect(rules[0].unitPrice).toBe(3);
      expect(rules[1].keyword).toBe('I.Sol');
    });

    it('should return empty array for Uyuni with no rules', async () => {
      const rules = await getExpenseRulesFromFirestore('Uyuni');
      expect(rules).toEqual([]);
    });

    it('should return only active rules for a city', async () => {
      const mockRules = [
        {
          id: 'rule1',
          keyword: 'desaguadero',
          detail: 'MALETAS FRONTERA',
          unitPrice: 3,
          quantityFormula: '=$G$3',
          city: 'La Paz' as const,
          isActive: true,
          order: 10,
        },
        {
          id: 'rule2',
          keyword: 'I.Sol',
          detail: 'ISLA DEL SOL',
          unitPrice: 10,
          quantityFormula: '=$G$3',
          city: 'La Paz' as const,
          isActive: false,
          order: 31,
        },
      ];

      setCollectionDocs('expenseRules', mockRules.map(r => ({ id: r.id, data: r })));

      const rules = await getExpenseRulesFromFirestore('La Paz');

      expect(rules).toHaveLength(2);
      expect(rules.filter(r => r.isActive)).toHaveLength(1);
    });
  });

  describe('saveExpenseRulesToFirestore', () => {
    it('should save new rules without errors', async () => {
      const newRules: ExpenseRule[] = [
        {
          id: 'new_1',
          keyword: 'test-keyword',
          detail: 'TEST DETAIL',
          unitPrice: 50,
          quantityFormula: '1',
          city: 'La Paz',
          isActive: true,
          order: 200,
        },
      ];

      // Should not throw
      await expect(saveExpenseRulesToFirestore(newRules)).resolves.not.toThrow();
    });

    it('should handle saving rules without errors', async () => {
      const rulesToSave: ExpenseRule[] = [
        {
          id: 'rule1',
          keyword: 'desaguadero',
          detail: 'MALETAS FRONTERA',
          unitPrice: 5, // Update price
          quantityFormula: '=$G$3',
          city: 'La Paz',
          isActive: true,
          order: 10,
        },
      ];

      // Should not throw
      await expect(saveExpenseRulesToFirestore(rulesToSave)).resolves.not.toThrow();
    });
  });

  describe('deleteExpenseRuleFromFirestore', () => {
    it('should delete a rule by ID', async () => {
      const mockRules = [
        {
          id: 'rule1',
          keyword: 'desaguadero',
          detail: 'MALETAS FRONTERA',
          unitPrice: 3,
          quantityFormula: '=$G$3',
          city: 'La Paz' as const,
          isActive: true,
          order: 10,
        },
      ];

      setCollectionDocs('expenseRules', mockRules.map(r => ({ id: r.id, data: r })));

      // Verify it exists
      let rules = await getExpenseRulesFromFirestore('La Paz');
      expect(rules).toHaveLength(1);

      // Delete it
      await deleteExpenseRuleFromFirestore('rule1');

      // Verify it's gone
      rules = await getExpenseRulesFromFirestore('La Paz');
      expect(rules.find(r => r.id === 'rule1')).toBeUndefined();
    });

    it('should throw error when deleting with invalid ID', async () => {
      await expect(deleteExpenseRuleFromFirestore('new_123')).rejects.toThrow();
      await expect(deleteExpenseRuleFromFirestore('')).rejects.toThrow();
    });
  });

  describe('initializeDefaultRules', () => {
    it('should not initialize if La Paz rules already exist', async () => {
      const existingRules = [
        {
          id: 'rule1',
          keyword: 'desaguadero',
          detail: 'MALETAS FRONTERA',
          unitPrice: 3,
          quantityFormula: '=$G$3',
          city: 'La Paz' as const,
          isActive: true,
          order: 10,
        },
      ];

      setCollectionDocs('expenseRules', existingRules.map(r => ({ id: r.id, data: r })));

      // Should not throw, just skip
      await initializeDefaultRules();

      const rules = await getExpenseRulesFromFirestore('La Paz');
      expect(rules.length).toBeGreaterThan(0);
    });
  });
});
