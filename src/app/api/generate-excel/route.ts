
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { GeneratedReportInfo } from '@/lib/report-generator';

// Helper function to parse date strings like "dd/mm/yy" into Date objects
function parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.split('/').length !== 3) return null;
    const parts = dateStr.split('/');
    // Assuming format is dd/mm/yy
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[2], 10) + 2000; // Assuming 21st century
    const date = new Date(year, month, day);
    // Basic validation
    if (isNaN(date.getTime()) || date.getDate() !== day) {
        return null;
    }
    return date;
}

export async function POST(req: NextRequest) {
  try {
    const reportData = (await req.json()) as GeneratedReportInfo;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('CajaChica');

    // --- 1. Define Styles (replicating Python script) ---
    const titleFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 14, bold: true };
    const headerFont: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true };
    
    const leftAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle' };
    const centerAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
    const rightAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'right', vertical: 'middle' };
    
    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    
    // --- 2. Set Column Widths ---
    worksheet.getColumn('A').width = 12;
    worksheet.getColumn('B').width = 9.14;
    worksheet.getColumn('C').width = 9.14;
    worksheet.getColumn('D').width = 14.85;
    worksheet.getColumn('E').width = 9.14;
    worksheet.getColumn('F').width = 9.14;
    worksheet.getColumn('G').width = 9.14;


    // --- 3. Build Header (Rows 1-3) ---
    // Row 1
    const titleCell = worksheet.getCell('A1');
    titleCell.value = "CAJA CHICA GUIA";
    titleCell.font = titleFont;
    titleCell.alignment = leftAlignment;
    worksheet.mergeCells('A1:G1');

    // Row 2
    worksheet.getCell('A2').value = "FILE:";
    worksheet.getCell('A2').font = headerFont;
    worksheet.getCell('B2').value = reportData.fileNumber;
    worksheet.getCell('B2').alignment = centerAlignment;
    worksheet.mergeCells('B2:C2');

    worksheet.getCell('D2').value = "NOMBRE GUIA:";
    worksheet.getCell('D2').font = headerFont;
    worksheet.getCell('E2').value = reportData.guideName.toUpperCase();
    worksheet.getCell('E2').alignment = centerAlignment;
    worksheet.mergeCells('E2:F2');

    // Row 3
    worksheet.getCell('A3').value = "NOMBRE Y Nº DE PAX:";
    worksheet.getCell('A3').font = headerFont;
    worksheet.mergeCells('A3:C3');
    
    worksheet.getCell('D3').value = reportData.groupName;
    worksheet.getCell('D3').alignment = centerAlignment;
    worksheet.mergeCells('D3:E3');

    worksheet.getCell('F3').value = "Nº";
    worksheet.getCell('F3').font = headerFont;
    worksheet.getCell('G3').value = parseInt(reportData.paxCount, 10) || 0;
    worksheet.getCell('G3').font = headerFont;
    worksheet.getCell('G3').alignment = rightAlignment;

    // --- 4. Build Table Headers (Row 4) ---
    const tableHeaders = ["FECHA", "CANT", "DETALLE DEL GASTO", null, "P. UNIT", "TOTAL Bs.", "VoB OPS"];
    const headerRow = worksheet.getRow(4);
    headerRow.values = tableHeaders;
    worksheet.mergeCells('C4:D4');
    headerRow.eachCell((cell) => {
        cell.font = headerFont;
        cell.alignment = centerAlignment; // Python script used left, but center looks better for headers
    });


    // --- 5. Add Expense Items (starting from Row 5) ---
    let currentRowIndex = 5;
    reportData.expenseItems.forEach(item => {
        const row = worksheet.getRow(currentRowIndex);
        
        // Date
        const dateObj = parseDate(item.date);
        if (dateObj) {
            row.getCell(1).value = dateObj;
            row.getCell(1).numFmt = 'dd/mm/yy';
        } else {
            row.getCell(1).value = item.date; // fallback to string
        }
        row.getCell(1).alignment = centerAlignment;

        // Quantity
        const quantityStr = String(item.quantity || "1");
        if (quantityStr.startsWith('=')) {
            // ExcelJS needs the G3 part replaced by a cell reference
            const formula = quantityStr.replace(/=\$G\$3|\=G3/gi, '=G3');
            row.getCell(2).value = { formula: formula.substring(1) };
        } else {
            row.getCell(2).value = !isNaN(parseFloat(quantityStr)) ? parseFloat(quantityStr) : quantityStr;
        }
        row.getCell(2).alignment = centerAlignment;

        // Detail
        row.getCell(3).value = item.detail;
        row.getCell(3).alignment = leftAlignment;
        worksheet.mergeCells(`C${currentRowIndex}:D${currentRowIndex}`);

        // Unit Price
        row.getCell(5).value = item.unitPrice;
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(5).alignment = rightAlignment;

        // Total (as formula)
        row.getCell(6).value = { formula: `B${currentRowIndex}*E${currentRowIndex}` };
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(6).alignment = rightAlignment;

        // VoB Ops
        row.getCell(7).value = item.vobOps || "";
        row.getCell(7).alignment = centerAlignment;

        currentRowIndex++;
    });

    // --- 6. Add Total Row ---
    const totalRow = worksheet.getRow(currentRowIndex);
    const totalLabelCell = totalRow.getCell(3);
    totalLabelCell.value = "GASTO TOTAL";
    totalLabelCell.font = headerFont;
    totalLabelCell.alignment = centerAlignment;
    worksheet.mergeCells(`C${currentRowIndex}:E${currentRowIndex}`);

    const grandTotalCell = totalRow.getCell(6);
    if (reportData.expenseItems.length > 0) {
        grandTotalCell.value = { formula: `SUM(F5:F${currentRowIndex - 1})` };
    } else {
        grandTotalCell.value = 0;
    }
    grandTotalCell.font = headerFont;
    grandTotalCell.numFmt = '"Bs." #,##0.00';
    grandTotalCell.alignment = rightAlignment;

    
    // --- 7. Apply Borders to the entire used range ---
    const lastRow = currentRowIndex;
    for (let i = 1; i <= lastRow; i++) {
        const row = worksheet.getRow(i);
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = thinBorder;
        });
    }

    // --- 8. Generate Buffer and Return Response ---
    const buf = await workbook.xlsx.writeBuffer();
    
    // Construct a safe filename
    const safeGroupName = String(reportData.groupName).replace(/[/\\]/g, '_');
    const safeGuideName = String(reportData.guideName).replace(/[/\\]/g, '_');
    const safeFileNumber = String(reportData.fileNumber).replace(/[/\\]/g, '_');
    // Using a simple date for the filename as startDate can be tricky
    const simpleDate = new Date().toISOString().split('T')[0];
    const finalConstructedFileName = `G.O. ${reportData.startDate || simpleDate} - ${safeGroupName} - ${safeGuideName} - ${safeFileNumber}.xlsx`;
    
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${finalConstructedFileName}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error('Error generating Excel file:', error);
    return NextResponse.json(
        { error: "Failed to generate Excel file.", details: errorMessage },
        { status: 500 }
    );
  }
}

    