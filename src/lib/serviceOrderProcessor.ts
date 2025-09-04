
"use client";

import type { ServiceItem } from './serviceOrderService';
import type { ServiceOrderRule } from './serviceOrderRuleService';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';


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
  const activeRules = rules.filter(r => r.isActive).sort((a, b) => (b.keyword.length - a.keyword.length)); // Sort by keyword length descending to match longer keywords first

  let firstDateFound = false;

  // Iterate over each row of the excel data
  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row) continue;

    const dateCell = row[fileColumnIndex];
    let isDateRow = false;

    // Check if the current row contains a valid date in the file column
    if (dateCell instanceof Date && !isNaN(dateCell.valueOf())) {
      isDateRow = true;
      firstDateFound = true;
    } else if (typeof dateCell === 'number' && dateCell > 25569) { // Excel serial date check
        const parsed = XLSX.SSF.parse_date_code(dateCell);
        if (parsed) {
          isDateRow = true;
          firstDateFound = true;
        }
    }

    if (!firstDateFound) {
        continue; // Skip rows until we find the first date
    }
    
    // The activity description is in the column to the right of the date column
    const activityCellIndex = fileColumnIndex + 1;
    const activityText = row[activityCellIndex] ? String(row[activityCellIndex]).trim().toUpperCase() : '';

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
