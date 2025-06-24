
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { resolveQuantity } from '@/lib/report-generator';

interface ExpenseItem {
  date: string;
  quantity: string;
  detail: string;
  unitPrice: number;
  total: number;
  vobOps?: string;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const {
      fileNumber = "N/A",
      guideName = "N/A",
      groupName = "N/A",
      paxCount = "0",
      expenseItems = [],
      startDate = ""
    } = data;
    
    const paxCountNumber = parseInt(paxCount, 10) || 0;

    // --- 1. Define Cell Styles ---
    const thinBorder = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const titleStyle = { font: { name: 'Calibri', sz: 14, bold: true }, alignment: { horizontal: "left", vertical: "center" } };
    const headerLabelStyle = { font: { name: 'Calibri', sz: 11, bold: true } };
    const tableHeaderStyle = { font: { name: 'Calibri', sz: 11, bold: true }, border: thinBorder, alignment: { horizontal: "center" } };
    const currencyFormat = '"Bs." #,##0.00';
    const dateFormat = "dd/mm/yy";

    const defaultCellStyle = { font: { name: 'Calibri', sz: 11 }, border: thinBorder };
    const dateCellStyle = { ...defaultCellStyle, numFmt: dateFormat, alignment: { horizontal: "center" } };
    const numberCellStyle = { ...defaultCellStyle, alignment: { horizontal: "right" } };
    const currencyCellStyle = { ...numberCellStyle, numFmt: currencyFormat };
    const totalLabelStyle = { font: { name: 'Calibri', sz: 11, bold: true }, border: thinBorder, alignment: { horizontal: "center" } };
    const totalValueStyle = { font: { name: 'Calibri', sz: 11, bold: true }, numFmt: currencyFormat, border: thinBorder, alignment: { horizontal: "right" } };

    // --- 2. Build the data for the worksheet ---
    const ws_data: (string | number | Date | { f: string } | null)[][] = [];
    ws_data.push(["CAJA CHICA GUIA"]);
    ws_data.push(["FILE:", fileNumber, null, "NOMBRE GUIA:", guideName.toUpperCase()]);
    ws_data.push(["NOMBRE Y Nº DE PAX:", null, null, groupName, null, "Nº", Number(paxCount)]);
    ws_data.push(["FECHA", "CANT", "DETALLE DEL GASTO", null, "P. UNIT", "TOTAL Bs.", "VoB OPS"]);

    expenseItems.forEach((item: ExpenseItem) => {
      let dateValue: Date | string = "";
      if (item.date) {
        const parts = item.date.split('/');
        if (parts.length === 3) {
          dateValue = new Date(Number(`20${parts[2]}`), Number(parts[1]) - 1, Number(parts[0]));
        } else {
          dateValue = item.date;
        }
      }
      
      const resolvedQty = resolveQuantity(item.quantity, paxCountNumber);
      const unitPrice = item.unitPrice || 0;
      const total = resolvedQty * unitPrice;

      ws_data.push([
        dateValue,
        resolvedQty,
        item.detail,
        null, 
        unitPrice,
        total,
        item.vobOps || ""
      ]);
    });
    
    ws_data.push([]); // Empty row is pushed
    const firstExpenseRow = 5; // 1-based index for Excel formula
    const lastExpenseRow = firstExpenseRow + expenseItems.length - 1;
    const totalFormula = `SUM(F${firstExpenseRow}:F${lastExpenseRow})`;
    
    // The total row will be at index (0-indexed): 4 (headers) + expenseItems.length + 1 (empty row)
    const totalRowIndex = 4 + expenseItems.length + 1;
    ws_data.push([null, null, "GASTO TOTAL", null, null, { f: totalFormula }]);


    // --- 3. Create worksheet and workbook ---
    const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CajaChica');
    
    // --- 4. Define Merges and Column Widths ---
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // CAJA CHICA GUIA
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }, // File Number
      { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }, // Guide Name
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, // NOMBRE Y Nº DE PAX text
      { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }, // Group Name
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } }, // DETALLE DEL GASTO header
      { s: { r: totalRowIndex, c: 2 }, e: { r: totalRowIndex, c: 4 } }, // GASTO TOTAL text
    ];
    
    expenseItems.forEach((_: any, index: number) => {
        const rowIndex = 4 + index;
        ws['!merges']?.push({ s: { r: rowIndex, c: 2 }, e: { r: rowIndex, c: 3 } });
    });

    ws['!cols'] = [
      { wch: 12 }, { wch: 9 }, { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 9 }
    ];

    // --- 5. Apply Cell Styles (Robustly) ---
    const ensureCell = (r: number, c: number): XLSX.CellObject => {
      const address = XLSX.utils.encode_cell({ r, c });
      if (!ws[address]) {
        // Create a blank cell if it doesn't exist, so we can style it.
        ws[address] = { t: 's', v: '' };
      }
      return ws[address];
    };
    
    // Style Title
    ensureCell(0, 0).s = titleStyle;

    // Style Header Labels
    ensureCell(1, 0).s = headerLabelStyle;
    ensureCell(1, 3).s = headerLabelStyle;
    ensureCell(2, 0).s = headerLabelStyle;
    ensureCell(2, 5).s = headerLabelStyle;

    // Style Table Headers (Row 4, which is index 3)
    for (let C = 0; C <= 6; C++) {
        if (C === 3) continue; // Skip styling the second part of a merged cell
        ensureCell(3, C).s = tableHeaderStyle;
    }

    // Style data rows
    for (let R = 4; R < 4 + expenseItems.length; ++R) {
        ensureCell(R, 0).s = dateCellStyle;
        ensureCell(R, 1).s = numberCellStyle;
        ensureCell(R, 2).s = defaultCellStyle;
        ensureCell(R, 4).s = currencyCellStyle;
        ensureCell(R, 5).s = currencyCellStyle;
        ensureCell(R, 6).s = defaultCellStyle;
    }
    
    // Style total row
    ensureCell(totalRowIndex, 2).s = totalLabelStyle; // GASTO TOTAL
    ensureCell(totalRowIndex, 5).s = totalValueStyle; // Total value
    
    // Add borders to the blank cells in the total row for a clean look
    ensureCell(totalRowIndex, 0).s = { border: thinBorder };
    ensureCell(totalRowIndex, 1).s = { border: thinBorder };
    ensureCell(totalRowIndex, 3).s = { border: thinBorder };
    ensureCell(totalRowIndex, 4).s = { border: thinBorder };
    ensureCell(totalRowIndex, 6).s = { border: thinBorder };


    // --- 6. Generate Buffer and Return Response ---
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeGroupName = String(groupName).replace(/[/\\]/g, '_');
    const safeGuideName = String(guideName).replace(/[/\\]/g, '_');
    const safeFileNumber = String(fileNumber).replace(/[/\\]/g, '_');
    const finalConstructedFileName = `G.O. ${startDate} - ${safeGroupName} - ${safeGuideName} - ${safeFileNumber}.xlsx`;
    
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${finalConstructedFileName}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (error) {
    console.error('Error generating Excel file:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: "Failed to generate Excel file.", details: errorMessage }, { status: 500 });
  }
}
