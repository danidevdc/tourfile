import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/ruleService', () => ({
  getExpenseRulesFromFirestore: vi.fn(),
}));

import { parsePaxCount, resolveQuantity, generateExpenseDetails } from '@/lib/report-generator';
import * as ruleService from '@/lib/ruleService';

describe('report-generator utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parsePaxCount handles single and plus formats', () => {
    expect(parsePaxCount('16+1')).toBe(17);
    expect(parsePaxCount(' 5 ')).toBe(5);
    expect(parsePaxCount('bad')).toBe(0);
    expect(parsePaxCount('')).toBe(0);
  });

  it('resolveQuantity computes numbers and formulas correctly', () => {
    expect(resolveQuantity('3', 10)).toBe(3);
    expect(resolveQuantity('=$G$3', 5)).toBe(5);
    expect(resolveQuantity('=$G$3+1', 4)).toBe(5);
    expect(resolveQuantity('=2+3', 0)).toBe(5);
    expect(resolveQuantity('=GARBAGE', 10)).toBe(1);
    expect(resolveQuantity('=$G$3', 0)).toBe(0);
  });

  it('generateExpenseDetails throws when rules fetch fails', async () => {
    vi.spyOn(ruleService, 'getExpenseRulesFromFirestore').mockRejectedValue(new Error('DB down'));

    await expect(generateExpenseDetails([[ 'x' ]], { columnIndex: 0, fileIdRowIndex: 0 }, '10')).rejects.toThrow('DB down');
  });

  it('generateExpenseDetails returns expenses using active rules and computes totals', async () => {
    // Mock rules: City Tour (uses pax formula) and AM (lunch)
    const rules = [
      { id: 'r1', keyword: 'City Tour', detail: 'AGUAS', unitPrice: 6, quantityFormula: '=$G$3+2', city: 'La Paz', isActive: true, order: 1 },
      { id: 'r2', keyword: 'AM', detail: 'ALMUERZO GUIA', unitPrice: 35, quantityFormula: '1', city: 'La Paz', isActive: true, order: 2 }
    ];

    vi.spyOn(ruleService, 'getExpenseRulesFromFirestore').mockResolvedValue(rules as any);

    // excelData: columnIndex 0 contains a start date then keywords in following rows
    const excelData = [
      [ new Date(Date.UTC(2024, 7, 15, 12, 0, 0)) ],
      [ 'City Tour' ],
      [ 'AM' ],
    ];

    const result = await generateExpenseDetails(excelData, { columnIndex: 0, fileIdRowIndex: 0 }, '16+2');

    expect(result.tourStartDate).toBe('15/08/24');
    // two expense items should be generated
    expect(result.expenses.length).toBe(2);

    const cityTour = result.expenses.find(e => e.detail === 'AGUAS')!;
    const am = result.expenses.find(e => e.detail === 'ALMUERZO GUIA')!;

    // Pax = 18 -> quantity = 18+2 = 20 -> total = 20 * 6 = 120
    expect(cityTour.total).toBe(120);
    expect(am.total).toBe(35);
  });
});
