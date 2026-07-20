/**
 * @file validators-server.ts
 * @description Server-side validation utilities that can be safely imported in API routes and server components.
 * These functions contain no client-specific logic and no "use client" directive.
 */

/**
 * Validates a PAX (passenger) count string
 * Accepts formats like "16" or "16+1" 
 * @param paxString The PAX string to validate
 * @returns true if valid PAX format
 */
export function isValidPaxFormat(paxString: string): boolean {
  if (!paxString) return false;
  
  const trimmed = paxString.trim();
  
  // Single number format (up to 999 pax)
  const singleNumberRegex = /^\d{1,3}$/;
  if (singleNumberRegex.test(trimmed)) return true;
  
  // Plus format (e.g., "16+1")
  const plusFormatRegex = /^\d+\s*\+\s*\d+$/;
  return plusFormatRegex.test(trimmed);
}

/**
 * Validates if a string is numeric (can be converted to a number)
 * @param value The value to check
 * @returns true if the value can be parsed as a number
 */
export function isNumericString(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return !isNaN(Number(value.trim())) && value.trim() !== '';
}

/**
 * Validates if a string is a valid email
 * @param email Email string to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string looks like a flight number
 * @param flightNumber Flight number to validate
 * @returns true if it could be a valid flight number
 */
export function isValidFlightNumber(flightNumber: string): boolean {
  if (!flightNumber || typeof flightNumber !== 'string') return false;
  // Flight numbers are typically 2-3 letters + 1-4 digits, e.g., "OB305", "LA2345"
  const flightRegex = /^[A-Z]{2,3}\d{1,4}$/i;
  return flightRegex.test(flightNumber.replace(/\s/g, ''));
}

/**
 * Validates if a string contains a valid formula pattern
 * @param formula The formula string to validate
 * @returns true if it looks like a valid cell formula
 */
export function isValidFormula(formula: string): boolean {
  if (!formula || typeof formula !== 'string') return false;
  // Must start with '=', can contain numbers, letters, operators, parentheses, and cell references
  return formula.startsWith('=') && formula.length > 1;
}

/**
 * Validates if a cell reference (e.g., "$G$3") exists in the formula
 * @param formula The formula string to check
 * @returns true if formula contains a cell reference
 */
export function containsCellReference(formula: string): boolean {
  if (!formula || typeof formula !== 'string') return false;
  return /\$[A-Z]\$\d+/.test(formula);
}

/**
 * Validates if a date range is valid (start <= end)
 * @param startDate The start date
 * @param endDate The end date
 * @returns true if the range is valid
 */
export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  if (!startDate || !endDate) return false;
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
  return startDate <= endDate;
}

/**
 * Validates if a string is a valid file number format
 * File numbers are usually like "PROG-001" or "P01" 
 * @param fileNumber The file number to validate
 * @returns true if it looks valid
 */
export function isValidFileNumber(fileNumber: string): boolean {
  if (!fileNumber || typeof fileNumber !== 'string') return false;
  // Allow alphanumeric with spaces, slashes, or dashes
  return /^[A-Z0-9\s/\-]+$/.test(fileNumber.trim().toUpperCase());
}

/**
 * Validates if a string is a valid time in HH:mm format
 * @param timeStr Time string to validate
 * @returns true if valid time format
 */
export function isValidTime(timeStr: string): boolean {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(timeStr);
}

/**
 * Validates if a string is a valid date in dd/MM/yyyy format
 * @param dateStr Date string to validate
 * @returns true if valid date format
 */
export function isValidDateDDMMYYYY(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const dateRegex = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/;
  return dateRegex.test(dateStr);
}

/**
 * Validates if a value looks like an Excel time (0-1 range)
 * @param value The value to check
 * @returns true if value is in Excel time range
 */
export function isExcelTimeValue(value: any): boolean {
  return typeof value === 'number' && value > 0 && value < 1;
}
