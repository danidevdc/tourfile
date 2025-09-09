
import ExcelJS from 'exceljs';

export interface ServiceOrderData {
  guia: string;
  file: string;
  ref: string;
  nPax: string;
  hotel: string;
  services: ServiceItem[];
  observations?: string;
  nota?: string;
}

export interface ServiceItem {
  fecha: string;
  hora: string;
  servicio: string;
  vuelo?: string;
  guia?: string;
  bus?: string; 
  chofer?: string;
  observaciones?: string;
}

export async function generateServiceOrderExcel(data: ServiceOrderData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Orden de Servicios');

  // Leave column A empty by setting its width and starting content from B
  worksheet.getColumn('A').width = 2;
  worksheet.columns = [
    { key: 'A', width: 2},
    { key: 'fecha', width: 12 }, { key: 'hora', width: 8 },
    { key: 'servicio', width: 40 }, { key: 'vuelo', width: 12 },
    { key: 'guia', width: 22 }, { key: 'bus', width: 10 },
    { key: 'chofer', width: 22 }, { key: 'observaciones', width: 35 }
  ];

  // --- STYLES ---
  const thinBorder: Partial<ExcelJS.Border> = { style: 'thin' };
  const fullThinBorder: Partial<ExcelJS.Borders> = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

  const titleStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 16, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' } };
  
  const infoHeaderStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11, bold: true }, border: fullThinBorder };
  const infoValueStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11 }, border: fullThinBorder, alignment: { vertical: 'middle' } };
  
  const tableHeaderStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: fullThinBorder };
  
  const verticalDottedBorder: Partial<ExcelJS.Borders> = {
      left: { style: 'dotted' },
      right: { style: 'dotted' }
  };
  const tableCellStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11 }, alignment: { vertical: 'middle', wrapText: true }, border: verticalDottedBorder };
  
  const noteHeaderStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11, bold: true }, alignment: { vertical: 'top' }};
  const noteTextStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 10 }, alignment: { vertical: 'top', wrapText: true }, border: fullThinBorder };
  

  // --- HEADER ---
  worksheet.mergeCells('B1:I1');
  const titleCell = worksheet.getCell('B1');
  titleCell.value = 'ORDEN DE SERVICIOS';
  titleCell.style = titleStyle;
  worksheet.getRow(1).height = 20;

  const infoData = [
    { label: 'GUIA:', value: data.guia }, { label: 'FILE:', value: data.file },
    { label: 'REF:', value: data.ref }, { label: 'N° PAX:', value: data.nPax },
    { label: 'HOTEL:', value: data.hotel }
  ];

  let currentRowNum = 3; // Start info section from row 3
  infoData.forEach(info => {
    worksheet.getCell(`B${currentRowNum}`).value = info.label;
    worksheet.getCell(`B${currentRowNum}`).style = infoHeaderStyle;
    
    worksheet.mergeCells(`C${currentRowNum}:D${currentRowNum}`);
    worksheet.getCell(`C${currentRowNum}`).value = info.value;
    worksheet.getCell(`C${currentRowNum}`).style = infoValueStyle;
    
    // To make it look clean, we merge the rest of the row and apply border
    worksheet.mergeCells(`E${currentRowNum}:I${currentRowNum}`);
    worksheet.getCell(`E${currentRowNum}`).style = infoValueStyle;

    currentRowNum++;
  });
  
  // --- TABLE HEADER ---
  const TABLE_START_ROW = currentRowNum + 1; // Add a space after info
  const tableHeaderRow = worksheet.getRow(TABLE_START_ROW);
  tableHeaderRow.values = [null, 'FECHA', 'HORA', 'SERVICIO', 'VUELO', 'GUIA', 'BUS', 'CHOFER', 'OBSERVACIONES'];
  tableHeaderRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if(cell.value && colNumber > 1) cell.style = tableHeaderStyle;
  });
  
  // --- TABLE BODY ---
  if(data.services.length > 0) {
      data.services.forEach(service => {
        const guiaCompleto = service.guia || data.guia || '';
        const guiaFirstName = guiaCompleto.split(' ')[0];
        
        const row = worksheet.addRow([
          null,
          service.fecha || '', service.hora || '',
          service.servicio || '', service.vuelo || '',
          guiaFirstName, // Only first name
          service.bus || '', 
          service.chofer ? service.chofer.replace(/^CONT\s/i, '') : '',
          service.observaciones || ''
        ]);
        
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (colNumber > 1) { // Apply style from column B onwards
                cell.style = tableCellStyle;
                if (['B','C'].some(c => cell.address.startsWith(c))) {
                    cell.alignment = {...(cell.alignment || {}), horizontal: 'center' };
                }
            }
        });
        row.height = 25;
      });

      // Add a thin bottom border to the last row of the table
      const lastRow = worksheet.lastRow;
      if(lastRow) {
          lastRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              if (colNumber > 1) {
                  cell.border = {
                      ...cell.border,
                      bottom: { style: 'thin' }
                  }
              }
          });
      }
  }

  // --- FOOTER NOTES ---
  let finalRow = (worksheet.lastRow?.number || TABLE_START_ROW) + 2;

  // OBSERVACIONES
  worksheet.getCell(`B${finalRow}`).value = 'OBSERVACIONES:';
  worksheet.getCell(`B${finalRow}`).style = noteHeaderStyle;
  finalRow++; // Content starts on the next row
  const obsCell = worksheet.getCell(`B${finalRow}`);
  worksheet.mergeCells(`B${finalRow}:I${finalRow + 1}`); // Merge for 2 rows height
  obsCell.value = data.observations || '';
  obsCell.style = noteTextStyle;

  finalRow += 3; // Space + 2 rows for obs

  // NOTA
  worksheet.getCell(`B${finalRow}`).value = 'NOTA:';
  worksheet.getCell(`B${finalRow}`).style = noteHeaderStyle;
  finalRow++; // Content starts on the next row
  const notaCell = worksheet.getCell(`B${finalRow}`);
  worksheet.mergeCells(`B${finalRow}:I${finalRow + 2}`); // Merge for 3 rows height
  notaCell.value = data.nota || '';
  notaCell.style = noteTextStyle;
  
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
