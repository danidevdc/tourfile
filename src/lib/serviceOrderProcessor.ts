
"use client";

import type { ServiceOrderRule } from './serviceOrderRuleService';
import type { ServiceItem } from './serviceOrderService';

/**
 * Generates a list of services by processing a specific column from Excel data against a set of rules.
 * This version iterates through the Excel rows and checks all rules against each row for matches.
 * @param excelData The full 2D array of data from the Excel sheet.
 * @param fileColumnIndex The index of the column where the File Number was found.
 * @param rules An array of active service order rules to apply.
 * @returns An array of generated ServiceItem objects, in the order they were found.
 */
export function generateServicesFromExcelColumn(
  excelData: any[][] | null,
  fileColumnIndex: number,
  rules: ServiceOrderRule[]
): ServiceItem[] {
  if (!excelData || fileColumnIndex === -1) {
    return [];
  }

  const generatedServices: ServiceItem[] = [];
  // Sort by keyword length descending to match longer keywords first, preventing "CITY TOUR" from matching before "HD CITY TOUR" if both were present.
  const activeRules = rules.filter(r => r.isActive).sort((a, b) => b.keyword.length - a.keyword.length); 

  let firstDateFound = false;

  // Iterate over each row of the excel data
  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row) continue;

    // The activity text is in the SAME column as the file number.
    const activityText = row[fileColumnIndex] ? String(row[fileColumnIndex]).trim().toUpperCase() : '';

    if (activityText) {
      // Find the first rule that matches the activity text
      const matchingRule = activeRules.find(rule => activityText.includes(rule.keyword.toUpperCase()));

      if (matchingRule) {
        generatedServices.push({
          fecha: '', // Leave blank for manual input
          hora: '',  // Leave blank for manual input
          servicio: matchingRule.activity,
          vuelo: '',
          guia: '',
          bus: '',
          chofer: '',
          observaciones: '',
        });
      }
    }
  }

  return generatedServices;
}
