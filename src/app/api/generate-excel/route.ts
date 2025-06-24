import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Define types for cell styles for clarity
type CellStyle = {
  font?: XLSX.ExcelCell['s']['font'];
  alignment?: XLSX.ExcelCell['s']['alignment'];
  border?: XLSX.ExcelCell['s']['border'];
  numFmt?: XLSX.ExcelCell['s']['numFmt'];
};

// Helper function to apply styles to a cell
const styleCell = (cell: XLSX.CellObject, styles: CellStyle) => {
  cell.s = { ...cell.s, ...styles };
};

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const {
      fileNumber = "N/A",
      guideName = "N/A",
      groupName = "N/A",
      paxCount = 0,
      expenseItems = [],
    } = data;

    // --- 1. Create Workbook and Worksheet ---
    const wb = XLSX.utils.book_new();
    const ws_data: any[][] = [];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [
      { wch: 12 }, { wch: 9.14 }, { wch: 9.14 }, { wch: 14.85 },
      { wch: 9.14 }, { wch: 9.14 }, { wch: 9.14 }
    ];
    ws['!merges'] = [];

    // --- 2. Define Styles ---
    const headerFont: CellStyle['font'] = { name: 'Calibri', sz: 11, bold: true };
    const titleFont: CellStyle['font'] = { name: 'Calibri', sz: 14, bold: true };
    const leftAlign: CellStyle['alignment'] = { horizontal: "left", vertical: "center" };
    const centerAlign: CellStyle['alignment'] = { horizontal: "center", vertical: "center" };
    const rightAlign: CellStyle['alignment'] = { horizontal: "right", vertical: "center" };
    const currencyFormat: CellStyle['numFmt'] = '#,##0.00';
    const dateFormat: CellStyle['numFmt'] = 'dd/mm/yy';
    
    // --- 3. Build Header Rows ---
    // Row 1
    ws['A1'] = { v: "CAJA CHICA GUIA", t: 's', s: { font: titleFont, alignment: leftAlign } };
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });

    // Row 2
    ws['A2'] = { v: "FILE:", t: 's', s: { font: headerFont } };
    ws['B2'] = { v: fileNumber, t: 's', s: { alignment: centerAlign } };
    ws['!merges'].push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } });

    ws['D2'] = { v: "NOMBRE GUIA:", t: 's', s: { font: headerFont } };
    ws['E2'] = { v: guideName.toUpperCase(), t: 's', s: { alignment: centerAlign } };
    ws['!merges'].push({ s: { r: 1, c: 4 }, e: { r: 1, c: 5 } });

    // Row 3
    ws['A3'] = { v: "NOMBRE Y Nº DE PAX:", t: 's', s: { font: headerFont } };
    ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 2 } });
    ws['D3'] = { v: groupName, t: 's', s: { alignment: centerAlign } };
    ws['!merges'].push({ s: { r: 2, c: 3 }, e: { r: 2, c: 4 } });
    ws['F3'] = { v: "Nº", t: 's', s: { font: headerFont } };
    ws['G3'] = { v: Number(paxCount), t: 'n', s: { font: headerFont, alignment: rightAlign } };

    // Row 4: Table Headers
    const headers = ["FECHA", "CANT", "DETALLE DEL GASTO", "", "P. UNIT", "TOTAL Bs.", "VoB OPS"];
    headers.forEach((h, i) => {
      ws[XLSX.utils.encode_cell({ r: 3, c: i })] = { v: h, t: 's', s: { font: headerFont, alignment: leftAlign } };
    });
    ws['!merges'].push({ s: { r: 3, c: 2 }, e: { r: 3, c: 3 } });

    // --- 4. Populate Expense Items ---
    let currentRow = 4; // Start from row 5 (0-indexed)
    expenseItems.forEach((item: any) => {
      // Date
      if (item.date) {
         // Attempt to parse dd/mm/yy string into a Date object for Excel
        const parts = item.date.split('/');
        const dateObj = new Date(Number(`20${parts[2]}`), Number(parts[1]) - 1, Number(parts[0]));
        ws[`A${currentRow + 1}`] = { v: dateObj, t: 'd', s: { numFmt: dateFormat, alignment: centerAlign } };
      } else {
        ws[`A${currentRow + 1}`] = { v: "", t: 's', s: { alignment: centerAlign } };
      }
      
      // Quantity
      if (String(item.quantity).startsWith("=")) {
        ws[`B${currentRow + 1}`] = { f: item.quantity.substring(1), t: 'n', s: { alignment: centerAlign } };
      } else {
        ws[`B${currentRow + 1}`] = { v: Number(item.quantity), t: 'n', s: { alignment: centerAlign } };
      }
      
      // Detail
      ws[`C${currentRow + 1}`] = { v: item.detail, t: 's', s: { alignment: centerAlign } };
      ws['!merges'].push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 3 } });
      
      // Unit Price
      ws[`E${currentRow + 1}`] = { v: Number(item.unitPrice), t: 'n', s: { numFmt: currencyFormat, alignment: rightAlign } };
      
      // Total (Formula)
      ws[`F${currentRow + 1}`] = { f: `B${currentRow + 1}*E${currentRow + 1}`, t: 'n', s: { numFmt: currencyFormat, alignment: rightAlign } };
      
      // VoB Ops
      ws[`G${currentRow + 1}`] = { v: item.vobOps || "", t: 's', s: { alignment: centerAlign } };

      currentRow++;
    });

    // --- 5. Add Grand Total Row ---
    const totalRow = currentRow + 1;
    ws[`C${totalRow}`] = { v: "GASTO TOTAL", t: 's', s: { font: headerFont, alignment: centerAlign } };
    ws['!merges'].push({ s: { r: currentRow, c: 2 }, e: { r: currentRow, c: 4 } });
    ws[`F${totalRow}`] = { f: `SUM(F5:F${currentRow})`, t: 'n', s: { font: headerFont, numFmt: currencyFormat, alignment: rightAlign } };

    // --- 6. Apply Borders ---
    const thinBorder = { style: "thin", color: { auto: 1 } };
    const borderStyle: CellStyle['border'] = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
    };
    const range = XLSX.utils.decode_range(ws['!ref'] || `A1:G${totalRow}`);
    for (let R = 0; R <= totalRow; ++R) {
        for (let C = 0; C <= 6; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!ws[cell_ref]) continue;
            styleCell(ws[cell_ref], { border: borderStyle });
        }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'CajaChica');
    
    // --- 7. Generate Buffer and Return Response ---
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeGroupName = String(groupName).replace(/[\/\\]/g, '_');
    const safeGuideName = String(guideName).replace(/[\/\\]/g, '_');
    const safeFileNumber = String(fileNumber).replace(/[\/\\]/g, '_');
    const startDate = data.startDate || '';
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
