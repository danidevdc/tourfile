
// src/lib/excel-export.ts
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { GeneratedReportInfo, ExpenseItem } from '@/app/generator/page';

export function downloadReportAsExcel(report: GeneratedReportInfo): void {
  let startDateForFileName = report.startDate;
  try {
    if (report.startDate && report.startDate.includes('/')) {
        const [d, m, yyyyOrYy] = report.startDate.split('/');
        const year = yyyyOrYy.length === 2 ? `20${yyyyOrYy}` : yyyyOrYy;
        startDateForFileName = `${d}.${m}.${year}`;
    } else if (report.startDate) {
        const parsed = new Date(report.startDate.replace(/(\d{2})\.(\d{2})\.(\d{4})/, '$2/$1/$3'));
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

  let sanitizedGroupName = report.groupName;
  const charsToReplace = ['/', ':', '\\*', '\\?', '\\[', '\\]', '\\s', '\\(', '\\)'];
  charsToReplace.forEach(char => {
      const regex = new RegExp(char, 'g');
      sanitizedGroupName = sanitizedGroupName.replace(regex, '_');
  });
  sanitizedGroupName = sanitizedGroupName.replace(/__+/g, '_');


  const fileName = `G.O. ${startDateForFileName} - ${sanitizedGroupName} - ${report.guideName.toUpperCase().replace(/\s/g, '_')} - ${report.fileNumber}.xlsx`;

  const wb = XLSX.utils.book_new();
  const ws_data: any[][] = [];

  // Row 1: CAJA CHICA GUIA
  ws_data.push([
    { v: "CAJA CHICA GUIA", t: 's', s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } } },
    null, null, null, null, null, null
  ]);

  // Row 2: FILE: [fileNumber] NOMBRE GUIA: [guideName]
  ws_data.push([
    { v: "FILE:", t: 's', s: { font: { bold: true } } },
    { v: report.fileNumber, t: 's', s: { alignment: { horizontal: "center", vertical: "center" } } },
    null,
    { v: "NOMBRE GUIA:", t: 's', s: { font: { bold: true } } },
    { v: report.guideName.toUpperCase(), t: 's', s: { alignment: { horizontal: "center", vertical: "center" } } },
    null,
  ]);

  // Row 3: NOMBRE Y Nº DE PAX: [groupName] Nº [paxCount]
  ws_data.push([
    { v: "NOMBRE Y Nº DE PAX:", t: 's', s: { font: { bold: true } } },
    null, null,
    { v: report.groupName, t: 's', s: { alignment: { horizontal: "center", vertical: "center" } } },
    null,
    { v: "Nº", t: 's', s: { font: { bold: true } } },
    { v: parseInt(report.paxCount, 10) || 0, t: 'n', s: { font: { bold: true } } },
  ]);

  // Row 4: Table Headers
  ws_data.push([
    { v: "FECHA", t: 's', s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "CANT", t: 's', s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "DETALLE DEL GASTO", t: 's', s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } } },
    null,
    { v: "PREC. UNIT Bs.", t: 's', s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "TOTAL Bs.", t: 's', s: { font: { bold: true }, alignment: { horizontal: "center" } } },
    { v: "VoB OPS", t: 's', s: { font: { bold: true }, alignment: { horizontal: "center" } } }
  ]);

  report.expenseItems.forEach((item: ExpenseItem, index: number) => {
    const excelRowNumber = ws_data.length + 1;

    let quantityCellDef: any;
    const quantityStr = item.quantity.toString();
    if (quantityStr.startsWith('=')) {
      quantityCellDef = { t: 'n', f: quantityStr.substring(1).replace(/\$G\$3/gi, `G3`) };
    } else if (!isNaN(Number(quantityStr))) {
      quantityCellDef = { t: 'n', v: Number(quantityStr) };
    } else {
      quantityCellDef = { t: 's', v: quantityStr };
    }
    
    ws_data.push([
      { v: item.detail.toUpperCase() === "AGUAS" ? "" : item.date, t: 's', s: {alignment: {horizontal: "center"}} },
      { ...quantityCellDef, s: {...(quantityCellDef.s || {}), alignment: {horizontal: "center"}} },
      { v: item.detail, t: 's', s: { alignment: { horizontal: "center", vertical: "center" } } },
      null,
      { v: item.unitPrice, t: 'n', z: '#,##0.00', s: {alignment: {horizontal: "right"}} },
      { t: 'n', f: `B${excelRowNumber}*E${excelRowNumber}`, z: '#,##0.00', s: {alignment: {horizontal: "right"}} },
      { v: item.vobOps || "", t: 's', s: {alignment: {horizontal: "center"}} }
    ]);
  });

  const firstExpenseDataRow = 5;
  const lastExpenseDataRow = firstExpenseDataRow + report.expenseItems.length - 1;
  let sumFormula = "0";
  if (report.expenseItems.length > 0) {
    sumFormula = `SUM(F${firstExpenseDataRow}:F${lastExpenseDataRow})`;
  }

  ws_data.push([
    null, null,
    { v: "GASTO TOTAL", t: 's', s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } } },
    null, null,
    { t: 'n', f: sumFormula, z: '#,##0.00', s: { font: { bold: true }, alignment: {horizontal: "right"} } },
  ]);

  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }); // A1:G1
  
  ws['!merges'].push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }); // B2:C2
  ws['!merges'].push({ s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }); // E2:F2

  ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }); // A3:C3
  ws['!merges'].push({ s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }); // D3:E3
  
  ws['!merges'].push({ s: { r: 3, c: 2 }, e: { r: 3, c: 3 } }); // C4:D4

  report.expenseItems.forEach((_, index) => {
    const itemRowIndexInAOA = 4 + index;
    ws['!merges']?.push({ s: { r: itemRowIndexInAOA, c: 2 }, e: { r: itemRowIndexInAOA, c: 3 } });
  });

  const totalRowAOAIndex = 4 + report.expenseItems.length;
  ws['!merges'].push({ s: { r: totalRowAOAIndex, c: 2 }, e: { r: totalRowAOAIndex, c: 4 } });

  ws['!cols'] = [
    { wch: 12 }, // A: FECHA
    { wch: 8 },  // B: CANT
    { wch: 35 }, // C: DETALLE DEL GASTO
    { wch: 0.1 },// D: (merged)
    { wch: 15 }, // E: PREC. UNIT Bs.
    { wch: 15 }, // F: TOTAL Bs.
    { wch: 10 }  // G: VoB OPS
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, "CajaChica");
  XLSX.writeFile(wb, fileName);
}
