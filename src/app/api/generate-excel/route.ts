
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

    // --- 1. Build the data array for the worksheet ---
    const ws_data: (string | number | Date | { f: string } | null)[][] = [];
    ws_data.push(["CAJA CHICA GUIA"]); // Row 1
    ws_data.push(["FILE:", fileNumber, null, "NOMBRE GUIA:", guideName.toUpperCase()]); // Row 2
    ws_data.push(["NOMBRE Y Nº DE PAX:", null, null, groupName, null, "Nº", Number(paxCount)]); // Row 3
    ws_data.push(["FECHA", "CANT", "DETALLE DEL GASTO", null, "P. UNIT", "TOTAL Bs.", "VoB OPS"]); // Row 4 (Table Header)

    // Add expense items to the data array
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
    
    const firstDataRow = 5; // 1-based index for Excel formula
    const lastDataRow = firstDataRow + expenseItems.length - 1;
    
    ws_data.push([]); // Blank row before total
    const totalRowIndex_0_based = 4 + expenseItems.length + 1;
    const totalFormula = `SUM(F${firstDataRow}:F${lastDataRow})`;
    ws_data.push([null, null, "GASTO TOTAL", null, null, { f: totalFormula }]);


    // --- 2. Create worksheet from data array ---
    const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellDates: true });
    
    // --- 3. Define Merges and Column Widths ---
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // CAJA CHICA GUIA
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }, // File Number
      { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }, // Guide Name
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, // NOMBRE Y Nº DE PAX text
      { s: { r: 2, c: 3 }, e: { r: 2, c: 4 } }, // Group Name
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } }, // DETALLE DEL GASTO header
      { s: { r: totalRowIndex_0_based, c: 2 }, e: { r: totalRowIndex_0_based, c: 4 } }, // GASTO TOTAL text
    ];
    
    expenseItems.forEach((_: any, index: number) => {
        const rowIndex = 4 + index;
        ws['!merges']?.push({ s: { r: rowIndex, c: 2 }, e: { r: rowIndex, c: 3 } });
    });

    ws['!cols'] = [
      { wch: 12 }, { wch: 9 }, { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 12 }, { wch: 9 }
    ];

    // --- 4. Define all Cell Styles ---
    const thinBorder = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    
    const titleStyle = { font: { name: 'Calibri', sz: 14, bold: true }, alignment: { horizontal: "left", vertical: "center" } };
    const headerLabelStyle = { font: { name: 'Calibri', sz: 11, bold: true } };
    const tableHeaderStyle = { font: { name: 'Calibri', sz: 11, bold: true }, border: thinBorder, alignment: { horizontal: "center", vertical: "center" } };
    
    const defaultCellStyleWithBorder = { font: { name: 'Calibri', sz: 11 }, border: thinBorder, alignment: { vertical: "center" }};
    const dateCellStyle = { ...defaultCellStyleWithBorder, numFmt: "dd/mm/yy", alignment: { ...defaultCellStyleWithBorder.alignment, horizontal: "center" } };
    const textCellStyle = { ...defaultCellStyleWithBorder, alignment: { ...defaultCellStyleWithBorder.alignment, horizontal: "left", wrapText: true }};
    const numberCellStyle = { ...defaultCellStyleWithBorder, alignment: { ...defaultCellStyleWithBorder.alignment, horizontal: "right" }};

    const totalLabelStyle = { font: { name: 'Calibri', sz: 11, bold: true }, border: thinBorder, alignment: { horizontal: "center", vertical: "center" } };
    const totalValueStyle = { font: { name: 'Calibri', sz: 11, bold: true }, border: thinBorder, alignment: { horizontal: "right", vertical: "center" }, numFmt: "#,##0" };


    // --- 5. Apply Styles Cell by Cell ---
    const getCell = (r: number, c: number): XLSX.CellObject => {
      const address = XLSX.utils.encode_cell({ r, c });
      if (!ws[address]) { ws[address] = { t: 'z' }; } // Create a stub cell if it doesn't exist
      return ws[address];
    };

    // Style Title and Header Info
    getCell(0, 0).s = titleStyle;
    getCell(1, 0).s = headerLabelStyle; // FILE:
    getCell(1, 3).s = headerLabelStyle; // NOMBRE GUIA:
    getCell(2, 0).s = headerLabelStyle; // NOMBRE Y No DE PAX:
    getCell(2, 5).s = headerLabelStyle; // No

    // Style Table Headers
    for (let C = 0; C < 7; ++C) {
      if (C === 3) continue; // Skip merged cell part
      getCell(3, C).s = tableHeaderStyle;
    }
     if (getCell(3,3)) { getCell(3,3).s = tableHeaderStyle; } // Style the second part of the merged header

    // Style Data Rows
    for (let R = 4; R < 4 + expenseItems.length; ++R) {
        getCell(R, 0).s = dateCellStyle;
        getCell(R, 1).s = numberCellStyle;
        getCell(R, 2).s = textCellStyle;
        getCell(R, 3).s = textCellStyle; // Apply style to second part of merge too
        getCell(R, 4).s = numberCellStyle;
        getCell(R, 5).s = { ...numberCellStyle, numFmt: "#,##0" }; // Total column with number format
        getCell(R, 6).s = defaultCellStyleWithBorder;
    }
    
    // Style Total Row
    getCell(totalRowIndex_0_based, 2).s = totalLabelStyle; // GASTO TOTAL
    getCell(totalRowIndex_0_based, 5).s = totalValueStyle; // Total value cell
    // Apply borders to the other cells in the total row
    getCell(totalRowIndex_0_based, 0).s = { border: thinBorder };
    getCell(totalRowIndex_0_based, 1).s = { border: thinBorder };
    getCell(totalRowIndex_0_based, 3).s = { border: thinBorder };
    getCell(totalRowIndex_0_based, 4).s = { border: thinBorder };
    getCell(totalRowIndex_0_based, 6).s = { border: thinBorder };


    // --- 6. Generate Buffer and Return Response ---
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CajaChica');
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
