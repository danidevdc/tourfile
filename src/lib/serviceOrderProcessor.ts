
"use client";

import type { ServiceOrderRule } from './serviceOrderRuleService';
import type { Activity, PredefinedFlight, ServiceItem } from './serviceOrderService';

/**
 * Normalizes a string for comparison by removing spaces and slashes and converting to uppercase.
 * @param str The string to normalize.
 * @returns The normalized string.
 */
const normalizeComparisonString = (str: string): string => {
    return str.replace(/[\s/]/g, '').toUpperCase();
}

/**
 * Generates a list of services by processing a specific column from Excel data against a set of rules.
 * This version iterates through each row of the specified column and checks ALL active rules against each cell
 * to find multiple potential activities within a single cell.
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
  // Sort by keyword length descending to match longer keywords first ("HD CITY TOUR" before "CITY TOUR").
  const activeRules = rules.filter(r => r.isActive).sort((a, b) => b.keyword.length - a.keyword.length); 
  const activityMap = new Map(activities.map(a => [a.name.toUpperCase(), a]));

  // Iterate over each row of the excel data in the specified column
  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row) continue;

    const activityText = row[fileColumnIndex] ? String(row[fileColumnIndex]).trim().toUpperCase() : '';

    if (activityText) {
      // For each cell, iterate through ALL active rules to find potential matches.
      for (const rule of activeRules) {
        if (activityText.includes(rule.keyword.toUpperCase())) {
          
          const matchedActivity = activityMap.get(rule.activity.toUpperCase());
          let suggestedTime = matchedActivity?.suggestedTime || '';
          let detectedFlight: PredefinedFlight | null = null;
          
          const isTransfer = rule.activity.toUpperCase().includes('TRF');
          if (isTransfer) {
              const normalizedActivityText = normalizeComparisonString(activityText);
              for (const flight of flights) {
                  const normalizedFlightNumber = normalizeComparisonString(flight.flightNumber);
                  if (normalizedActivityText.includes(normalizedFlightNumber)) {
                      detectedFlight = flight; // Store the whole flight object
                      break; 
                  }
              }
          }

          // If a flight was detected, its data overrides any defaults.
          if (detectedFlight) {
            suggestedTime = detectedFlight.time;
          }

          // If a match is found, add the corresponding service.
          generatedServices.push({
            fecha: '', // To be filled manually
            hora: suggestedTime,  // Use flight time or suggested time
            servicio: rule.activity, // Use the activity from the rule
            vuelo: detectedFlight?.flightNumber || '', // Populate detected flight number
            guia: '',
            bus: '',
            chofer: '',
            observaciones: detectedFlight?.observations || '', // Populate flight observations
          });
        }
      }
    }
  }

  return generatedServices;
}
