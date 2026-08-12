import { describe, it, expect } from 'vitest';
import { findFileInExcelData, sortServiceItems, type ExcelMatrix } from '@/lib/serviceOrderGeneratorHelpers';
import type { Hotel } from '@/lib/serviceOrderService';
import type { ServiceItem } from '@/lib/serviceOrderService';

describe('findFileInExcelData', () => {
  const hotels: Hotel[] = [
    { id: '1', name: 'POSADA' },
    { id: '2', name: 'HOTEL LAS OLAS' },
  ];

  it('finds an exact file number match and extracts group/pax/hotel', () => {
    const excelData: ExcelMatrix = [
      ['CTFI109860'],
      ['GRUPO PEREZ'],
      ['10'],
      ['HOTEL LAS OLAS'],
    ];
    const result = findFileInExcelData(excelData, 'CTFI109860', hotels);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.ambiguous).toBe(false);
      expect(result.realFileNumber).toBeNull();
      expect(result.groupName).toBe('GRUPO PEREZ');
      expect(result.pax).toBe('10');
      expect(result.hotelName).toBe('HOTEL LAS OLAS');
    }
  });

  it('returns not-found when the file number does not exist', () => {
    const excelData: ExcelMatrix = [['CTFI999999'], ['GRUPO X']];
    const result = findFileInExcelData(excelData, 'CTFI000000', hotels);
    expect(result.found).toBe(false);
    expect(result.ambiguous).toBe(false);
  });

  it('resolves a digits-only search by unique numeric suffix', () => {
    const excelData: ExcelMatrix = [
      ['CTFI109860'],
      ['GRUPO SUFIJO'],
      ['5'],
    ];
    const result = findFileInExcelData(excelData, '109860', hotels);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.realFileNumber).toBe('CTFI109860');
      expect(result.groupName).toBe('GRUPO SUFIJO');
    }
  });

  it('flags an ambiguous digits-only search matching multiple prefixes', () => {
    const excelData: ExcelMatrix = [
      ['CTFI109860', 'CTFO109860'],
      ['GRUPO A', 'GRUPO B'],
    ];
    const result = findFileInExcelData(excelData, '109860', hotels);
    expect(result.found).toBe(false);
    expect(result.ambiguous).toBe(true);
    if (result.ambiguous) {
      expect(result.distinctValues.sort()).toEqual(['CTFI109860', 'CTFO109860']);
    }
  });

  it('extracts PAX with the "N + M" format', () => {
    const excelData: ExcelMatrix = [
      ['CTFI1'],
      ['GRUPO'],
      ['10 + 2'],
    ];
    const result = findFileInExcelData(excelData, 'CTFI1', hotels);
    expect(result.found).toBe(true);
    if (result.found) expect(result.pax).toBe('10 + 2');
  });

  it('defaults PAX to "N/A" when no valid pax cell is found within the search window', () => {
    const excelData: ExcelMatrix = [
      ['CTFI1'],
      ['GRUPO'],
      ['not a number'],
    ];
    const result = findFileInExcelData(excelData, 'CTFI1', hotels);
    expect(result.found).toBe(true);
    if (result.found) expect(result.pax).toBe('N/A');
  });

  it('prefers a non-POSADA hotel when both appear in the same column', () => {
    const excelData: ExcelMatrix = [
      ['CTFI1'],
      ['POSADA / HOTEL LAS OLAS'],
    ];
    const result = findFileInExcelData(excelData, 'CTFI1', hotels);
    expect(result.found).toBe(true);
    if (result.found) expect(result.hotelName).toBe('HOTEL LAS OLAS');
  });

  it('falls back to POSADA when it is the only hotel match', () => {
    const excelData: ExcelMatrix = [
      ['CTFI1'],
      ['ESTADIA EN POSADA'],
    ];
    const result = findFileInExcelData(excelData, 'CTFI1', hotels);
    expect(result.found).toBe(true);
    if (result.found) expect(result.hotelName).toBe('POSADA');
  });

  it('leaves hotelName empty when no known hotel appears in the column', () => {
    const excelData: ExcelMatrix = [['CTFI1'], ['SIN HOTEL AQUI']];
    const result = findFileInExcelData(excelData, 'CTFI1', hotels);
    expect(result.found).toBe(true);
    if (result.found) expect(result.hotelName).toBe('');
  });
});

describe('sortServiceItems', () => {
  const item = (overrides: Partial<ServiceItem>): ServiceItem => ({
    fecha: '', hora: '', servicio: '', vuelo: '', guia: '', bus: '', chofer: '', observaciones: '',
    ...overrides,
  });

  it('sorts by date ascending', () => {
    const items = [
      item({ fecha: '20/01/2025', servicio: 'B' }),
      item({ fecha: '10/01/2025', servicio: 'A' }),
    ];
    const sorted = sortServiceItems(items);
    expect(sorted.map(s => s.servicio)).toEqual(['A', 'B']);
  });

  it('sorts same-date items by time ascending', () => {
    const items = [
      item({ fecha: '10/01/2025', hora: '14:00', servicio: 'PM' }),
      item({ fecha: '10/01/2025', hora: '08:00', servicio: 'AM' }),
    ];
    const sorted = sortServiceItems(items);
    expect(sorted.map(s => s.servicio)).toEqual(['AM', 'PM']);
  });

  it('places items without a time after items with a time, same date', () => {
    const items = [
      item({ fecha: '10/01/2025', hora: '', servicio: 'NO_TIME' }),
      item({ fecha: '10/01/2025', hora: '08:00', servicio: 'WITH_TIME' }),
    ];
    const sorted = sortServiceItems(items);
    expect(sorted.map(s => s.servicio)).toEqual(['WITH_TIME', 'NO_TIME']);
  });

  it('does not mutate the original array', () => {
    const items = [item({ fecha: '20/01/2025' }), item({ fecha: '10/01/2025' })];
    const original = [...items];
    sortServiceItems(items);
    expect(items).toEqual(original);
  });

  it('does not throw when given an unparsable date string (current behavior: NaN comparisons keep original relative order)', () => {
    const items = [
      item({ fecha: '10/01/2025', servicio: 'VALID' }),
      item({ fecha: 'not-a-date', servicio: 'INVALID' }),
    ];
    expect(() => sortServiceItems(items)).not.toThrow();
  });
});
