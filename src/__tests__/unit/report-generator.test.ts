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
    // two expense items should be generated (AGUAS and ALMUERZO GUIA)
    expect(result.expenses.length).toBe(2);

    const cityTour = result.expenses.find(e => e.detail === 'AGUAS')!;
    const am = result.expenses.find(e => e.detail === 'ALMUERZO GUIA')!;

    // Pax = 18 -> quantity = 18+2 = 20 -> total = 20 * 6 = 120
    expect(cityTour.total).toBe(120);
    expect(am.total).toBe(35);
    
    // Both should have the same date since they were found after the same date
    expect(cityTour.date).toBe(''); // AGUAS has no date
    expect(am.date).toBe('15/08/24');
  });

  it('generateExpenseDetails sorts by date ascending and AGUAS items have no date', async () => {
    const rules = [
      { id: 'r1', keyword: 'City Tour', detail: 'AGUAS', unitPrice: 6, quantityFormula: '1', city: 'La Paz', isActive: true, order: 1 },
      { id: 'r2', keyword: 'Tiwanaku', detail: 'TICKETS TIWANAKU', unitPrice: 100, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 2 },
      { id: 'r3', keyword: 'Valle de la Luna', detail: 'TICKETS VALLE', unitPrice: 25, quantityFormula: '=$G$3', city: 'La Paz', isActive: true, order: 3 }
    ];

    vi.spyOn(ruleService, 'getExpenseRulesFromFirestore').mockResolvedValue(rules as any);

    // Excel with dates in Column A and keywords in same column
    const excelData = [
      [ new Date(Date.UTC(2026, 1, 15, 12, 0, 0)) ], // 15/02/26
      [ 'Tiwanaku' ],
      [ new Date(Date.UTC(2026, 1, 17, 12, 0, 0)) ], // 17/02/26
      [ 'City Tour' ],
      [ new Date(Date.UTC(2026, 1, 16, 12, 0, 0)) ], // 16/02/26
      [ 'Valle de la Luna' ],
    ];

    const result = await generateExpenseDetails(excelData, { columnIndex: 0, fileIdRowIndex: 0 }, '10');

    expect(result.expenses.length).toBe(3);

    // Should be sorted by date ascending (oldest first)
    // 15/02/26 (Tiwanaku), 16/02/26 (Valle), 17/02/26 (City Tour/AGUAS)
    // But AGUAS has no date, so it goes to the end
    expect(result.expenses[0].detail).toBe('TICKETS TIWANAKU'); // 15/02/26
    expect(result.expenses[0].date).toBe('15/02/26');
    
    expect(result.expenses[1].detail).toBe('TICKETS VALLE'); // 16/02/26
    expect(result.expenses[1].date).toBe('16/02/26');
    
    // AGUAS should have empty date and be at the end
    expect(result.expenses[2].detail).toBe('AGUAS');
    expect(result.expenses[2].date).toBe('');
  });

  it('generateExpenseDetails matches keywords as complete words only (not as substrings)', async () => {
    const rules = [
      { id: 'r1', keyword: 'AM', detail: 'ALMUERZO GUIA', unitPrice: 50, quantityFormula: '1', city: 'La Paz', isActive: true, order: 1 }
    ];

    vi.spyOn(ruleService, 'getExpenseRulesFromFirestore').mockResolvedValue(rules as any);

    // Excel with dates in Column A and text containing "am" as substring
    const excelData = [
      [ new Date(Date.UTC(2026, 1, 24, 12, 0, 0)) ], // 24/02/26
      [ 'FAMILY RODRIGUEZ' ], // Contains "am" but as substring, should NOT match
      [ 'PROGRAM DETAILS' ], // Contains "am" but as substring, should NOT match  
      [ new Date(Date.UTC(2026, 1, 28, 12, 0, 0)) ], // 28/02/26
      [ 'City Tour and Cable Car - AM' ], // Contains "AM" as complete word, SHOULD match
    ];

    const result = await generateExpenseDetails(excelData, { columnIndex: 0, fileIdRowIndex: 0 }, '10');

    expect(result.expenses.length).toBe(1);
    expect(result.expenses[0].detail).toBe('ALMUERZO GUIA');
    // Should use date 28/02/26 (from the row with "AM" as complete word)
    // NOT 24/02/26 (from "FAMILY" which contains "am" as substring)
    expect(result.expenses[0].date).toBe('28/02/26');
  });
});
