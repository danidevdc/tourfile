
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { GeneratedReportInfo, ExpenseItem } from '@/lib/report-generator';

// Helper function to parse date strings like "dd/mm/yy" into Date objects
function parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.split('/').length !== 3) return null;
    const parts = dateStr.split('/');
    // Assuming format is dd/mm/yy
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const yearPart = parseInt(parts[2], 10);
    // Handle 2-digit years: assume 20xx
    const year = yearPart < 100 ? yearPart + 2000 : yearPart; 
    const date = new Date(Date.UTC(year, month, day));
    // Basic validation
    if (isNaN(date.getTime()) || date.getUTCDate() !== day || date.getUTCMonth() !== month) {
        console.warn(`Invalid date parsed for string: ${dateStr}`);
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
    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
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
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = "CAJA CHICA GUIA";
    titleCell.font = { name: 'Calibri', size: 14, bold: true };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    
    // Row 2
    worksheet.getCell('A2').value = "FILE:";
    worksheet.getCell('A2').font = { name: 'Calibri', size: 11, bold: true };
    worksheet.mergeCells('B2:C2');
    worksheet.getCell('B2').value = reportData.fileNumber;
    worksheet.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('D2').value = "NOMBRE GUIA:";
    worksheet.getCell('D2').font = { name: 'Calibri', size: 11, bold: true };
    worksheet.mergeCells('E2:F2');
    worksheet.getCell('E2').value = reportData.guideName.toUpperCase();
    worksheet.getCell('E2').alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3
    worksheet.mergeCells('A3:C3');
    worksheet.getCell('A3').value = "NOMBRE Y Nº DE PAX:";
    worksheet.getCell('A3').font = { name: 'Calibri', size: 11, bold: true };
    
    worksheet.mergeCells('D3:E3');
    worksheet.getCell('D3').value = reportData.groupName;
    worksheet.getCell('D3').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('F3').value = "Nº";
    worksheet.getCell('F3').font = { name: 'Calibri', size: 11, bold: true };
    worksheet.getCell('G3').value = parseInt(reportData.paxCount, 10) || 0;
    worksheet.getCell('G3').font = { name: 'Calibri', size: 11, bold: true };
    worksheet.getCell('G3').alignment = { horizontal: 'right', vertical: 'middle' };
    
    // --- 4. Build Table Headers (Row 4) ---
    const tableHeaders = ["FECHA", "CANT", "DETALLE DEL GASTO", null, "P. UNIT", "TOTAL Bs.", "VoB OPS"];
    const headerRow = worksheet.getRow(4);
    headerRow.values = tableHeaders;
    worksheet.mergeCells('C4:D4');
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber <= 7) { // Only apply to used columns
          cell.font = { name: 'Calibri', size: 11, bold: true };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
    });

    // --- 5. Add Expense Items (starting from Row 5) ---
    let currentRowIndex = 5;
    reportData.expenseItems.forEach(item => {
        const row = worksheet.getRow(currentRowIndex);
        
        // Date
        const dateCell = row.getCell(1);
        if (item.date) {
            const dateObj = parseDate(item.date);
            if (dateObj) {
                dateCell.value = dateObj;
                dateCell.numFmt = 'dd/mm/yy';
            } else {
                dateCell.value = item.date; // fallback to string if parsing fails
            }
        } else {
            dateCell.value = "";
        }
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Quantity
        const quantityCell = row.getCell(2);
        const quantityStr = String(item.quantity || "1");
        if (quantityStr.startsWith('=')) {
            quantityCell.value = { formula: quantityStr.substring(1) };
        } else {
            const num = parseFloat(quantityStr);
            quantityCell.value = isNaN(num) ? quantityStr : num;
        }
        quantityCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Detail
        const detailCell = row.getCell(3);
        detailCell.value = item.detail; // <--- THIS LINE WAS MISSING. IT IS NOW RESTORED.
        detailCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.mergeCells(`C${currentRowIndex}:D${currentRowIndex}`);
        
        // Unit Price
        const unitPriceCell = row.getCell(5);
        const unitPriceVal = typeof item.unitPrice === 'string' ? parseFloat(item.unitPrice) : item.unitPrice;
        unitPriceCell.value = isNaN(unitPriceVal) ? 0 : unitPriceVal;
        unitPriceCell.numFmt = '#,##0.00';
        unitPriceCell.alignment = { horizontal: 'right', vertical: 'middle' };

        // Total (as formula)
        const totalCell = row.getCell(6);
        totalCell.value = { formula: `B${currentRowIndex}*E${currentRowIndex}` };
        totalCell.numFmt = '#,##0.00';
        totalCell.alignment = { horizontal: 'right', vertical: 'middle' };

        // VoB Ops
        const vobOpsCell = row.getCell(7);
        vobOpsCell.value = item.vobOps || "";
        vobOpsCell.alignment = { horizontal: 'center', vertical: 'middle' };

        currentRowIndex++;
    });
    
    // --- 6. Add Total Row ---
    const totalRow = worksheet.getRow(currentRowIndex);
    worksheet.mergeCells(`C${currentRowIndex}:E${currentRowIndex}`);
    const totalLabelCell = totalRow.getCell(3);
    totalLabelCell.value = "GASTO TOTAL";
    totalLabelCell.font = { name: 'Calibri', size: 11, bold: true };
    totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const grandTotalCell = totalRow.getCell(6);
    if (reportData.expenseItems.length > 0) {
        grandTotalCell.value = { formula: `SUM(F5:F${currentRowIndex - 1})` };
    } else {
        grandTotalCell.value = 0;
    }
    grandTotalCell.font = { name: 'Calibri', size: 11, bold: true };
    grandTotalCell.numFmt = '#,##0.00';
    grandTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // --- 7. Apply Borders to the entire used range ---
    const maxDataRow = currentRowIndex;
    for (let rowIdx = 1; rowIdx <= maxDataRow; rowIdx++) {
        const row = worksheet.getRow(rowIdx);
        // Ensure all 7 columns get borders, even if there's no data in them
        for (let colIdx = 1; colIdx <= 7; colIdx++) {
            const cell = row.getCell(colIdx);
            cell.border = thinBorder;
        }
    }

    // --- 8. Generate Buffer and Return Response ---
    const buf = await workbook.xlsx.writeBuffer();
    
    const safeGroupName = String(reportData.groupName).replace(/[/\\]/g, '_');
    const safeGuideName = String(reportData.guideName).replace(/[/\\]/g, '_');
    const safeFileNumber = String(reportData.fileNumber).replace(/[/\\]/g, '_');
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
