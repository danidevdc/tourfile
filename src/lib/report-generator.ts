// src/lib/report-generator.ts
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export type FileSearchStatus = "idle" | "searching" | "found" | "not_found" | "error";

export interface ExpenseItem {
  date: string;
  quantity: string;
  detail: string;
  unitPrice: number;
  total: number;
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

export function resolveQuantity(quantityStr: string, paxNumber: number): number {
  if (paxNumber === 0 && quantityStr.toUpperCase().includes("G3")) return 0;
  if (!isNaN(Number(quantityStr))) {
    return Number(quantityStr);
  }

  const cleanedQuantity = quantityStr.toUpperCase().replace(/\s/g, '');
  const formulaWithPax = cleanedQuantity.replace(/(?<![A-Z])G3(?![0-9A-Z])|\$G\$3/g, String(paxNumber));


  if (formulaWithPax.startsWith('=')) {
    try {
      const expression = formulaWithPax.substring(1);
      if (/^[\d\s()+\-*/.]+$/.test(expression)) {
        // Ensure that the expression is safe before evaluating
        // For example, check for allowed characters or structure
        const result = new Function(`return ${expression}`)() as number;
        return isNaN(result) ? 1 : result; // Default to 1 if evaluation fails or results in NaN
      } else {
        // console.warn(`Fórmula de cantidad no segura o no válida: ${expression} (original: ${quantityStr})`);
        return 1; // Default if potentially unsafe
      }
    } catch (e) {
      // console.error(`Error evaluando cantidad "${quantityStr}" con expresión "${formulaWithPax.substring(1)}":`, e);
      return 1; // Default to 1 on error
    }
  }
  // console.warn(`Cantidad no reconocida: ${quantityStr}`);
  return 1; // Default if not a number or recognized formula
}

export function generateExpenseDetails(
  excelData: any[][] | null,
  fileData: FileDataProps,
  paxCountString: string,
  groupName: string
): { expenses: ExpenseItem[], tourStartDate: string } {

  const expenseItems: ExpenseItem[] = [];
  if (!excelData || fileData.columnIndex === null || fileData.fileIdRowIndex === null) {
    return { expenses: [], tourStartDate: "N/A" };
  }

  const columnIndex = fileData.columnIndex;
  const fileIdRowIndex = fileData.fileIdRowIndex;

  // --- Nueva lógica dinámica para encontrar fecha y PAX ---
  let dateRowIndex = -1;
  let tourStartDateRaw: Date | null = null;
  let tourStartDate = "N/A";
  
  // Buscar dinámicamente la fecha en la columna del file
  for (let i = fileIdRowIndex; i < excelData.length; i++) {
    const cellValue = excelData[i]?.[columnIndex];
    if (!cellValue) continue;

    let parsedDateObj: Date | null = null;
    if (cellValue instanceof Date) {
      parsedDateObj = cellValue;
    } else if (typeof cellValue === 'number' && cellValue > 25569) { // Excel serial date check
      const parsed = XLSX.SSF.parse_date_code(cellValue);
      if (parsed) {
        parsedDateObj = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
      }
    }

    if (parsedDateObj && !isNaN(parsedDateObj.valueOf())) {
      tourStartDateRaw = parsedDateObj;
      tourStartDate = format(tourStartDateRaw, 'dd/MM/yy');
      dateRowIndex = i;
      break; // Encontramos la primera fecha válida, la usamos
    }
  }

  // Obtener PAX count de la fila siguiente a la fecha encontrada
  let actualPaxCountString = "0"; // Default to 0 if not found
  if (dateRowIndex !== -1) {
    const paxRaw = excelData[dateRowIndex + 1]?.[columnIndex];
    if (paxRaw !== null && paxRaw !== undefined) {
      actualPaxCountString = String(paxRaw).trim();
    }
  }

  const paxNum = parseInt(actualPaxCountString, 10);
  if (isNaN(paxNum)) {
    console.error("Número de PAX no válido o no encontrado:", actualPaxCountString);
    return { expenses: [], tourStartDate: "N/A" };
  }
  // --- Fin de la nueva lógica ---

  const guia = 1;

  const columnData = excelData.map(row => String(row[columnIndex] || '').toLowerCase());

  const contiene = (keyword: string) => columnData.some(cell => cell.includes(keyword.toLowerCase()));

  const contiene_desaguadero = contiene("desaguadero");
  const contiene_puno = contiene("Puno/Kasani");
  const contiene_isla = contiene("I.Sol") || contiene("Isla del Sol");
  const contiene_trf_in = contiene("CT-Private transfer from airport to hotel");
  const contiene_tiwa = contiene("Tiwanaku");
  const contiene_teleferico = contiene("Cable Car") || contiene("teleferico");
  const contiene_valle = contiene("Moon Valley") || contiene("valle de la luna");
  const contiene_city_continuado_am = contiene("AM");
  const contiene_kasani = contiene("Kasani/Puno");
  const contiene_trf_out = contiene("CT-Private transfer from hotel to airport");
  const contiene_aguas_ct_city_tour = contiene("CT-City Tour");
  const contiene_city_tour_general = contiene("City Tour");

  if (contiene_desaguadero) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "MALETAS FRONTERA", unitPrice: 3.00, total: resolveQuantity(quantityStr, paxNum) * 3.00 });
  }

  if (contiene_puno) {
    const itemsPuno = [
      { quantityStr: String(guia), detail: "TAXI DOM - OFICINA", unitPrice: 30.00 },
      { quantityStr: String(guia), detail: "BUS LPB - COPA", unitPrice: 40.00 },
      { quantityStr: String(guia), detail: "DESAYUNO GUIA", unitPrice: 20.00 },
    ];
    itemsPuno.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_isla) {
    const itemsIsla = [
      { quantityStr: String(guia), detail: "TAXI DOM - HOTEL", unitPrice: 30.00 },
      { quantityStr: "=$G$3", detail: "ISLA DEL SOL", unitPrice: 10.00 },
      { quantityStr: "=$G$3", detail: "ISLA DE LA LUNA", unitPrice: 10.00 },
    ];
    itemsIsla.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_trf_in) {
    const itemsTrfIn = [
      { quantityStr: String(guia), detail: "TAXI DOM - OFICINA", unitPrice: 30.00 },
      { quantityStr: "=$G$3", detail: "MALETAS AEROPUERTO", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "TAXI HOTEL - DOM", unitPrice: 30.00 },
    ];
    itemsTrfIn.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_tiwa) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "TIWANAKU", unitPrice: 100.00, total: resolveQuantity(quantityStr, paxNum) * 100.00 });
  }

  if (contiene_teleferico) {
    const quantityStr = "=$G$3+1";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "TELEFERICO", unitPrice: 7.00, total: resolveQuantity(quantityStr, paxNum) * 7.00 });
  }

  if (contiene_valle) {
    const quantityStr = "=$G$3";
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "VALLE", unitPrice: 20.00, total: resolveQuantity(quantityStr, paxNum) * 20.00 });
  }

  if (contiene_city_continuado_am && contiene_city_tour_general) {
    const quantityStr = String(guia);
    expenseItems.push({ date: tourStartDate, quantity: quantityStr, detail: "ALMUERZO GUIA", unitPrice: 35.00, total: resolveQuantity(quantityStr, paxNum) * 35.00 });
  }

  if (contiene_kasani) {
     const itemsKasani = [
      { quantityStr: "=$G$3", detail: "MALETAS FRONTERA", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "BUS COPA - LPB", unitPrice: 40.00 },
    ];
    itemsKasani.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_trf_out) {
    const itemsTrfOut = [
      { quantityStr: String(guia), detail: "TAXI DOM - HOTEL", unitPrice: 30.00 },
      { quantityStr: "=$G$3", detail: "MALETAS AEROPUERTO", unitPrice: 3.00 },
      { quantityStr: String(guia), detail: "TAXI CENTRO - DOM", unitPrice: 30.00 },
    ];
    itemsTrfOut.forEach(item => expenseItems.push({ date: tourStartDate, quantity: item.quantityStr, detail: item.detail, unitPrice: item.unitPrice, total: resolveQuantity(item.quantityStr, paxNum) * item.unitPrice }));
  }

  if (contiene_aguas_ct_city_tour) {
    let cantidadFormulaAguas = "=$G$3+2";
    if (contiene_city_tour_general && contiene_tiwa) {
        cantidadFormulaAguas = "=($G$3+2)*2";
    }
    expenseItems.push({
        date: "",
        quantity: cantidadFormulaAguas,
        detail: "AGUAS",
        unitPrice: 6.00,
        total: resolveQuantity(cantidadFormulaAguas, paxNum) * 6.00
    });
  }

  return { expenses: expenseItems, tourStartDate };
}
