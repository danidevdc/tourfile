
"use client";

import * as XLSX from 'xlsx';
import type { ServiceOrderRule } from './serviceOrderRuleService';
import type { Activity, PredefinedFlight, ServiceItem } from './serviceOrderService';
import { normalizeExcelCell, getExcelColumn } from './excel-utils';
import { getValidDateFromExcelCell, isValidTime } from './validators';
import { formatDateDDMMYYYY, normalizeTime } from './formatters';

/**
 * Normalizes a string for comparison by removing spaces and slashes and converting to uppercase.
 * @param str The string to normalize.
 * @returns The normalized string.
 */
const normalizeComparisonString = (str: string): string => {
    return str.replace(/[\s/]/g, '').toUpperCase();
}

/**
 * Checks if a value from an Excel cell is a valid date (either a Date object or an Excel serial number).
 * @param cellValue The value from the cell.
 * @returns The Date object if it's a valid date, otherwise null.
 */
const getValidDateFromCell = (cellValue: any): Date | null => {
    return getValidDateFromExcelCell(cellValue);
};


/**
 * Generates a list of services by processing a specific column from Excel data against a set of rules.
 * This version iterates through each row of the specified column and checks ALL active rules against each cell
 * to find multiple potential activities within a single cell. It now also extracts the date from Column A.
 * @param excelData The full 2D array of data from the Excel sheet.
 * @param fileColumnIndex The index of the column where the File Number was found.
 * @param rules An array of active service order rules to apply.
 * @param activities The list of all activities from the database, used to find suggested times.
 * @param flights The list of all predefined flights from the database, used for automatic detection.
 * @returns An array of generated ServiceItem objects, in the order they were found.
 */
export function generateServicesFromExcelColumn(
  excelData: any[][] | null,
  fileColumnIndex: number,
  rules: ServiceOrderRule[],
  activities: Activity[],
  flights: PredefinedFlight[]
): ServiceItem[] {
  if (!excelData || fileColumnIndex === -1) {
    return [];
  }

  const generatedServices: ServiceItem[] = [];
  const activeRules = rules.filter(r => r.isActive).sort((a, b) => b.keyword.length - a.keyword.length); 
  const activityMap = new Map(activities.map(a => [a.name.toUpperCase(), a]));
  
  let currentDate: string = ''; // Variable to hold the last seen date

  // Iterate over each row of the excel data
  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row) continue;

    // --- Step 1: Check for and update the current date from Column A (index 0) ---
    const dateCell = row[0];
    const validDate = getValidDateFromCell(dateCell);
    if (validDate) {
        currentDate = formatDateDDMMYYYY(validDate);
    }

    // --- Step 2: Check for activities in the file's column ---
    const activityText = row[fileColumnIndex] ? String(row[fileColumnIndex]).trim().toUpperCase() : '';

    if (activityText) {
      for (const rule of activeRules) {
        if (activityText.includes(rule.keyword.toUpperCase())) {
          
          const matchedActivity = activityMap.get(rule.activity.toUpperCase());
          // let suggestedTime = matchedActivity?.suggestedTime || ''; // DISABLED LEARNING FEATURE
          let suggestedTime = '';
          let detectedFlight: PredefinedFlight | null = null;
          
          const isTransfer = rule.activity.toUpperCase().includes('TRF');
          if (isTransfer) {
              const normalizedActivityText = normalizeComparisonString(activityText);
              let bestMatch: PredefinedFlight | null = null;

              for (const flight of flights) {
                  const normalizedFlightNumber = normalizeComparisonString(flight.flightNumber);
                  if (normalizedActivityText.includes(normalizedFlightNumber)) {
                      if (!bestMatch || normalizedFlightNumber.length > normalizeComparisonString(bestMatch.flightNumber).length) {
                          bestMatch = flight;
                      }
                  }
              }
              detectedFlight = bestMatch;
          }

          if (detectedFlight) {
            suggestedTime = detectedFlight.time;
          }

          generatedServices.push({
            fecha: currentDate, // Assign the last seen date
            hora: suggestedTime,
            servicio: rule.activity,
            vuelo: detectedFlight?.flightNumber || '',
            guia: '',
            bus: '',
            chofer: '',
            observaciones: detectedFlight?.observations || '',
          });
        }
      }
    }
  }

  return generatedServices;
}
