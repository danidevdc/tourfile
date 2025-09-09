
import ExcelJS from 'exceljs';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

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

  // ---- COLUMN SETUP (A como margen) ----
  worksheet.getColumn('A').width = 2; // Margen izquierdo
  worksheet.getColumn('B').width = 12; // FECHA
  worksheet.getColumn('C').width = 8; // HORA
  worksheet.getColumn('D').width = 40; // SERVICIO
  worksheet.getColumn('E').width = 14.71; // VUELO
  worksheet.getColumn('F').width = 14.86; // GUIA
  worksheet.getColumn('G').width = 10; // BUS
  worksheet.getColumn('H').width = 10.71; // CHOFER
  worksheet.getColumn('I').width = 49.86; // OBSERVACIONES

  // ---- STYLES ----
  const thin: Partial<ExcelJS.Border> = { style: 'thin' };
  const dotted: Partial<ExcelJS.Border> = { style: 'dotted' };
  const fullThinBorders: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
  
  const titleStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 16, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };

  const infoHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11, bold: true },
    border: fullThinBorders,
  };
  
  const infoValueStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11 },
    border: fullThinBorders,
    alignment: { horizontal: 'center', vertical: 'middle' }
  };

  const tableHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11, bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: fullThinBorders
  };
  
  const tableBodyCellStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11 },
    alignment: { vertical: 'middle', wrapText: true, horizontal: 'left' }, // Default to left
    border: { left: dotted, right: dotted, bottom: { style: 'none' }, top: { style: 'none' } }
  };
  
  const tableBottomBorderStyle: Partial<ExcelJS.Borders> = { bottom: thin };

  const noteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // Gris muy claro

  // ---- TITLE ----
  worksheet.mergeCells('B1:I1');
  const title = worksheet.getCell('B1');
  title.value = 'ORDEN DE SERVICIOS';
  title.style = titleStyle;
  worksheet.getRow(1).height = 20.1;

  // ---- INFO BLOCK (filas 2–6) ----
  const infoData = [
    { label: 'GUIA:', value: data.guia },
    { label: 'FILE:', value: data.file },
    { label: 'REF:', value: data.ref },
    { label: 'N° PAX:', value: data.nPax },
    { label: 'HOTEL:', value: data.hotel }
  ];

  for (let i = 0; i < infoData.length; i++) {
      const r = i + 2;
      const item = infoData[i];
      worksheet.getCell(`B${r}`).value = item.label;
      worksheet.getCell(`B${r}`).style = infoHeaderStyle;
      
      worksheet.mergeCells(`C${r}:I${r}`);
      const valueCell = worksheet.getCell(`C${r}`);
      valueCell.value = item.value;
      valueCell.style = infoValueStyle;
      // Apply style to all merged cells to ensure consistent borders
      for(let col = 3; col <= 9; col++) {
          worksheet.getCell(r, col).style = infoValueStyle;
      }
  }


  // ---- TABLE HEADER (fila 7) ----
  const headerRowIdx = 7;
  const headerRow = worksheet.getRow(headerRowIdx);
  headerRow.values = [null, 'FECHA', 'HORA', 'SERVICIO', 'VUELO', 'GUIA', 'BUS', 'CHOFER', 'OBSERVACIONES'];
  headerRow.eachCell((cell, col) => {
    if (col >= 2) cell.style = tableHeaderStyle;
  });

  // ---- TABLE BODY ----
  const firstBodyRow = headerRowIdx + 1;
  let lastDate = '';

  if (data.services?.length) {
    for (const [index, s] of data.services.entries()) {
      const guiaCompleto = s.guia || data.guia || '';
      const guiaFirst = guiaCompleto.trim().split(/\s+/)[0] || '';
      const isSameDate = s.fecha === lastDate;

      const row = worksheet.addRow([
        null,
        isSameDate ? '' : s.fecha,
        s.hora || '',
        s.servicio || '',
        s.vuelo || '',
        guiaFirst,
        s.bus || '',
        (s.chofer || '').replace(/^CONT\s/i, ''),
        s.observaciones || ''
      ]);
      
      if (!isSameDate) {
        lastDate = s.fecha;
      }

      row.height = 25;

      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (col < 2) return;
        cell.style = { ...tableBodyCellStyle }; // Create a copy of the base style
        const colLetter = cell.address.replace(/\d+/g, '');
        // Apply center alignment to specific columns
        if (['B', 'C', 'E', 'F', 'G', 'H'].includes(colLetter)) {
          cell.alignment = { ...(cell.alignment || {}), horizontal: 'center' };
        }
      });
      
      row.getCell(2).border = { ...row.getCell(2).border, left: thin };
      row.getCell(9).border = { ...row.getCell(9).border, right: thin };
    }
     // Add bottom border to the last row of the table
    const lastRow = worksheet.getRow(worksheet.rowCount);
    lastRow.eachCell({ includeEmpty: false }, (cell, col) => {
        if (col >= 2) {
            cell.border = { ...cell.border, bottom: thin };
        }
    });
  }

  // ---- FOOTER: OBSERVACIONES y NOTA ----
  const lastRowIndex = worksheet.rowCount;
  
  const obsLabelRowIndex = lastRowIndex + 1;
  worksheet.getCell(`B${obsLabelRowIndex}`).value = 'OBSERVACIONES:';
  worksheet.getCell(`B${obsLabelRowIndex}`).style = { font: { name: 'Calibri', size: 11, bold: true }};

  const obsContentRowIndex = obsLabelRowIndex + 1;
  worksheet.mergeCells(`B${obsContentRowIndex}:I${obsContentRowIndex}`);
  const obsCell = worksheet.getCell(`B${obsContentRowIndex}`);
  obsCell.value = data.observations || '';
  obsCell.style = {
    font: { name: 'Calibri', size: 10 },
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    fill: noteFill
  };
  worksheet.getRow(obsContentRowIndex).height = 45;

  const notaLabelRowIndex = obsContentRowIndex + 1;
  worksheet.getCell(`B${notaLabelRowIndex}`).value = 'NOTA:';
  worksheet.getCell(`B${notaLabelRowIndex}`).style = { font: { name: 'Calibri', size: 11, bold: true }};

  const notaContentRowIndex = notaLabelRowIndex + 1;
  worksheet.mergeCells(`B${notaContentRowIndex}:I${notaContentRowIndex}`);
  const notaCell = worksheet.getCell(`B${notaContentRowIndex}`);
  notaCell.value = data.nota || '';
  notaCell.style = {
    font: { name: 'Calibri', size: 11 },
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    fill: noteFill
  };
  worksheet.getRow(notaContentRowIndex).height = 34.5;


  // Export
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
