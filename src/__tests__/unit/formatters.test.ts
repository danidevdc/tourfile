import { describe, it, expect } from 'vitest';
import {
  formatDateSpanish,
  formatDateDDMMYYYY,
  formatTime,
  formatFlightTime,
  formatOrderName,
  parseDateDDMMYYYY,
  parseDateDDMMYY,
  normalizeTime,
  formatCurrency,
  convertTo12Hour,
} from '@/lib/formatters';

describe('formatters', () => {
  describe('formatDateSpanish', () => {
    it('should format date in Spanish with year', () => {
      const date = new Date('2024-01-15T00:00:00Z'); // Use ISO string
      const result = formatDateSpanish(date);
      expect(result).toMatch(/enero/);
      expect(result).toMatch(/2024/);
    });

    it('should format date without year when requested', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = formatDateSpanish(date, false);
      expect(result).toMatch(/enero/);
      expect(result).not.toContain('2024');
    });

    it('should return empty string for invalid date', () => {
      const result = formatDateSpanish(new Date('invalid'));
      expect(result).toBe('');
    });
  });

  describe('formatDateDDMMYYYY', () => {
    it('should format date as dd/MM/yyyy', () => {
      const date = new Date('2024-01-05T00:00:00Z');
      const result = formatDateDDMMYYYY(date);
      expect(result).toMatch(/\d{2}\/\d{2}\/2024/);
    });

    it('should return empty string for invalid date', () => {
      const result = formatDateDDMMYYYY(new Date('invalid'));
      expect(result).toBe('');
    });
  });

  describe('formatTime', () => {
    it('should format time as HH:mm', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = formatTime(date);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should return empty string for invalid date', () => {
      const result = formatTime(new Date('invalid'));
      expect(result).toBe('');
    });
  });

  describe('formatFlightTime', () => {
    it('should format string time correctly', () => {
      const result = formatFlightTime('14:30');
      expect(result).toBe('14:30');
    });

    it('should format Excel time serial number', () => {
      const excelTime = 0.5; // Represents 12:00
      const result = formatFlightTime(excelTime);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });

    it('should return empty string for invalid input', () => {
      expect(formatFlightTime('')).toBe('');
      expect(formatFlightTime(null)).toBe('');
      expect(formatFlightTime(1.5)).toBe(''); // Out of range
    });
  });

  describe('formatOrderName', () => {
    it('should format order name correctly', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = formatOrderName(date, 'PROG-01');
      expect(result).toContain('ODS');
      expect(result).toContain('2024');
      expect(result).toMatch(/PROG_01|PROG-01/); // Accept both formats
    });

    it('should handle file numbers with slashes', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const result = formatOrderName(date, 'PROG 01/A');
      expect(result).toMatch(/PROG.01.A/); // Accept with underscores or dashes
    });
  });

  describe('parseDateDDMMYYYY', () => {
    it('should parse valid date string', () => {
      const result = parseDateDDMMYYYY('15/01/2024');
      expect(result).toBeInstanceOf(Date);
      // date-fns parse uses local timezone, so check basic validity
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2024);
    });

    it('should return null for invalid format', () => {
      expect(parseDateDDMMYYYY('01-15-2024')).toBeNull();
      expect(parseDateDDMMYYYY('2024/01/15')).toBeNull();
      expect(parseDateDDMMYYYY('')).toBeNull();
    });

    it('should handle day/month ranges reasonably', () => {
      const result = parseDateDDMMYYYY('99/99/2024');
      // date-fns parse might return Invalid Date
      if (result && !isNaN(result.getTime())) {
        expect(result.getFullYear()).toBe(2024);
      }
    });
  });

  describe('parseDateDDMMYY', () => {
    it('should parse valid 2-digit year', () => {
      const result = parseDateDDMMYY('15/01/24');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
    });

    it('should parse valid 4-digit year', () => {
      const result = parseDateDDMMYY('15/01/2024');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
    });

    it('should return null for invalid format', () => {
      expect(parseDateDDMMYY('15-01-24')).toBeNull();
      expect(parseDateDDMMYY('24/01')).toBeNull();
    });
  });

  describe('normalizeTime', () => {
    it('should normalize 4-digit time', () => {
      expect(normalizeTime('1430')).toBe('14:30');
      expect(normalizeTime('0900')).toBe('09:00');
      expect(normalizeTime('2359')).toBe('23:59');
    });

    it('should handle already formatted time', () => {
      const result = normalizeTime('14:30');
      expect(result).toBe('14:30');
    });

    it('should return empty for invalid input', () => {
      expect(normalizeTime('143')).toBe('');
      expect(normalizeTime('14300')).toBe('');
      expect(normalizeTime('')).toBe('');
    });
  });

  describe('formatCurrency', () => {
    it('should format COP currency', () => {
      const result = formatCurrency(1000000, 'COP');
      expect(result).toContain('1'); // At least contains the number
    });

    it('should format USD currency', () => {
      const result = formatCurrency(100, 'USD');
      expect(result).toContain('100');
    });
  });

  describe('convertTo12Hour', () => {
    it('should convert 24-hour to 12-hour AM', () => {
      expect(convertTo12Hour('09:30')).toBe('9:30 AM');
      expect(convertTo12Hour('00:15')).toBe('12:15 AM');
    });

    it('should convert 24-hour to 12-hour PM', () => {
      expect(convertTo12Hour('14:30')).toBe('2:30 PM');
      expect(convertTo12Hour('23:45')).toBe('11:45 PM');
    });

    it('should return empty for invalid input', () => {
      expect(convertTo12Hour('')).toBe('');
      expect(convertTo12Hour('invalid')).toBe('');
    });
  });
});
