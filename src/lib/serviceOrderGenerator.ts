

import type ExcelJS from 'exceljs';

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
  id?: string;
  fecha: string;
  hora: string;
  servicio: string;
  vuelo?: string;
  guia?: string;
  bus?: string;
  chofer?: string;
  tarifa?: string;
  observaciones?: string;
}

export async function generateServiceOrderExcel(data: ServiceOrderData): Promise<Awaited<ReturnType<ExcelJS.Xlsx['writeBuffer']>>> {
  const { default: ExcelJS } = await import('exceljs');
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
  worksheet.getColumn('I').width = 10; // TARIFA
  worksheet.getColumn('J').width = 49.86; // OBSERVACIONES

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
    alignment: { horizontal: 'left', vertical: 'middle' }
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
    border: { left: dotted, right: dotted }
  };

  const tableBottomBorderStyle: Partial<ExcelJS.Borders> = { bottom: thin };

  const noteFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; // Gris muy claro

  // ---- TITLE ----
  worksheet.mergeCells('B1:J1');
  const title = worksheet.getCell('B1');
  title.value = 'ORDEN DE SERVICIOS';
  title.style = titleStyle;
  worksheet.getRow(1).height = 20.1;

  // ---- INFO BLOCK (filas 2–6) ----
  // Collect unique guides
  const allGuides = new Set<string>();
  if (data.guia && data.guia.trim()) {
    data.guia.split(',').forEach(g => {
      if (g.trim()) allGuides.add(g.trim());
    });
  }
  data.services?.forEach(service => {
    if (service.guia && service.guia.trim()) {
      // Puede ser una lista ("ANA, ADRIANA") en órdenes duplicadas al chofer
      service.guia.split(',').forEach(g => {
        if (g.trim()) allGuides.add(g.trim());
      });
    }
  });
  const displayGuide = allGuides.size > 0 ? Array.from(allGuides).join(', ') : '—';


  const infoData = [
    { label: 'GUIA:', value: displayGuide },
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

    worksheet.mergeCells(`C${r}:J${r}`);
    const valueCell = worksheet.getCell(`C${r}`);
    valueCell.value = item.value;
    valueCell.style = infoValueStyle;
    // Apply style to all merged cells to ensure consistent borders
    for (let col = 3; col <= 10; col++) {
      worksheet.getCell(r, col).style = infoValueStyle;
    }
  }


  // ---- TABLE HEADER (fila 7) ----
  const headerRowIdx = 7;
  const headerRow = worksheet.getRow(headerRowIdx);
  headerRow.values = [null, 'FECHA', 'HORA', 'SERVICIO', 'VUELO', 'GUIA', 'BUS', 'CHOFER', 'TARIFA', 'OBSERVACIONES'];
  headerRow.eachCell((cell, col) => {
    if (col >= 2) cell.style = tableHeaderStyle;
  });

  // ---- TABLE BODY ----
  const firstBodyRow = headerRowIdx + 1;
  let lastDate = '';
  let lastServiceRowIndex = firstBodyRow;

  if (data.services?.length) {
    for (const [index, s] of data.services.entries()) {
      const guiaCompleto = s.guia || data.guia || '';
      // Primer nombre de cada guía; soporta listas ("ANA CAMACHO, ADRIANA FERNANDEZ")
      const guiaFirst = guiaCompleto.split(',').map(g => g.trim().split(/\s+/)[0] || '').filter(Boolean).join(', ');
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
        s.tarifa || '',
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
        if (['B', 'C', 'E', 'F', 'G', 'H', 'I'].includes(colLetter)) {
          cell.alignment = { ...(cell.alignment || {}), horizontal: 'center' };
        }
      });

      row.getCell(2).border = { ...row.getCell(2).border, left: thin };
      row.getCell(10).border = { ...row.getCell(10).border, right: thin };

      lastServiceRowIndex = worksheet.rowCount;
    }
    // Add bottom border to the last row of the table
    const lastRow = worksheet.getRow(worksheet.rowCount);
    lastRow.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col >= 2) {
        cell.border = { ...cell.border, bottom: thin };
      }
    });

    // Add TOTAL row with Excel formula
    const totalRow = worksheet.addRow([
      null,
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTAL',
      { formula: `SUM(I${firstBodyRow}:I${lastServiceRowIndex})`, result: 0 },
      ''
    ]);

    totalRow.height = 25;
    totalRow.getCell(8).font = { name: 'Calibri', size: 11, bold: true };
    totalRow.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(8).border = { top: thin, left: thin, bottom: thin, right: thin };
    totalRow.getCell(9).font = { name: 'Calibri', size: 11, bold: true };
    totalRow.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(9).border = { top: thin, left: thin, bottom: thin, right: thin };
    totalRow.getCell(2).border = { ...totalRow.getCell(2).border, left: thin, bottom: thin };
    totalRow.getCell(10).border = { ...totalRow.getCell(10).border, right: thin, bottom: thin };

    // Apply bottom border to all cells in the TOTAL row
    for (let col = 2; col <= 10; col++) {
      if (col !== 8 && col !== 9) {
        totalRow.getCell(col).border = { ...totalRow.getCell(col).border, bottom: thin };
      }
    }
  }

  // ---- FOOTER: OBSERVACIONES y NOTA ----
  const lastRowIndex = worksheet.rowCount;

  const obsLabelRowIndex = lastRowIndex + 1;
  worksheet.getCell(`B${obsLabelRowIndex}`).value = 'OBSERVACIONES:';
  worksheet.getCell(`B${obsLabelRowIndex}`).style = { font: { name: 'Calibri', size: 11, bold: true } };

  const obsContentRowIndex = obsLabelRowIndex + 1;
  worksheet.mergeCells(`B${obsContentRowIndex}:J${obsContentRowIndex}`);
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
  worksheet.getCell(`B${notaLabelRowIndex}`).style = { font: { name: 'Calibri', size: 11, bold: true } };

  const notaContentRowIndex = notaLabelRowIndex + 1;
  worksheet.mergeCells(`B${notaContentRowIndex}:J${notaContentRowIndex}`);
  const notaCell = worksheet.getCell(`B${notaContentRowIndex}`);
  notaCell.value = data.nota || '';
  notaCell.style = {
    font: { name: 'Calibri', size: 11 },
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    fill: noteFill
  };
  worksheet.getRow(notaContentRowIndex).height = 34.5;


  // Export
  return workbook.xlsx.writeBuffer();
}
