
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { resolveQuantity } from '@/lib/report-generator';

// Define a type for our expense items for better type safety
interface ExpenseItem {
  date: string;
  quantity: string;
  detail: string;
  unitPrice: number;
  vobOps?: string;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Destructure data with defaults
    const {
      fileNumber = "N/A",
      guideName = "N/A",
      groupName = "N/A",
      paxCount = "0",
      expenseItems = [],
      startDate = ""
    } = data;
    
    const paxCountNumber = parseInt(paxCount, 10) || 0;

    // --- 1. Build the data for the worksheet as a robust array of arrays ---
    const ws_data: (string | number | Date | { f: string } | null)[][] = [];

    // Header rows
    ws_data.push(["CAJA CHICA GUIA"]);
    ws_data.push(["FILE:", fileNumber, null, "NOMBRE GUIA:", guideName.toUpperCase()]);
    ws_data.push(["NOMBRE Y Nº DE PAX:", null, null, groupName, null, "Nº", Number(paxCount)]);
    ws_data.push(["FECHA", "CANT", "DETALLE DEL GASTO", null, "P. UNIT", "TOTAL Bs.", "VoB OPS"]);

    // Expense items
    expenseItems.forEach((item: ExpenseItem) => {
      let dateValue: Date | string = "";
      if (item.date) {
        const parts = item.date.split('/');
        // Ensure we handle dd/mm/yy format correctly
        if (parts.length === 3) {
          dateValue = new Date(Number(`20${parts[2]}`), Number(parts[1]) - 1, Number(parts[0]));
        } else {
          dateValue = item.date; // Fallback if format is different
        }
      }
      
      const resolvedQty = resolveQuantity(item.quantity, paxCountNumber);
      const unitPrice = item.unitPrice || 0;
      const total = resolvedQty * unitPrice;

      ws_data.push([
        dateValue,
        resolvedQty,
        item.detail,
        null, // Placeholder for the merged "DETALLE DEL GASTO" cell
        unitPrice,
        total,
        item.vobOps || ""
      ]);
    });
    
    // Add an empty row for spacing before the total
    ws_data.push([]);
    
    // Add total row with formula
    const firstExpenseRow = 5; // Excel rows are 1-based, aoa is 0-based, so data starts at row index 4. 4+1=5.
    const lastExpenseRow = firstExpenseRow + expenseItems.length - 1;
    const totalFormula = `SUM(F${firstExpenseRow}:F${lastExpenseRow})`;
    const totalRowIndex = ws_data.length; // Get the index for the total row before pushing it
    ws_data.push([null, null, "GASTO TOTAL", null, null, { f: totalFormula }]);

    // --- 2. Create worksheet and workbook from our data structure ---
    const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CajaChica');
    
    // --- 3. Define Merges for the worksheet ---
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // "CAJA CHICA GUIA"
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }, // File Number
      { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }, // Guide Name
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, // "NOMBRE Y Nº DE PAX" text
      { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }, // Group Name
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } }, // "DETALLE DEL GASTO" header
      { s: { r: totalRowIndex, c: 2 }, e: { r: totalRowIndex, c: 4 } }, // "GASTO TOTAL" text
    ];
    
    // Merge cells for each expense item's detail
    expenseItems.forEach((_: any, index: number) => {
        const rowIndex = 4 + index; // Data starts at row index 4
        ws['!merges']?.push({ s: { r: rowIndex, c: 2 }, e: { r: rowIndex, c: 3 } });
    });

    // --- 4. Define Column Widths ---
    ws['!cols'] = [
      { wch: 12 }, { wch: 9 }, { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 9 }
    ];

    // --- 5. Apply Cell Styles ---
    const currencyFormat = '"Bs." #,##0.00';
    const headerFont = { name: 'Calibri', sz: 11, bold: true };
    const titleFont = { name: 'Calibri', sz: 14, bold: true };
    
    // Helper to get a cell reference
    const getCell = (r: number, c: number) => ws[XLSX.utils.encode_cell({ r, c })];

    // Style Title
    const titleCell = getCell(0, 0);
    if (titleCell) titleCell.s = { font: titleFont, alignment: { horizontal: "left", vertical: "center" } };

    // Style Headers
    [
        // Row 2 (File, Guide Name)
        [1, 0], [1, 3], 
        // Row 3 (Pax, Group)
        [2, 0], [2, 5],
        // Row 4 (Table Headers)
        [3,0], [3,1], [3,2], [3,4], [3,5], [3,6]
    ].forEach(([r, c]) => {
        const cell = getCell(r, c);
        if (cell) cell.s = { font: headerFont };
    });

    // Style data rows
    for (let R = 4; R < 4 + expenseItems.length; ++R) {
        const dateCell = getCell(R, 0);
        if (dateCell) dateCell.s = { numFmt: "dd/mm/yy", alignment: { horizontal: "center" } };

        const unitPriceCell = getCell(R, 4);
        if (unitPriceCell) unitPriceCell.s = { numFmt: currencyFormat, alignment: { horizontal: "right" } };

        const totalCell = getCell(R, 5);
        if (totalCell) totalCell.s = { numFmt: currencyFormat, alignment: { horizontal: "right" } };
    }

    // Style total row
    const grandTotalLabelCell = getCell(totalRowIndex, 2);
    if (grandTotalLabelCell) grandTotalLabelCell.s = { font: headerFont, alignment: { horizontal: "center" } };
    
    const grandTotalCell = getCell(totalRowIndex, 5);
    if (grandTotalCell) grandTotalCell.s = { font: headerFont, numFmt: currencyFormat, alignment: { horizontal: "right" } };


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
