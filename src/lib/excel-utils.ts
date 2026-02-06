"use client";

/**
 * @file excel-utils.ts
 * @description Excel-specific utilities for parsing, formatting, and processing Excel data.
 */

import * as XLSX from 'xlsx';
import { getValidDateFromExcelCell, isExcelTimeValue } from './validators';

/**
 * Parses an Excel file and extracts the first sheet data as 2D array
 * @param file The Excel file to parse
 * @returns 2D array of cell values or null if parsing fails
 */
export async function parseExcelFile(file: File): Promise<any[][] | null> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellFormula: false });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    if (!worksheet) return null;

    const data = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    }) as any[][];

    return data.length > 0 ? data : null;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return null;
  }
}

/**
 * Extracts a specific column from Excel data as an array
 * @param excelData 2D array of Excel data
 * @param columnIndex Zero-based column index
 * @returns Array of values from the column
 */
export function getExcelColumn(excelData: any[][], columnIndex: number): any[] {
  if (!excelData || columnIndex < 0) return [];
  
  return excelData
    .map(row => row[columnIndex])
    .filter(value => value !== undefined && value !== null);
}

/**
 * Finds a specific value in an Excel column (case-insensitive)
 * @param excelData 2D array of Excel data
 * @param columnIndex Zero-based column index
 * @param searchValue The value to search for
 * @param startRow Start searching from this row
 * @returns Row index where value is found, or -1 if not found
 */
export function findInExcelColumn(
  excelData: any[][],
  columnIndex: number,
  searchValue: string,
  startRow = 0
): number {
  if (!excelData || columnIndex < 0) return -1;

  const searchLower = searchValue.toString().toLowerCase().trim();
  
  for (let i = startRow; i < excelData.length; i++) {
    const cellValue = excelData[i]?.[columnIndex];
    if (cellValue === null || cellValue === undefined) continue;
    
    if (cellValue.toString().toLowerCase().trim() === searchLower) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Finds multiple values in an Excel row (returns indices of matches)
 * @param excelData 2D array of Excel data
 * @param rowIndex The row to search
 * @param searchValues Array of values to search for
 * @returns Array of column indices where matches are found
 */
export function findColumnsInExcelRow(
  excelData: any[][],
  rowIndex: number,
  searchValues: string[]
): number[] {
  if (!excelData || rowIndex >= excelData.length) return [];

  const row = excelData[rowIndex];
  const matches: number[] = [];

  searchValues.forEach(searchValue => {
    const searchLower = searchValue.toLowerCase().trim();
    const colIndex = row.findIndex(
      cell => cell && cell.toString().toLowerCase().trim() === searchLower
    );
    if (colIndex !== -1) {
      matches.push(colIndex);
    }
  });

  return matches;
}

/**
 * Extracts a rectangular range of data from Excel
 * @param excelData 2D array of Excel data
 * @param startRow Start row (inclusive)
 * @param endRow End row (inclusive)
 * @param startCol Start column (inclusive)
 * @param endCol End column (inclusive)
 * @returns 2D array of the range
 */
export function getExcelRange(
  excelData: any[][],
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
): any[][] {
  if (!excelData || startRow < 0 || startCol < 0) return [];

  const range: any[][] = [];
  for (let i = startRow; i <= Math.min(endRow, excelData.length - 1); i++) {
    const row = excelData[i];
    if (!row) {
      range.push([]);
      continue;
    }
    range.push(row.slice(startCol, Math.min(endCol + 1, row.length)));
  }
  return range;
}

/**
 * Normalizes Excel cell data by removing extra whitespace and formatting
 * @param cellValue The cell value to normalize
 * @returns Normalized string
 */
export function normalizeExcelCell(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  return cellValue.toString().trim();
}

/**
 * Converts Excel data to a CSV string
 * @param excelData 2D array of Excel data
 * @returns CSV formatted string
 */
export function excelToCSV(excelData: any[][]): string {
  return excelData
    .map(row =>
      row
        .map(cell => {
          const value = String(cell || '');
          // Escape quotes and wrap in quotes if contains comma
          return value.includes(',') ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(',')
    )
    .join('\n');
}

/**
 * Gets the dimensions (rows x columns) of the Excel data
 * @param excelData 2D array of Excel data
 * @returns Object with rows and cols properties
 */
export function getExcelDimensions(excelData: any[][]): { rows: number; cols: number } {
  if (!excelData || excelData.length === 0) {
    return { rows: 0, cols: 0 };
  }

  const rows = excelData.length;
  const cols = Math.max(...excelData.map(row => row?.length || 0));

  return { rows, cols };
}

/**
 * Checks if an Excel cell contains a date
 * @param cellValue The cell value to check
 * @returns true if the cell represents a date
 */
export function isExcelDate(cellValue: any): boolean {
  return getValidDateFromExcelCell(cellValue) !== null;
}

/**
 * Checks if a row is empty (all cells are empty)
 * @param row The row to check
 * @returns true if row is empty
 */
export function isEmptyRow(row: any[]): boolean {
  if (!row || row.length === 0) return true;
  return row.every(cell => cell === '' || cell === null || cell === undefined);
}

/**
 * Gets all non-empty rows from Excel data
 * @param excelData 2D array of Excel data
 * @returns Filtered array with empty rows removed
 */
export function removeEmptyRows(excelData: any[][]): any[][] {
  if (!excelData) return [];
  return excelData.filter(row => !isEmptyRow(row));
}

/**
 * Transposes a 2D array (swaps rows and columns)
 * @param excelData 2D array to transpose
 * @returns Transposed 2D array
 */
export function transposeExcelData(excelData: any[][]): any[][] {
  if (!excelData || excelData.length === 0) return [];

  const cols = Math.max(...excelData.map(row => row?.length || 0));
  const transposed: any[][] = [];

  for (let col = 0; col < cols; col++) {
    const newRow: any[] = [];
    for (let row = 0; row < excelData.length; row++) {
      newRow.push(excelData[row]?.[col] ?? '');
    }
    transposed.push(newRow);
  }

  return transposed;
}
