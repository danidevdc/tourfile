
// src/lib/excel-export.ts
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { GeneratedReportInfo, ExpenseItem } from '@/app/generator/page';

// Helper to ensure cell object exists (not strictly needed with aoa_to_sheet if we build cell objects directly)
// function ensureCell(ws: XLSX.WorkSheet, address: string): XLSX.CellObject {
//   if (!ws[address]) {
//     ws[address] = { t: 's', v: '' }; 
//   }
//   return ws[address];
// }

// function applyStyle(ws: XLSX.WorkSheet, address: string, style: Partial<XLSX.CellStyle>) {
//   const cell = ensureCell(ws, address);
//   cell.s = { ...(cell.s || {}), ...style };
// }

// function applyBold(ws: XLSX.WorkSheet, address: string) {
//   const cell = ensureCell(ws, address);
//   cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), bold: true } };
// }

// function applyFontSize(ws: XLSX.WorkSheet, address: string, sz: number) {
//     const cell = ensureCell(ws, address);
//     cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), sz: sz } };
// }

// function applyAlignment(ws: XLSX.WorkSheet, address: string, alignment: XLSX.Alignment) {
//     const cell = ensureCell(ws, address);
//     cell.s = { ...(cell.s || {}), alignment: alignment };
// }


export function downloadReportAsExcel(report: GeneratedReportInfo): void {
  let startDateForFileName = report.startDate;
  try {
    if (report.startDate && report.startDate.includes('/')) {
        const [d, m, yyyyOrYy] = report.startDate.split('/');
        const year = yyyyOrYy.length === 2 ? `20${yyyyOrYy}` : yyyyOrYy;
        startDateForFileName = `${d}.${m}.${year}`;
    } else if (report.startDate) { // If already in dd.MM.yyyy or other format, use as is if parseable
        const parsed = new Date(report.startDate.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$2/$1/$3')); // try to parse dd.MM.yyyy
        if (!isNaN(parsed.valueOf())) {
             startDateForFileName = format(parsed, 'dd.MM.yyyy');
        } else {
            startDateForFileName = format(new Date(), 'dd.MM.yyyy'); // Fallback
        }
    } else {
        startDateForFileName = format(new Date(), 'dd.MM.yyyy'); // Fallback if no start date
    }
  } catch (e) {
    console.warn("Error formatting startDate for file name", e, "Original startDate:", report.startDate);
    startDateForFileName = format(new Date(), 'dd.MM.yyyy'); // Fallback
  }

  // Sanitize group name for filename, similar to Python's multiple replaces
  let sanitizedGroupName = report.groupName;
  const charsToReplace = ['/', ':', '\\*', '\\?', '\\[', '\\]', '\\s', '\\(', '\\)'];
  charsToReplace.forEach(char => {
      const regex = new RegExp(char, 'g');
      sanitizedGroupName = sanitizedGroupName.replace(regex, '_');
  });
  sanitizedGroupName = sanitizedGroupName.replace(/__+/g, '_'); // Replace multiple underscores with one


  const fileName = `G.O. ${startDateForFileName} - ${sanitizedGroupName} - ${report.guideName.toUpperCase().replace(/\s/g, '_')} - ${report.fileNumber}.xlsx`;

  const wb = XLSX.utils.book_new();
  const ws_data: any[][] = [];

  // --- Header Rows ---
  // Row 1: CAJA CHICA GUIA
  ws_data.push([
    { v: "CAJA CHICA GUIA", s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } } },
    null, null, null, null, null, null // Placeholders for merge
  ]);

  // Row 2: FILE: [fileNumber] NOMBRE GUIA: [guideName]
  ws_data.push([
    { v: "FILE:", s: { font: { bold: true } } },
    { v: report.fileNumber, s: { alignment: { horizontal: "center", vertical: "center" } } }, // B2
    null, // C2 - for merge
    { v: "NOMBRE GUIA:", s: { font: { bold: true } } }, // D2
    { v: report.guideName.toUpperCase(), s: { alignment: { horizontal: "center", vertical: "center" } } }, // E2
    null, // F2 - for merge
  ]);

  // Row 3: NOMBRE Y Nº DE PAX: [groupName] Nº [paxCount]
  ws_data.push([
    { v: "NOMBRE Y Nº DE PAX:", s: { font: { bold: true } } }, // A3
    null, null, // B3, C3 - for merge
    { v: report.groupName, s: { alignment: { horizontal: "center", vertical: "center" } } }, // D3
    null, // E3 - for merge
    { v: "Nº", s: { font: { bold: true } } }, // F3
    { v: parseInt(report.paxCount, 10) || 0, t: 'n', s: { font: { bold: true } } }, // G3 (Pax count as number)
  ]);

  // Row 4: Table Headers
  ws_data.push([
    { v: "FECHA", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "CANT", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "DETALLE DEL GASTO", s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } } },
    null, // Merged with DETALLE DEL GASTO
    { v: "PREC. UNIT Bs.", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "TOTAL Bs.", s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "VoB OPS", s: { font: { bold: true }, alignment: { horizontal: "center" } } }
  ]);

  // --- Expense Item Rows ---
  report.expenseItems.forEach((item: ExpenseItem, index: number) => {
    const excelRowNumber = ws_data.length + 1; // 1-based for Excel formulas

    let quantityCell: any;
    const quantityStr = item.quantity.toString();
    if (quantityStr.startsWith('=')) {
      // Formula like "=$G$3" or "=$G$3+1"
      quantityCell = { t: 'n', f: quantityStr.substring(1).replace(/\$G\$3/gi, `G3`) };
    } else if (!isNaN(Number(quantityStr))) {
      quantityCell = { t: 'n', v: Number(quantityStr) };
    } else {
      quantityCell = { t: 's', v: quantityStr }; // Fallback for non-numeric, non-formula strings
    }
    
    ws_data.push([
      { v: item.detail.toUpperCase() === "AGUAS" ? "" : item.date, s: {alignment: {horizontal: "center"}} }, // FECHA
      { ...quantityCell, s: {alignment: {horizontal: "center"}} }, // CANT
      { v: item.detail, s: { alignment: { horizontal: "center", vertical: "center" } } }, // DETALLE DEL GASTO
      null, // Merged with DETALLE
      { v: item.unitPrice, t: 'n', z: '#,##0.00', s: {alignment: {horizontal: "right"}} }, // PREC. UNIT Bs.
      { t: 'n', f: `B${excelRowNumber}*E${excelRowNumber}`, z: '#,##0.00', s: {alignment: {horizontal: "right"}} }, // TOTAL Bs.
      { v: item.vobOps || "", s: {alignment: {horizontal: "center"}} } // VoB OPS
    ]);
  });

  // --- Footer Row (Grand Total) ---
  const firstExpenseDataRow = 5; // 1-based index in Excel sheet for the first data row
  const lastExpenseDataRow = firstExpenseDataRow + report.expenseItems.length - 1;
  let sumFormula = "0";
  if (report.expenseItems.length > 0) {
    sumFormula = `SUM(F${firstExpenseDataRow}:F${lastExpenseDataRow})`;
  }

  ws_data.push([
    null, null, // A, B
    { v: "GASTO TOTAL", s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } } }, // C
    null, null, // D, E - merged with GASTO TOTAL
    { t: 'n', f: sumFormula, z: '#,##0.00', s: { font: { bold: true }, alignment: {horizontal: "right"} } }, // F - Total
  ]);

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // --- Merges ---
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }); // A1:G1 for "CAJA CHICA GUIA"
  
  ws['!merges'].push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }); // B2:C2 for File Number value
  ws['!merges'].push({ s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }); // E2:F2 for Guide Name value

  ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }); // A3:C3 for "NOMBRE Y Nº DE PAX:" label
  ws['!merges'].push({ s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }); // D3:E3 for Group Name value
  
  ws['!merges'].push({ s: { r: 3, c: 2 }, e: { r: 3, c: 3 } }); // C4:D4 for "DETALLE DEL GASTO" header

  report.expenseItems.forEach((_, index) => {
    const itemRowIndexInAOA = 4 + index; // 0-indexed for aoa_to_sheet data array
    ws['!merges']?.push({ s: { r: itemRowIndexInAOA, c: 2 }, e: { r: itemRowIndexInAOA, c: 3 } }); // Merge C:D for item detail
  });

  const totalRowAOAIndex = 4 + report.expenseItems.length;
  ws['!merges'].push({ s: { r: totalRowAOAIndex, c: 2 }, e: { r: totalRowAOAIndex, c: 4 } }); // Merge C:E for "GASTO TOTAL" label

  // --- Column Widths ---
  // (A) FECHA, (B) CANT, (C) DETALLE (merged D), (E) PREC. UNIT, (F) TOTAL, (G) VoB OPS
  ws['!cols'] = [
    { wch: 12 }, // A: FECHA
    { wch: 8 },  // B: CANT
    { wch: 35 }, // C: DETALLE DEL GASTO (dominant part of merge)
    { wch: 0.1 },// D: (merged, effectively hidden, or minimal width)
    { wch: 15 }, // E: PREC. UNIT Bs.
    { wch: 15 }, // F: TOTAL Bs.
    { wch: 10 }  // G: VoB OPS
  ];
  
  // Attempt to apply a basic border to the main data table area (headers to total)
  // This is a simplified approach; full border styling like openpyxl is complex.
  // The `s` property in cell objects is the primary way for `xlsx` community version.
  // Here, we'll just ensure our cell objects in ws_data have the style.
  // For a general border, one would typically iterate ws from a start to end cell.
  // However, aoa_to_sheet generates the `ws` object. We've added styles directly to cell objects in `ws_data`.

  XLSX.utils.book_append_sheet(wb, ws, "CajaChica");
  XLSX.writeFile(wb, fileName);
}

