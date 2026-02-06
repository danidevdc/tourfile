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

  let tourStartDateRaw: Date | null = null;
  let tourStartDate = "N/A";

  for (let i = fileIdRowIndex; i < excelData.length; i++) {
    const cellValue = excelData[i]?.[columnIndex];
    if (!cellValue) continue;

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
      tourStartDateRaw = parsedDateObj;
      // Format as dd/MM/yy
      const day = String(parsedDateObj.getUTCDate()).padStart(2, '0');
      const month = String(parsedDateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = String(parsedDateObj.getUTCFullYear()).slice(-2);
      tourStartDate = `${day}/${month}/${year}`;
      break;
    }
  }

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

  // Prepare column data for searching. Convert to lower case once for efficiency.
  const columnData = excelData.map(row => String(row[columnIndex] || '').toLowerCase());
  const contiene = (keyword: string) => columnData.some(cell => cell.includes(keyword.toLowerCase()));

  // --- Apply Rules to Generate Expenses ---
  for (const rule of activeRules) { // Iterate over ACTIVE rules only
    if (contiene(rule.keyword)) {
      // Handle special case for 'AM' which also requires 'City Tour'
      if (rule.keyword.toLowerCase() === 'am' && !contiene('city tour')) {
        continue;
      }

      const newItem: ExpenseItem = {
        date: tourStartDate,
        quantity: rule.quantityFormula,
        detail: rule.detail,
        unitPrice: rule.unitPrice,
        total: resolveQuantity(rule.quantityFormula, paxNum) * rule.unitPrice,
        vobOps: rule.vobOps,
      };
      expenseItems.push(newItem);
    }
  }

  return { expenses: expenseItems, tourStartDate };
}
