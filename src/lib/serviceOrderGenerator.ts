
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
    { key: 'vuelo', width: 12 },
    { key: 'guia', width: 22 },
    { key: 'bus', width: 12 },
    { key: 'chofer', width: 22 },
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
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
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
  const noteSectionStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11 },
    alignment: { vertical: 'top', wrapText: true },
  };

  // --- Title ---
  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'ORDEN DE SERVICIOS';
  titleCell.style = titleStyle;
  worksheet.getRow(1).height = 20;

  // --- Info Section (Rows 2-6) ---
  const infoData = [
    { label: 'GUIA:', value: data.guia },
    { label: 'FILE:', value: data.file },
    { label: 'REF:', value: data.ref },
    { label: 'N° PAX:', value: data.nPax },
    { label: 'HOTEL:', value: data.hotel }
  ];

  let currentRowNum = 2;
  infoData.forEach(info => {
    worksheet.getCell(`A${currentRowNum}`).value = info.label;
    worksheet.getCell(`A${currentRowNum}`).style = infoHeaderStyle;
    
    // Merge B & C for the value, and D to H for an empty spacer
    worksheet.mergeCells(`B${currentRowNum}:C${currentRowNum}`);
    worksheet.getCell(`B${currentRowNum}`).value = info.value;
    worksheet.mergeCells(`D${currentRowNum}:H${currentRowNum}`);

    currentRowNum++;
  });


  // --- Services Table (Starts at row 8) ---
  const headerRow = worksheet.getRow(8);
  headerRow.values = ['FECHA', 'HORA', 'SERVICIO', 'VUELO', 'GUIA', 'BUS', 'CHOFER', 'OBSERVACIONES'];
  headerRow.eachCell(cell => cell.style = tableHeaderStyle);
  
  if(data.services.length > 0) {
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

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.style = tableCellStyle;
            if (['A','B'].some(c => cell.address.startsWith(c))) {
                cell.alignment = {...(cell.alignment || {}), horizontal: 'center' };
            }
        });
        row.height = 25;
      });
  } else {
    // Add a blank row if no services to maintain structure
    worksheet.addRow([]);
  }

  // --- Observations and Note Section ---
  let finalRow = (worksheet.lastRow?.number || 8) + 2; // Add a space after the table

  const defaultObs = 'La caja chica cubre 1 botella de agua por día para cada pax, guía y chofer. NO INCLUYE TRANSFERS NI SERVICIOS EN EL LAGO.';
  worksheet.getCell(`A${finalRow}`).value = 'OBS:';
  worksheet.getCell(`A${finalRow}`).style = infoHeaderStyle;
  worksheet.mergeCells(`B${finalRow}:H${finalRow}`);
  worksheet.getCell(`B${finalRow}`).value = data.observations || defaultObs;
  worksheet.getCell(`B${finalRow}`).style = noteSectionStyle;
  worksheet.getRow(finalRow).height = 30;
  finalRow++; // Move to the next line directly

  const defaultNote = 'TODOS LOS GUIAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA';
  worksheet.getCell(`A${finalRow}`).value = 'NOTA:';
  worksheet.getCell(`A${finalRow}`).style = infoHeaderStyle;
  worksheet.mergeCells(`B${finalRow}:H${finalRow}`);
  worksheet.getCell(`B${finalRow}`).value = data.nota || defaultNote;
  worksheet.getCell(`B${finalRow}`).style = noteSectionStyle;
  worksheet.getRow(finalRow).height = 45;
  
  const lastContentRow = worksheet.lastRow?.number || finalRow;

  // --- Apply General Borders ---
  for(let i = 2; i <= lastContentRow; i++) {
    const row = worksheet.getRow(i);
    // Apply border to each cell from A to H
    for(let j = 1; j <= 8; j++) {
       const cell = row.getCell(j);
       const currentBorder = cell.border || {};
       // Apply border only if one doesn't exist from a merge
       cell.border = {
         top: currentBorder.top || { style: 'thin' },
         left: currentBorder.left || { style: 'thin' },
         bottom: currentBorder.bottom || { style: 'thin' },
         right: currentBorder.right || { style: 'thin' },
       };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
