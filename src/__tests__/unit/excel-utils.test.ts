import { describe, it, expect } from 'vitest';
import {
  getExcelColumn,
  findInExcelColumn,
  findColumnsInExcelRow,
  getExcelRange,
  normalizeExcelCell,
  excelToCSV,
  getExcelDimensions,
  isEmptyRow,
  removeEmptyRows,
  transposeExcelData,
} from '@/lib/excel-utils';

describe('excel-utils', () => {
  const sampleData = [
    ['Name', 'Age', 'City'],
    ['John', 30, 'NYC'],
    ['Jane', 25, 'LA'],
    ['Bob', 35, 'Chicago'],
  ];

  const emptyRowData = [
    ['Name', 'Age', 'City'],
    ['John', 30, 'NYC'],
    [null, '', undefined],
    ['Bob', 35, 'Chicago'],
  ];

  describe('getExcelColumn', () => {
    it('should extract a column', () => {
      const column = getExcelColumn(sampleData, 0);
      expect(column).toEqual(['Name', 'John', 'Jane', 'Bob']);
    });

    it('should return empty for invalid column index', () => {
      expect(getExcelColumn(sampleData, -1)).toEqual([]);
      expect(getExcelColumn(sampleData, 10)).toEqual([]);
    });

    it('should filter out undefined and null values', () => {
      const column = getExcelColumn(emptyRowData, 1);
      expect(column).toContain(30);
      expect(column).toContain(35);
      expect(column).toContain('Age');
    });
  });

  describe('findInExcelColumn', () => {
    it('should find value in column', () => {
      const index = findInExcelColumn(sampleData, 0, 'John');
      expect(index).toBe(1);
    });

    it('should be case-insensitive', () => {
      const index = findInExcelColumn(sampleData, 0, 'JOHN');
      expect(index).toBe(1);
    });

    it('should return -1 if not found', () => {
      const index = findInExcelColumn(sampleData, 0, 'NonExistent');
      expect(index).toBe(-1);
    });

    it('should search from startRow', () => {
      const index = findInExcelColumn(sampleData, 0, 'Bob', 3);
      expect(index).toBe(3);
    });
  });

  describe('findColumnsInExcelRow', () => {
    it('should find multiple columns', () => {
      const columns = findColumnsInExcelRow(sampleData, 0, ['Name', 'City']);
      expect(columns).toContain(0);
      expect(columns).toContain(2);
    });

    it('should return empty for no matches', () => {
      const columns = findColumnsInExcelRow(sampleData, 0, ['NonExistent']);
      expect(columns).toEqual([]);
    });
  });

  describe('getExcelRange', () => {
    it('should extract range of data', () => {
      const range = getExcelRange(sampleData, 0, 2, 0, 1);
      expect(range).toHaveLength(3);
      expect(range[0]).toEqual(['Name', 'Age']);
    });

    it('should handle boundary conditions', () => {
      const range = getExcelRange(sampleData, 1, 10, 0, 2);
      expect(range).toHaveLength(3); // Only 3 rows exist
    });
  });

  describe('normalizeExcelCell', () => {
    it('should trim and convert to string', () => {
      expect(normalizeExcelCell('  text  ')).toBe('text');
      expect(normalizeExcelCell(123)).toBe('123');
    });

    it('should handle null/undefined', () => {
      expect(normalizeExcelCell(null)).toBe('');
      expect(normalizeExcelCell(undefined)).toBe('');
    });
  });

  describe('excelToCSV', () => {
    it('should convert to CSV', () => {
      const csv = excelToCSV(sampleData);
      expect(csv).toContain('Name,Age,City');
      expect(csv).toContain('John,30,NYC');
    });

    it('should escape commas in values', () => {
      const data = [['Name', 'Description'], ['John', 'City, USA']];
      const csv = excelToCSV(data);
      expect(csv).toContain('"City, USA"');
    });
  });

  describe('getExcelDimensions', () => {
    it('should calculate dimensions', () => {
      const dimensions = getExcelDimensions(sampleData);
      expect(dimensions.rows).toBe(4);
      expect(dimensions.cols).toBe(3);
    });

    it('should return 0 for empty data', () => {
      const dimensions = getExcelDimensions([]);
      expect(dimensions.rows).toBe(0);
      expect(dimensions.cols).toBe(0);
    });
  });

  describe('isEmptyRow', () => {
    it('should detect empty rows', () => {
      expect(isEmptyRow([null, '', undefined])).toBe(true);
      expect(isEmptyRow([])).toBe(true);
    });

    it('should detect non-empty rows', () => {
      expect(isEmptyRow(['data', '', null])).toBe(false);
      expect(isEmptyRow(['', 'data', ''])).toBe(false);
    });
  });

  describe('removeEmptyRows', () => {
    it('should remove empty rows', () => {
      const cleaned = removeEmptyRows(emptyRowData);
      expect(cleaned).toHaveLength(3); // Original has 4, one is empty
      expect(cleaned.every(row => !isEmptyRow(row))).toBe(true);
    });
  });

  describe('transposeExcelData', () => {
    it('should transpose rows and columns', () => {
      const transposed = transposeExcelData(sampleData);
      expect(transposed[0]).toEqual(['Name', 'John', 'Jane', 'Bob']);
      expect(transposed[1]).toEqual(['Age', 30, 25, 35]);
      expect(transposed[2]).toEqual(['City', 'NYC', 'LA', 'Chicago']);
    });

    it('should handle empty data', () => {
      const transposed = transposeExcelData([]);
      expect(transposed).toEqual([]);
    });
  });
});
