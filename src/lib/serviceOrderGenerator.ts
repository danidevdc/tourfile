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

  // ---- COLUMN SETUP (A como margen) ----
  worksheet.getColumn(1).width = 2; // A
  worksheet.getColumn(2).width = 12;       // B FECHA
  worksheet.getColumn(3).width = 8;        // C HORA
  worksheet.getColumn(4).width = 40;       // D SERVICIO
  worksheet.getColumn(5).width = 14.71;    // E VUELO
  worksheet.getColumn(6).width = 14.86;    // F GUIA
  worksheet.getColumn(7).width = 10;       // G BUS
  worksheet.getColumn(8).width = 10.71;    // H CHOFER
  worksheet.getColumn(9).width = 49.86;    // I OBSERVACIONES

  // ---- STYLES ----
  const thin: Partial<ExcelJS.Border> = { style: 'thin' };
  const dotted: Partial<ExcelJS.Border> = { style: 'dotted' };
  const fullThin: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

  const titleStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 16, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };

  const infoHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11, bold: true },
    border: fullThin
  };
  const infoValueStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11 },
    border: fullThin,
    alignment: { vertical: 'middle' }
  };

  const tableHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11, bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: fullThin
  };

  const verticalDotted: Partial<ExcelJS.Borders> = { left: dotted, right: dotted };
  const tableCellBase: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 11 },
    alignment: { vertical: 'middle', wrapText: true },
  };
  // Nota/Obs fondo suave (amarillo claro Excel)
  const noteFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // similar a “E2E2A” pastel

  // ---- TITLE ----
  worksheet.mergeCells('B1:I1');
  const title = worksheet.getCell('B1');
  title.value = 'ORDEN DE SERVICIOS';
  title.style = titleStyle;
  worksheet.getRow(1).height = 20; // ~20.1

  // ---- INFO BLOCK (filas 2–6 como en el modelo) ----
  const infoData = [
    { label: 'GUIA:', value: data.guia },
    { label: 'FILE:', value: data.file },
    { label: 'REF:', value: data.ref },
    { label: 'N° PAX:', value: data.nPax },
    { label: 'HOTEL:', value: data.hotel }
  ];

  let r = 2; // empezar en fila 2 (coincide con el archivo de referencia)
  for (const item of infoData) {
    worksheet.getCell(`B${r}`).value = item.label;
    worksheet.getCell(`B${r}`).style = infoHeaderStyle;

    worksheet.mergeCells(`C${r}:D${r}`);
    worksheet.getCell(`C${r}`).value = item.value;
    worksheet.getCell(`C${r}`).style = infoValueStyle;

    worksheet.mergeCells(`E${r}:I${r}`);
    // celda ancla para el merge E..I -> E
    worksheet.getCell(`E${r}`).style = infoValueStyle;
    r++;
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
  let current = firstBodyRow;

  if (data.services?.length) {
    for (const s of data.services) {
      const guiaCompleto = s.guia || data.guia || '';
      const guiaFirst = guiaCompleto.trim().split(/\s+/)[0] || '';

      const row = worksheet.addRow([
        null,
        s.fecha || '',
        s.hora || '',
        s.servicio || '',
        s.vuelo || '',
        guiaFirst,
        s.bus || '',
        (s.chofer || '').replace(/^CONT\s/i, ''),
        s.observaciones || ''
      ]);

      // Alto como en el modelo
      row.height = 25;

      row.eachCell((cell, col) => {
        if (col < 2) return;

        // Base
        cell.style = tableCellBase;

        // Alineaciones por columna
        const addr = cell.address;
        const colLetter = addr.replace(/\d+/g, '');
        if (['B', 'C', 'E', 'F', 'G', 'H'].includes(colLetter)) {
          cell.alignment = { ...(cell.alignment || {}), horizontal: 'center' };
        } else {
          // D (SERVICIO) e I (OBSERVACIONES)
          cell.alignment = { ...(cell.alignment || {}), horizontal: 'left' };
        }

        // Bordes verticales punteados interiores + arriba fino en el cuerpo
        cell.border = {
          top: thin,                                      // borde superior fino como el archivo
          left: dotted,
          right: dotted,
          bottom: undefined
        };
      });

      // Borde izquierdo fino en B y derecho fino en I (bordes externos de la tabla)
      const leftCell = row.getCell(2);
      leftCell.border = { ...(leftCell.border || {}), left: thin };

      const rightCell = row.getCell(9);
      rightCell.border = { ...(rightCell.border || {}), right: thin };

      current++;
    }

    // Borde inferior fino para la última fila del cuerpo
    const lastRow = worksheet.getRow(current - 1);
    lastRow.eachCell((cell, col) => {
      if (col >= 2) {
        cell.border = { ...(cell.border || {}), bottom: thin };
      }
    });
  }

  // ---- FOOTER: OBSERVACIONES y NOTA (filas 13–16) ----
  // OBSERVACIONES
  worksheet.getCell('B13').value = 'OBSERVACIONES:';
  worksheet.getCell('B13').style = { font: { name: 'Calibri', size: 11, bold: true }, alignment: { vertical: 'top' } };

  worksheet.mergeCells('B14:I14');
  const obsCell = worksheet.getCell('B14'); // ancla del merge
  obsCell.value = data.observations || '';
  obsCell.style = {
    font: { name: 'Calibri', size: 10 },
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    border: fullThin,
    fill: noteFill
  };

  // NOTA
  worksheet.getCell('B15').value = 'NOTA:';
  worksheet.getCell('B15').style = { font: { name: 'Calibri', size: 11, bold: true }, alignment: { vertical: 'top' } };

  worksheet.mergeCells('B16:I16');
  const notaCell = worksheet.getCell('B16'); // ancla del merge
  notaCell.value = data.nota || '';
  notaCell.style = {
    font: { name: 'Calibri', size: 11 },
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    border: fullThin,
    fill: noteFill
  };
  worksheet.getRow(16).height = 34.5; // coincide con el modelo

  // Export
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
