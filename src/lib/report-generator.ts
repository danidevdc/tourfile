// src/lib/report-generator.ts
import * as XLSX from 'xlsx';
import { getExpenseRulesFromFirestore, type ExpenseRule } from './ruleService';
import { formatDateDDMMYYYY } from './formatters';
import { isNumericString, isValidPaxFormat } from './validators-server';

export type FileSearchStatus = "idle" | "searching" | "found" | "not_found" | "error";

export interface ExpenseItem {
  date: string;
  quantity: string; // The formula string itself, e.g., "=$G$3+1"
  detail: string;
  unitPrice: number;
  total: number; // Pre-calculated total for display purposes if needed
  vobOps?: string;
}

export interface GeneratedReportInfo {
  id: string;
  fileNumber: string;
  guideName: string;
  originalProgramFileName: string;
  groupName: string;
  paxCount: string;
  generationDate: Date;
  occurrenceCount: number;
  isDuplicateInstance: boolean;
  expenseItems: ExpenseItem[];
  startDate: string;
}

export interface FileDataProps {
  fileIdRowIndex: number | null;
  columnIndex: number | null;
}

// Helper function to parse PAX count, handling formats like "16+1"
export function parsePaxCount(paxString: string): number {
  if (!paxString || !isValidPaxFormat(paxString)) return 0;

  const trimmedPax = paxString.trim();
  if (trimmedPax.includes('+')) {
    const parts = trimmedPax.split('+').map(part => parseInt(part.trim(), 10));
    // Ensure we have exactly two valid numbers to sum
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] + parts[1];
    }
  }

  // Fallback for single numbers
  const num = parseInt(trimmedPax, 10);
  return isNaN(num) ? 0 : num;
}


export function resolveQuantity(quantityStr: string, paxNumber: number): number {
  if (paxNumber === 0 && quantityStr.toUpperCase().includes("$G$3")) return 0;
  if (isNumericString(quantityStr)) {
    return Number(quantityStr);
  }

  const cleanedQuantity = String(quantityStr).toUpperCase().replace(/\s/g, '');
  const formulaWithPax = cleanedQuantity.replace(/\$G\$3/g, String(paxNumber));


  if (formulaWithPax.startsWith('=')) {
    try {
      const expression = formulaWithPax.substring(1);
      if (/^[\d\s()+\-*/.]+$/.test(expression)) {
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${expression}`)() as number;
        return isNaN(result) ? 1 : result;
      } else {
        return 1;
      }
    } catch (e) {
      return 1;
    }
  }
  return 1;
}

// The main generation function is now async to fetch rules from Firestore
export async function generateExpenseDetails(
  excelData: any[][] | null,
  fileData: FileDataProps,
  paxCountString: string
): Promise<{ expenses: ExpenseItem[], tourStartDate: string }> {

  const expenseItems: ExpenseItem[] = [];
  if (!excelData || fileData.columnIndex === null || fileData.fileIdRowIndex === null) {
    return { expenses: [], tourStartDate: "N/A" };
  }

  const columnIndex = fileData.columnIndex;
  const fileIdRowIndex = fileData.fileIdRowIndex;

  const paxNum = parsePaxCount(paxCountString);
  if (paxNum === 0) {
    console.error("Número de PAX no válido o no encontrado:", paxCountString);
    return { expenses: [], tourStartDate: "N/A" };
  }

  // --- Fetch Dynamic Rules from Firestore ---
  let rules: ExpenseRule[] = [];
  try {
    rules = await getExpenseRulesFromFirestore('La Paz');
    if (rules.length === 0) {
      throw new Error("No se encontraron reglas configuradas en la base de datos.");
    }
  } catch (error) {
    console.error("Failed to fetch expense rules from Firestore:", error);
    // Rethrow to be caught by the UI
    throw new Error(error instanceof Error ? error.message : "Error al conectar con la base de datos para obtener las reglas.");
  }

  // CRITICAL FIX: Ensure only active rules are used for generation.
  const activeRules = rules.filter(r => r.isActive).sort((a, b) => a.order - b.order);

  // Helper function to parse date from cell
  const parseDateFromCell = (cellValue: any): string | null => {
    if (!cellValue) return null;
    
    let parsedDateObj: Date | null = null;
    if (cellValue instanceof Date) {
      parsedDateObj = cellValue;
    } else if (typeof cellValue === 'number' && cellValue > 25569) {
      const parsed = XLSX.SSF.parse_date_code(cellValue);
      if (parsed) {
        parsedDateObj = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0));
      }
    }

    if (parsedDateObj && !isNaN(parsedDateObj.valueOf())) {
      const day = String(parsedDateObj.getUTCDate()).padStart(2, '0');
      const month = String(parsedDateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = String(parsedDateObj.getUTCFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    }
    
    return null;
  };

  // Track current date and matched rules as we iterate (similar to service generator)
  let currentDate = "N/A";
  let firstDateFound = "N/A"; // For tourStartDate return value
  const matchedRules = new Map<string, string>(); // keyword (lowercase) -> date when first found

  // Iterate row by row to detect dates and keywords together
  for (let i = fileIdRowIndex; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row) continue;

    // Check Column A (index 0) for date updates (like service generator)
    const dateCell = row[0];
    const parsedDate = parseDateFromCell(dateCell);
    if (parsedDate) {
      currentDate = parsedDate;
      if (firstDateFound === "N/A") {
        firstDateFound = parsedDate;
      }
    }

    // Check program column for keywords
    const cellValue = row[columnIndex];
    if (!cellValue) continue;

    const cellText = String(cellValue).toLowerCase();

    // Check each active rule - mark first occurrence with current date
    for (const rule of activeRules) {
      const keywordLower = rule.keyword.toLowerCase();
      // Skip if already matched (only want first occurrence)
      if (matchedRules.has(keywordLower)) continue;

      // Use word boundary regex to match keyword as complete word (not as part of another word)
      // e.g., "am" matches "AM" but not "FAMILY" or "PROGRAM"
      const regex = new RegExp(`\\b${keywordLower}\\b`, 'i');
      if (regex.test(cellText)) {
        // Record this keyword was found at current date (store in lowercase for consistency)
        matchedRules.set(keywordLower, currentDate);
      }
    }
  }

  // --- Generate Expense Items for Matched Rules ---
  for (const rule of activeRules) {
    const keywordLower = rule.keyword.toLowerCase();
    const matchedDate = matchedRules.get(keywordLower);
    
    if (matchedDate) {
      // AGUAS items should not have a date
      const itemDate = rule.detail === 'AGUAS' ? '' : matchedDate;

      const newItem: ExpenseItem = {
        date: itemDate,
        quantity: rule.quantityFormula,
        detail: rule.detail,
        unitPrice: rule.unitPrice,
        total: resolveQuantity(rule.quantityFormula, paxNum) * rule.unitPrice,
        vobOps: rule.vobOps,
      };
      expenseItems.push(newItem);
    }
  }

  // Helper to convert dd/MM/yy to comparable Date object
  const parseDisplayDate = (dateStr: string): Date | null => {
    if (!dateStr || dateStr === 'N/A') return null;
    const [day, month, year] = dateStr.split('/').map(Number);
    if (!day || !month || !year) return null;
    // Assume 20xx for 2-digit year
    const fullYear = year < 100 ? 2000 + year : year;
    return new Date(fullYear, month - 1, day);
  };

  // Sort expense items by date (ascending - oldest first)
  // Items without dates (like AGUAS) go to the end
  expenseItems.sort((a, b) => {
    const dateA = parseDisplayDate(a.date);
    const dateB = parseDisplayDate(b.date);
    
    // Items without dates go to the end
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    // Sort ascending (oldest first)
    return dateA.getTime() - dateB.getTime();
  });

  return { expenses: expenseItems, tourStartDate: firstDateFound };
}
