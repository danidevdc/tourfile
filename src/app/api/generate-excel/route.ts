
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('CajaChica');

    // --- 1. Define Column Widths ---
    worksheet.columns = [
      { key: 'A', width: 12 },
      { key: 'B', width: 9 },
      { key: 'C', width: 18 },
      { key: 'D', width: 18 }, // Merged with C for details
      { key: 'E', width: 12 },
      { key: 'F', width: 12 },
      { key: 'G', width: 9 }
    ];

    // --- 2. Define Styles ---
    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    
    // --- 3. Add Header Content and Styles ---
    // Row 1: Main Title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = "CAJA CHICA GUIA";
    titleCell.font = { name: 'Calibri', size: 14, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Row 2: File Number and Guide Name
    const row2 = worksheet.addRow(['FILE:', fileNumber, null, 'NOMBRE GUIA:', guideName.toUpperCase()]);
    worksheet.mergeCells('B2:C2');
    worksheet.mergeCells('E2:F2');
    row2.getCell('A').font = { name: 'Calibri', size: 11, bold: true };
    row2.getCell('D').font = { name: 'Calibri', size: 11, bold: true };
    
    // Row 3: Group Name and Pax Count
    const row3 = worksheet.addRow(['NOMBRE Y Nº DE PAX:', null, null, groupName, null, 'Nº', paxCountNumber]);
    worksheet.mergeCells('A3:C3');
    worksheet.mergeCells('D3:E3');
    row3.getCell('A').font = { name: 'Calibri', size: 11, bold: true };
    row3.getCell('F').font = { name: 'Calibri', size: 11, bold: true };
    
    // Row 4: Table Headers
    worksheet.addRow([]); // Blank row for spacing if needed
    const headerRow = worksheet.addRow(['FECHA', 'CANT', 'DETALLE DEL GASTO', null, 'P. UNIT', 'TOTAL Bs.', 'VoB OPS']);
    worksheet.mergeCells('C5:D5');
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // --- 4. Add Expense Items and Styles ---
    const firstDataRow = 6;
    expenseItems.forEach((item: ExpenseItem, index: number) => {
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

        const currentRowIndex = firstDataRow + index;
        const itemRow = worksheet.addRow([dateValue, resolvedQty, item.detail, null, unitPrice, total, item.vobOps || ""]);
        worksheet.mergeCells(`C${currentRowIndex}:D${currentRowIndex}`);
        
        // Apply styles to the new row
        itemRow.getCell('A').numFmt = 'dd/mm/yy';
        itemRow.getCell('A').alignment = { vertical: 'middle', horizontal: 'center' };
        itemRow.getCell('B').alignment = { vertical: 'middle', horizontal: 'right' };
        itemRow.getCell('C').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        itemRow.getCell('E').numFmt = '#,##0.00';
        itemRow.getCell('F').numFmt = '#,##0.00';

        itemRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = thinBorder;
            cell.font = { name: 'Calibri', size: 11 };
        });
    });

    // --- 5. Add Total Row and Styles ---
    worksheet.addRow([]); // Blank row
    const lastDataRow = firstDataRow + expenseItems.length - 1;
    const totalFormula = `SUM(F${firstDataRow}:F${lastDataRow})`;
    const totalRow = worksheet.addRow([null, null, 'GASTO TOTAL', null, null, { formula: totalFormula }]);
    
    const totalRowIndex = firstDataRow + expenseItems.length + 1;
    worksheet.mergeCells(`C${totalRowIndex}:E${totalRowIndex}`);
    
    const totalLabelCell = totalRow.getCell('C');
    totalLabelCell.font = { name: 'Calibri', size: 11, bold: true };
    totalLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    const totalValueCell = totalRow.getCell('F');
    totalValueCell.font = { name: 'Calibri', size: 11, bold: true };
    totalValueCell.numFmt = '"Bs." #,##0.00';

    totalRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = thinBorder;
    });

    // --- 6. Generate Buffer and Return Response ---
    const buf = await workbook.xlsx.writeBuffer();

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
