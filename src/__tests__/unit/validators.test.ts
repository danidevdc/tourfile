import { describe, it, expect, vi } from 'vitest';
import {
  isValidTime,
  isValidDateDDMMYYYY,
  getValidDateFromExcelCell,
  isValidPaxFormat,
  isValidEmail,
  isValidFlightNumber,
  isExcelTimeValue,
  isValidFormula,
  containsCellReference,
  isNumericString,
  isValidDateRange,
  isValidFileNumber,
} from '@/lib/validators';

// Mock XLSX for testing
vi.mock('xlsx', () => ({
  SSF: {
    parse_date_code: (code: number) => {
      if (code === 45000) return { y: 2023, m: 1, d: 1, H: 0, M: 0, S: 0 };
      return { y: 2024, m: 1, d: 15, H: 10, M: 30, S: 0 };
    }
  }
}));

describe('validators', () => {
  describe('isValidTime', () => {
    it('should validate correct time format', () => {
      expect(isValidTime('14:30')).toBe(true);
      expect(isValidTime('09:00')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('00:00')).toBe(true);
    });

    it('should reject invalid time format', () => {
      expect(isValidTime('25:00')).toBe(false);
      expect(isValidTime('14:60')).toBe(false);
      expect(isValidTime('14-30')).toBe(false);
      expect(isValidTime('1430')).toBe(false);
      expect(isValidTime('')).toBe(false);
    });
  });

  describe('isValidDateDDMMYYYY', () => {
    it('should validate correct date format', () => {
      expect(isValidDateDDMMYYYY('15/01/2024')).toBe(true);
      expect(isValidDateDDMMYYYY('01/12/2000')).toBe(true);
      expect(isValidDateDDMMYYYY('31/12/2024')).toBe(true);
    });

    it('should reject invalid date format', () => {
      expect(isValidDateDDMMYYYY('15-01-2024')).toBe(false);
      expect(isValidDateDDMMYYYY('2024/01/15')).toBe(false);
      expect(isValidDateDDMMYYYY('32/01/2024')).toBe(false);
      expect(isValidDateDDMMYYYY('15/13/2024')).toBe(false);
      expect(isValidDateDDMMYYYY('')).toBe(false);
    });
  });

  describe('getValidDateFromExcelCell', () => {
    it('should parse Date object', () => {
      const date = new Date('2024-01-15');
      const result = getValidDateFromExcelCell(date);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
    });

    it('should return null for invalid input', () => {
      expect(getValidDateFromExcelCell(null)).toBeNull();
      expect(getValidDateFromExcelCell('')).toBeNull();
      expect(getValidDateFromExcelCell(100)).toBeNull(); // Too small for date code
    });
  });

  describe('isValidPaxFormat', () => {
    it('should validate single number', () => {
      expect(isValidPaxFormat('5')).toBe(true);
      expect(isValidPaxFormat('16')).toBe(true);
      expect(isValidPaxFormat('99')).toBe(true);
    });

    it('should validate plus format', () => {
      expect(isValidPaxFormat('16+1')).toBe(true);
      expect(isValidPaxFormat('10 + 2')).toBe(true);
      expect(isValidPaxFormat('5+3')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(isValidPaxFormat('abc')).toBe(false);
      expect(isValidPaxFormat('16+1+1')).toBe(false);
      expect(isValidPaxFormat('')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidFlightNumber', () => {
    it('should validate flight numbers', () => {
      expect(isValidFlightNumber('OB305')).toBe(true);
      expect(isValidFlightNumber('ob 305')).toBe(true); // Should normalize
      expect(isValidFlightNumber('LA2345')).toBe(true);
      expect(isValidFlightNumber('AA1')).toBe(true);
    });

    it('should reject invalid flight numbers', () => {
      expect(isValidFlightNumber('305')).toBe(false); // No letters
      expect(isValidFlightNumber('ABCD123')).toBe(false); // Too many letters
      expect(isValidFlightNumber('')).toBe(false);
    });
  });

  describe('isExcelTimeValue', () => {
    it('should validate Excel time range', () => {
      expect(isExcelTimeValue(0.5)).toBe(true); // 12:00
      expect(isExcelTimeValue(0.25)).toBe(true); // 06:00
      expect(isExcelTimeValue(0.75)).toBe(true); // 18:00
    });

    it('should reject values outside range', () => {
      expect(isExcelTimeValue(0)).toBe(false);
      expect(isExcelTimeValue(1)).toBe(false);
      expect(isExcelTimeValue(1.5)).toBe(false);
      expect(isExcelTimeValue('0.5')).toBe(false);
    });
  });

  describe('isValidFormula', () => {
    it('should validate valid formulas', () => {
      expect(isValidFormula('=$G$3')).toBe(true);
      expect(isValidFormula('=$G$3+1')).toBe(true);
      expect(isValidFormula('=1+2*3')).toBe(true);
      expect(isValidFormula('=SUM(A1:A10)')).toBe(true);
    });

    it('should reject invalid formulas', () => {
      expect(isValidFormula('$G$3')).toBe(false); // Missing =
      expect(isValidFormula('=')).toBe(false); // Just =
      expect(isValidFormula('')).toBe(false);
    });
  });

  describe('containsCellReference', () => {
    it('should detect cell references', () => {
      expect(containsCellReference('$G$3')).toBe(true);
      expect(containsCellReference('=$G$3+1')).toBe(true);
      expect(containsCellReference('$A$1')).toBe(true);
    });

    it('should not match non-references', () => {
      expect(containsCellReference('=1+2')).toBe(false);
      expect(containsCellReference('G3')).toBe(false); // Missing $
      expect(containsCellReference('')).toBe(false);
    });
  });

  describe('isNumericString', () => {
    it('should validate numeric strings', () => {
      expect(isNumericString('123')).toBe(true);
      expect(isNumericString('45.67')).toBe(true);
      expect(isNumericString(' 100 ')).toBe(true); // With spaces
    });

    it('should reject non-numeric strings', () => {
      expect(isNumericString('abc')).toBe(false);
      expect(isNumericString('12a')).toBe(false);
      expect(isNumericString('')).toBe(false);
    });
  });

  describe('isValidDateRange', () => {
    it('should validate date range', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-31');
      expect(isValidDateRange(start, end)).toBe(true);
    });

    it('should accept same dates', () => {
      const date = new Date('2024-01-15');
      expect(isValidDateRange(date, date)).toBe(true);
    });

    it('should reject invalid ranges', () => {
      const start = new Date('2024-01-31');
      const end = new Date('2024-01-01');
      expect(isValidDateRange(start, end)).toBe(false);
    });
  });

  describe('isValidFileNumber', () => {
    it('should validate file numbers', () => {
      expect(isValidFileNumber('PROG-001')).toBe(true);
      expect(isValidFileNumber('P/01')).toBe(true);
      expect(isValidFileNumber('FILE 2024')).toBe(true);
    });

    it('should reject invalid file numbers', () => {
      expect(isValidFileNumber('file@123')).toBe(false); // Special char
      expect(isValidFileNumber('')).toBe(false);
    });
  });
});
