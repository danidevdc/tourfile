
// src/lib/report-generator.ts
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getExpenseRulesFromFirestore } from './ruleService';

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

// This function is kept for legacy or display purposes, but the core logic
// for quantity is now the formula string itself.
export function resolveQuantity(quantityStr: string, paxNumber: number): number {
  if (paxNumber === 0 && quantityStr.toUpperCase().includes("$G$3")) return 0;
  if (!isNaN(Number(quantityStr))) {
    return Number(quantityStr);
  }

  const cleanedQuantity = String(quantityStr).toUpperCase().replace(/\s/g, '');
  // Replace absolute or relative G3 reference with the actual PAX number for calculation
  const formulaWithPax = cleanedQuantity.replace(/\$G\$3/g, String(paxNumber));


  if (formulaWithPax.startsWith('=')) {
    try {
      const expression = formulaWithPax.substring(1);
      // Basic check for safe characters to prevent arbitrary code execution
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
  paxCountString: string,
  groupName: string
): Promise<{ expenses: ExpenseItem[], tourStartDate: string }> {

  const expenseItems: ExpenseItem[] = [];
  if (!excelData || fileData.columnIndex === null || fileData.fileIdRowIndex === null) {
    return { expenses: [], tourStartDate: "N/A" };
  }

  const columnIndex = fileData.columnIndex;
  const fileIdRowIndex = fileData.fileIdRowIndex;

  // --- Find Tour Start Date ---
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
      tourStartDate = format(tourStartDateRaw, 'dd/MM/yy');
      break;
    }
  }
  
  const paxNum = parseInt(paxCountString, 10);
  if (isNaN(paxNum)) {
    console.error("Número de PAX no válido o no encontrado:", paxCountString);
    return { expenses: [], tourStartDate: "N/A" };
  }
  
  // --- Fetch Dynamic Rules from Firestore ---
  const rules = await getExpenseRulesFromFirestore('La Paz');
  const activeRules = rules.filter(r => r.isActive).sort((a,b) => a.order - b.order);
  
  const columnData = excelData.map(row => String(row[columnIndex] || '').toLowerCase());
  const contiene = (keyword: string) => columnData.some(cell => cell.includes(keyword.toLowerCase()));

  // --- Apply Rules to Generate Expenses ---
  for (const rule of activeRules) {
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
        // Pre-calculate total for simple display purposes if needed, though Excel will do the final calculation
        total: resolveQuantity(rule.quantityFormula, paxNum) * rule.unitPrice,
        vobOps: rule.vobOps,
      };
      expenseItems.push(newItem);
    }
  }

  // --- Handle Complex/Multi-condition Rules ---
  // The "AGUAS" rule is complex because its quantity depends on other conditions.
  // A simple keyword match is not enough. We'll handle it outside the main loop.
  const cityTourRule = activeRules.find(r => r.keyword.toLowerCase() === 'ct-city tour');
  if (cityTourRule) {
      const isTiwanakuPresent = contiene('tiwanaku');
      // If Tiwanaku is also present, the quantity formula should be different.
      // This is an example of logic that's hard to capture in a simple rule.
      // For now, we assume the base rule is enough, but this could be expanded.
      // E.g., add a new property to the rule like "conditionalQuantityFormula"
      if (isTiwanakuPresent) {
         console.log("Tiwanaku detected alongside City Tour, complex rule could apply for AGUAS.");
         // In a more advanced system, you might modify the quantity here.
         // For now, we'll just use the one from the database.
      }
  }


  return { expenses: expenseItems, tourStartDate };
}
