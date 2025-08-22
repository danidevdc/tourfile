
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

  worksheet.columns = [
    { key: 'fecha', width: 12 }, { key: 'hora', width: 8 },
    { key: 'servicio', width: 40 }, { key: 'vuelo', width: 12 },
    { key: 'guia', width: 22 }, { key: 'bus', width: 10 },
    { key: 'chofer', width: 22 }, { key: 'observaciones', width: 35 }
  ];

  const titleStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 16, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' } };
  const infoHeaderStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11, bold: true } };
  const tableHeaderStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
  const tableCellStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11 }, alignment: { vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } };
  const noteSectionStyle: Partial<ExcelJS.Style> = { font: { name: 'Calibri', size: 11 }, alignment: { vertical: 'top', wrapText: true } };

  worksheet.mergeCells('A1:H1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'ORDEN DE SERVICIOS';
  titleCell.style = titleStyle;
  worksheet.getRow(1).height = 20;

  const infoData = [
    { label: 'GUIA:', value: data.guia }, { label: 'FILE:', value: data.file },
    { label: 'REF:', value: data.ref }, { label: 'N° PAX:', value: data.nPax },
    { label: 'HOTEL:', value: data.hotel }
  ];

  let currentRowNum = 2;
  infoData.forEach(info => {
    worksheet.getCell(`A${currentRowNum}`).value = info.label;
    worksheet.getCell(`A${currentRowNum}`).style = infoHeaderStyle;
    worksheet.mergeCells(`B${currentRowNum}:C${currentRowNum}`);
    worksheet.getCell(`B${currentRowNum}`).value = info.value;
    worksheet.mergeCells(`D${currentRowNum}:H${currentRowNum}`);
    currentRowNum++;
  });
  
  const headerRow = worksheet.getRow(7);
  headerRow.values = ['FECHA', 'HORA', 'SERVICIO', 'VUELO', 'GUIA', 'BUS', 'CHOFER', 'OBSERVACIONES'];
  headerRow.eachCell(cell => cell.style = tableHeaderStyle);
  
  if(data.services.length > 0) {
      data.services.forEach(service => {
        const row = worksheet.addRow({
          fecha: service.fecha || '', hora: service.hora || '',
          servicio: service.servicio || '', vuelo: service.vuelo || '',
          guia: service.guia || '', bus: service.bus || '',
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
  }

  let finalRow = (worksheet.lastRow?.number || 7) + 2; // Add space after table
  worksheet.getCell(`A${finalRow}`).value = 'OBS:';
  worksheet.getCell(`A${finalRow}`).style = infoHeaderStyle;
  worksheet.mergeCells(`B${finalRow}:H${finalRow}`);
  worksheet.getCell(`B${finalRow}`).value = data.observations || '';
  worksheet.getCell(`B${finalRow}`).style = noteSectionStyle;
  worksheet.getRow(finalRow).height = 30;
  finalRow++;
  finalRow++; // Add more space

  worksheet.getCell(`A${finalRow}`).value = 'NOTA:';
  worksheet.getCell(`A${finalRow}`).style = infoHeaderStyle;
  worksheet.mergeCells(`B${finalRow}:H${finalRow}`);
  worksheet.getCell(`B${finalRow}`).value = data.nota || '';
  worksheet.getCell(`B${finalRow}`).style = noteSectionStyle;
  worksheet.getRow(finalRow).height = 45;
  
  const lastContentRow = worksheet.lastRow?.number || finalRow;
  for(let i = 2; i <= 6; i++) { // Header info section
    const row = worksheet.getRow(i);
    for(let j = 1; j <= 8; j++) {
       const cell = row.getCell(j);
       const currentBorder = cell.border || {};
       cell.border = { top: currentBorder.top || { style: 'thin' }, left: currentBorder.left || { style: 'thin' }, bottom: currentBorder.bottom || { style: 'thin' }, right: currentBorder.right || { style: 'thin' } };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
