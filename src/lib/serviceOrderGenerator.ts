
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

// Function to create the Service Order Excel file using ExcelJS
export async function generateServiceOrderExcel(data: ServiceOrderData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Orden de Servicios');

  // --- Column Widths ---
  worksheet.columns = [
    { key: 'fecha', width: 12 },
    { key: 'hora', width: 8 },
    { key: 'servicio', width: 35 },
    { key: 'vuelo', width: 10 },
    { key: 'guia', width: 20 },
    { key: 'bus', width: 10 },
    { key: 'chofer', width: 20 },
    { key: 'observaciones', width: 35 }
  ];

  // --- Styles ---
  const titleStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 16, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  const infoHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11, bold: true },
  };
  const tableHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11, bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    }
  };
  const tableCellStyle: Partial<ExcelJS.Style> = {
      font: { name: 'Calibri', size: 11 },
      alignment: { vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      }
  };


  // --- Title ---
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'ORDEN DE SERVICIOS';
  titleCell.style = titleStyle;
  worksheet.getRow(1).height = 20;

  // --- Info Section ---
  let currentRow = 3;
  worksheet.getCell(`A${currentRow}`).value = 'GUIA';
  worksheet.getCell(`A${currentRow}`).style = infoHeaderStyle;
  worksheet.getCell(`B${currentRow}`).value = data.guia;
  
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'FILE:';
  worksheet.getCell(`A${currentRow}`).style = infoHeaderStyle;
  worksheet.getCell(`B${currentRow}`).value = data.file;
  
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'REF:';
  worksheet.getCell(`A${currentRow}`).style = infoHeaderStyle;
  worksheet.getCell(`B${currentRow}`).value = data.ref;

  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'N° PAX:';
  worksheet.getCell(`A${currentRow}`).style = infoHeaderStyle;
  worksheet.getCell(`B${currentRow}`).value = data.nPax;
  
  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'HOTEL:';
  worksheet.getCell(`A${currentRow}`).style = infoHeaderStyle;
  worksheet.getCell(`B${currentRow}`).value = data.hotel;
  
  // --- Services Table ---
  currentRow += 2;
  const headerRow = worksheet.getRow(currentRow);
  headerRow.values = ['FECHA', 'HORA', 'SERVICIO', 'VUELO', 'GUIA', 'BUS', 'CHOFER', 'OBSERVACIONES'];
  headerRow.eachCell(cell => cell.style = tableHeaderStyle);
  currentRow++;

  data.services.forEach(service => {
    const row = worksheet.addRow({
      fecha: service.fecha || '',
      hora: service.hora || '',
      servicio: service.servicio || '',
      vuelo: service.vuelo || '',
      guia: service.guia || '',
      bus: service.bus || '',
      chofer: service.chofer ? service.chofer.replace(/^CONT\s/i, '') : '',
      observaciones: service.observaciones || ''
    });

    row.eachCell(cell => {
        cell.style = tableCellStyle;
        if(cell.address.includes('A') || cell.address.includes('B')){
            cell.alignment = {...(cell.alignment || {}), horizontal: 'center' };
        }
    });
    
    row.height = 25; // Set row height for wrapped text
    currentRow++;
  });

  // --- Observations and Note ---
  currentRow += 2;
  if (data.observations) {
    worksheet.getCell(`A${currentRow}`).value = 'OBSERVACIONES:';
    worksheet.getCell(`A${currentRow}`).style = infoHeaderStyle;
    worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = data.observations;
    worksheet.getCell(`B${currentRow}`).alignment = { wrapText: true, vertical: 'top' };
    currentRow += Math.max(1, Math.ceil((data.observations.length || 0) / 100)); // rough height calculation
  }
  
  currentRow++;
  if (data.nota) {
    worksheet.getCell(`A${currentRow}`).value = 'NOTA:';
    worksheet.getCell(`A${currentRow}`).style = infoHeaderStyle;
    worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = data.nota;
    worksheet.getCell(`B${currentRow}`).alignment = { wrapText: true, vertical: 'top' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
