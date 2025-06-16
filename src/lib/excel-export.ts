
// src/lib/excel-export.ts
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { GeneratedReportInfo, ExpenseItem } from '@/app/generator/page';

// Helper to apply styles, ensuring cell object exists
function ensureCell(ws: XLSX.WorkSheet, address: string): XLSX.CellObject {
  if (!ws[address]) {
    ws[address] = { t: 's', v: '' }; // Default to string type if creating
  }
  return ws[address];
}

function applyStyle(ws: XLSX.WorkSheet, address: string, style: Partial<XLSX.CellStyle>) {
  const cell = ensureCell(ws, address);
  cell.s = { ...(cell.s || {}), ...style };
}

function applyBold(ws: XLSX.WorkSheet, address: string) {
  const cell = ensureCell(ws, address);
  cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), bold: true } };
}

function applyFontSize(ws: XLSX.WorkSheet, address: string, sz: number) {
    const cell = ensureCell(ws, address);
    cell.s = { ...(cell.s || {}), font: { ...(cell.s?.font || {}), sz: sz } };
}

function applyAlignment(ws: XLSX.WorkSheet, address: string, alignment: XLSX.Alignment) {
    const cell = ensureCell(ws, address);
    cell.s = { ...(cell.s || {}), alignment: alignment };
}


export function downloadReportAsExcel(report: GeneratedReportInfo): void {
  let startDateForFileName = report.startDate;
  try {
    if (report.startDate && report.startDate.includes('/')) {
        const [d, m, y] = report.startDate.split('/');
        startDateForFileName = `${d}.${m}.${y.length === 2 ? '20' + y : y}`;
    } else { // Fallback if startDate is not in expected format or empty
        startDateForFileName = format(new Date(), 'dd.MM.yyyy');
    }
  } catch (e) {
    console.warn("Error formatting startDate for file name", e, "Original startDate:", report.startDate);
    startDateForFileName = format(new Date(), 'dd.MM.yyyy'); // Fallback
  }

  const fileName = `G.O. ${startDateForFileName} - ${report.groupName.replace(/[/\s()]/g, '_')} - ${report.guideName.toUpperCase().replace(/\s/g, '_')} - ${report.fileNumber}.xlsx`;

  const wb = XLSX.utils.book_new();
  const ws_data: any[][] = [];

  // --- Header Rows ---
  ws_data.push([{ v: "CAJA CHICA GUIA", s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center" } } }]); // Merged A1:G1

  ws_data.push([
    { v: "FILE:", s: { font: { bold: true } } },
    { v: report.fileNumber, s: { alignment: { horizontal: "center", vertical: "center" } } },
    null,
    { v: "NOMBRE GUIA:", s: { font: { bold: true } } },
    { v: report.guideName.toUpperCase() },
    null,
  ]);

  ws_data.push([
    { v: "NOMBRE Y Nº DE PAX:", s: { font: { bold: true } } },
    null, null,
    { v: report.groupName },
    null,
    { v: "Nº", s: { font: { bold: true } } },
    { v: report.paxCount, t: 'n', s: { font: { bold: true } } }, // Ensure Pax is treated as number if it is, or string
  ]);

  ws_data.push([
    { v: "FECHA", s: { font: { bold: true } } },
    { v: "CANT", s: { font: { bold: true } } },
    { v: "DETALLE DEL GASTO", s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } } },
    null,
    { v: "PREC. UNIT Bs.", s: { font: { bold: true } } },
    { v: "TOTAL Bs.", s: { font: { bold: true } } },
    { v: "VoB OPS", s: { font: { bold: true } } }
  ]);

  // --- Expense Item Rows ---
  report.expenseItems.forEach((item: ExpenseItem, index: number) => {
    const excelRowNumber = ws_data.length + 1; // 1-based for Excel formulas

    let quantityCell: any;
    if (item.quantity.toString().startsWith('=')) {
      quantityCell = { t: 'n', f: item.quantity.toString().substring(1).replace(/\$G\$3/gi, `G3`) };
    } else if (!isNaN(Number(item.quantity))) {
      quantityCell = { t: 'n', v: Number(item.quantity) };
    } else {
      quantityCell = { t: 's', v: item.quantity.toString() };
    }
    
    ws_data.push([
      item.detail === "AGUAS" ? "" : item.date,
      quantityCell,
      { v: item.detail, s: { alignment: { horizontal: "center", vertical: "center" } } },
      null,
      { v: item.unitPrice, t: 'n', z: '0.00' },
      { t: 'n', f: `B${excelRowNumber}*E${excelRowNumber}`, z: '0.00' },
      item.vobOps || ""
    ]);
  });

  // --- Footer Row (Grand Total) ---
  const firstExpenseDataRow = 5; // 1-based
  const lastExpenseDataRow = firstExpenseDataRow + report.expenseItems.length - 1;
  let sumFormula = "0";
  if (report.expenseItems.length > 0) {
    sumFormula = `SUM(F${firstExpenseDataRow}:F${lastExpenseDataRow})`;
  }

  ws_data.push([
    null, null,
    { v: "GASTO TOTAL", s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } } },
    null, null,
    { t: 'n', f: sumFormula, z: '0.00', s: { font: { bold: true } } },
  ]);

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // --- Merges ---
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }); // A1:G1 for "CAJA CHICA GUIA"
  ws['!merges'].push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }); // B2:C2 for File Number
  ws['!merges'].push({ s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }); // E2:F2 for Guide Name
  ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }); // A3:C3 for "NOMBRE Y Nº DE PAX:"
  ws['!merges'].push({ s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }); // D3:E3 for Group Name
  ws['!merges'].push({ s: { r: 3, c: 2 }, e: { r: 3, c: 3 } }); // C4:D4 for "DETALLE DEL GASTO" header

  report.expenseItems.forEach((_, index) => {
    const itemRowIndexInExcel = 4 + index; // 0-indexed for aoa_to_sheet data array
    ws['!merges']?.push({ s: { r: itemRowIndexInExcel, c: 2 }, e: { r: itemRowIndexInExcel, c: 3 } });
  });

  const totalRowDataIndex = 4 + report.expenseItems.length;
  ws['!merges'].push({ s: { r: totalRowDataIndex, c: 2 }, e: { r: totalRowDataIndex, c: 4 } }); // For "GASTO TOTAL"

  // --- Column Widths ---
  ws['!cols'] = [
    { wch: 10 }, // A: FECHA
    { wch: 8 },  // B: CANT
    { wch: 35 }, // C: DETALLE DEL GASTO (merged with D)
    { wch: 0.1 },// D: (merged, effectively hidden)
    { wch: 15 }, // E: PREC. UNIT Bs.
    { wch: 12 }, // F: TOTAL Bs.
    { wch: 10 }  // G: VoB OPS
  ];

  XLSX.utils.book_append_sheet(wb, ws, "CajaChica");
  XLSX.writeFile(wb, fileName);
}
