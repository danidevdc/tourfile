"use client";

/**
 * @file formatters.ts
 * @description Centralized formatting utilities for dates, times, and other data types.
 * Used throughout the application for consistent formatting.
 */

import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Formats a Date object to a Spanish date string (e.g., "15 de enero de 2024")
 * @param date The date to format
 * @param includeYear If true, includes the year
 * @returns Formatted date string
 */
export function formatDateSpanish(date: Date, includeYear = true): string {
  if (!date || isNaN(date.getTime())) return '';
  const pattern = includeYear ? 'dd \'de\' MMMM \'de\' yyyy' : 'dd \'de\' MMMM';
  return format(date, pattern, { locale: es });
}

/**
 * Formats a Date object to dd/MM/yyyy format
 * @param date The date to format
 * @returns Formatted date string (e.g., "15/01/2024")
 */
export function formatDateDDMMYYYY(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  return format(date, 'dd/MM/yyyy');
}

/**
 * Formats a Date object to HH:mm format
 * @param date The date to format
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTime(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  return format(date, 'HH:mm');
}

/**
 * Formats a time string from Excel serial number (fraction of a day)
 * @param timeValue Excel time serial number or string
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatFlightTime(timeValue: any): string {
  if (!timeValue) return '';
  
  if (typeof timeValue === 'string') {
    return timeValue.substring(0, 5);
  }
  
  if (typeof timeValue === 'number' && timeValue > 0 && timeValue < 1) {
    // Excel time serial number (fraction of a day)
    const totalSeconds = Math.round(timeValue * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  
  return '';
}

/**
 * Formats an order name with date and file number
 * @param date The order date
 * @param fileNumber The file/program number
 * @returns Formatted order name (e.g., "ODS_15_ENERO_2024_PROG01")
 */
export function formatOrderName(date: Date, fileNumber: string): string {
  const datePart = format(date, 'dd_MMMM_yyyy', { locale: es }).toUpperCase();
  return `ODS_${datePart}_${fileNumber.replace(/[\s/]/g, '_')}`;
}

/**
 * Parses a date string in dd/MM/yyyy format to a Date object
 * @param dateStr Date string in dd/MM/yyyy format
 * @returns Date object or null if parsing fails
 */
export function parseDateDDMMYYYY(dateStr: string): Date | null {
  if (!dateStr || !dateStr.includes('/')) return null;
  
  // Validate format: dd/MM/yyyy
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const [dayStr, monthStr, yearStr] = parts;
  if (!/^\d{1,2}$/.test(dayStr) || !/^\d{1,2}$/.test(monthStr) || !/^\d{4}$/.test(yearStr)) {
    return null;
  }
  
  try {
    const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
    // Verify the parsed date is valid
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  } catch (e) {
    console.error(`Failed to parse date: ${dateStr}`, e);
    return null;
  }
}

/**
 * Parses a date string in dd/mm/yy format to a Date object
 * @param dateStr Date string in dd/mm/yy format
 * @returns Date object or null if parsing fails
 */
export function parseDateDDMMYY(dateStr: string): Date | null {
  if (!dateStr || dateStr.split('/').length !== 3) return null;
  try {
    const parts = dateStr.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const yearPart = parseInt(parts[2], 10);
    const year = yearPart < 100 ? yearPart + 2000 : yearPart;
    const date = new Date(Date.UTC(year, month, day));
    
    if (isNaN(date.getTime()) || date.getUTCDate() !== day || date.getUTCMonth() !== month) {
      console.warn(`Invalid date parsed for string: ${dateStr}`);
      return null;
    }
    return date;
  } catch (e) {
    console.error(`Failed to parse date: ${dateStr}`, e);
    return null;
  }
}

/**
 * Normalizes a time string to HH:mm format
 * Accepts numeric input (e.g., "1430" or "14:30") and normalizes to "14:30"
 * @param timeValue Raw time input
 * @returns Normalized time string or empty string
 */
export function normalizeTime(timeValue: string): string {
  if (!timeValue) return '';
  
  const numbersOnly = timeValue.replace(/[^0-9]/g, '');
  if (numbersOnly.length !== 4) return '';
  
  return `${numbersOnly.slice(0, 2)}:${numbersOnly.slice(2, 4)}`;
}

/**
 * Formats a number as currency (COP or USD)
 * @param amount The amount to format
 * @param currency Currency code ('COP' or 'USD')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: 'COP' | 'USD' = 'COP'): string {
  const formatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'COP' ? 0 : 2,
  });
  return formatter.format(amount);
}

/**
 * Converts a 24-hour time string to 12-hour format with AM/PM
 * @param time24 Time in HH:mm format
 * @returns Time in 12-hour format (e.g., "2:30 PM")
 */
export function convertTo12Hour(time24: string): string {
  if (!time24 || !time24.includes(':')) return '';
  
  try {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
  } catch (e) {
    console.error(`Failed to convert time: ${time24}`, e);
    return '';
  }
}
/**
 * Formats a Date to ISO format (yyyy-MM-dd)
 * Useful for API calls and date range queries
 * @param date The date to format
 * @returns Formatted date string (e.g., "2024-01-15")
 */
export function formatISO(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  return format(date, 'yyyy-MM-dd');
}