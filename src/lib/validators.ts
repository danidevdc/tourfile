"use client";

/**
 * @file validators.ts
 * @description Client-side validation utilities for dates, times, PAX counts, and other data types.
 * For server-safe validators that can be imported in API routes, use validators-server.ts
 */

import * as XLSX from 'xlsx';

// Re-export server-safe validators so they're available from this file
// This allows client components to import validated functions without the "use client" directive affecting server code
export {
  isValidPaxFormat,
  isNumericString,
  isValidEmail,
  isValidFlightNumber,
  isValidFormula,
  containsCellReference,
  isValidDateRange,
  isValidFileNumber,
  isValidTime,
  isValidDateDDMMYYYY,
  isExcelTimeValue,
} from './validators-server';

/**
 * Validates if a value from an Excel cell is a valid date
 * @param cellValue The value from the Excel cell
 * @returns The Date object if valid, otherwise null
 */
export function getValidDateFromExcelCell(cellValue: any): Date | null {
  if (!cellValue) return null;

  // If it's already a Date object
  if (cellValue instanceof Date && !isNaN(cellValue.valueOf())) {
    return cellValue;
  }

  // Check for Excel's serial date format
  if (typeof cellValue === 'number' && cellValue > 25569) {
    try {
      const parsed = XLSX.SSF.parse_date_code(cellValue);
      if (parsed && parsed.y >= 2000) {
        return new Date(
          Date.UTC(
            parsed.y,
            parsed.m - 1,
            parsed.d,
            parsed.H || 0,
            parsed.M || 0,
            parsed.S || 0
          )
        );
      }
    } catch (e) {
      console.error(`Failed to parse Excel date code: ${cellValue}`, e);
    }
  }

  return null;
}
