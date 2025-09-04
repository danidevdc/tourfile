
import type { ServiceItem } from './serviceOrderService';
import type { ServiceOrderRule } from './serviceOrderRuleService';

/**
 * Generates a list of services by processing a specific column from Excel data against a set of rules.
 * @param excelData The full 2D array of data from the Excel sheet.
 * @param columnIndex The index of the column to process.
 * @param rules An array of service order rules to apply.
 * @returns An array of generated ServiceItem objects.
 */
export function generateServicesFromExcelColumn(
  excelData: any[][] | null,
  columnIndex: number,
  rules: ServiceOrderRule[]
): ServiceItem[] {
  if (!excelData || columnIndex === -1) {
    return [];
  }

  const generatedServices: ServiceItem[] = [];
  const activeRules = rules.filter(r => r.isActive);

  // Extract all non-empty, string-convertible cell values from the target and adjacent columns.
  // The structure { value, row } helps in associating found keywords with their original row.
  const serviceColumnValues = excelData
    .map((row, rowIndex) => ({ value: row[columnIndex + 1] ? String(row[columnIndex + 1]).trim().toUpperCase() : '', row: rowIndex }))
    .filter(item => item.value !== '');
    
  // Iterate over each rule and check for its keyword in the extracted column values.
  for (const rule of activeRules) {
    const keyword = rule.keyword.toUpperCase();

    // Check if any cell in the service column includes the keyword.
    // This is more flexible than an exact match.
    const matchingCells = serviceColumnValues.filter(cell => cell.value.includes(keyword));

    for (const match of matchingCells) {
        // We found a match, now create a service item.
        // Date and time are left blank as per the new requirement.
        generatedServices.push({
            fecha: '', // User will fill this manually
            hora: '',  // User will fill this manually
            servicio: rule.activity, // The matched activity from the rule
            vuelo: '', // Default empty values
            guia: '',
            bus: '',
            chofer: '',
            observaciones: '',
        });
    }
  }

  // A simple way to remove duplicate services if a keyword matches multiple times for the same activity
  const uniqueServices = Array.from(new Map(generatedServices.map(item => [item.servicio, item])).values());

  return uniqueServices;
}
