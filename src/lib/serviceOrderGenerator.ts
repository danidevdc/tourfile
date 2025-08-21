
// src/lib/serviceOrderGenerator.ts
import * as XLSX from 'xlsx';

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

// Function to create the Service Order Excel file
export function generateServiceOrderExcel(data: ServiceOrderData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  
  const wsData: (string | number)[][] = [];
  
  // Header row with title
  wsData.push(['ORDEN DE SERVICIOS']);
  wsData.push([]); // Empty row
  
  // Information section
  wsData.push(['GUIA', data.guia]);
  wsData.push(['FILE:', data.file]);
  wsData.push(['REF:', data.ref]);
  wsData.push(['N° PAX:', data.nPax]);
  wsData.push(['HOTEL:', data.hotel]);
  
  wsData.push([]); // Empty row
  
  // Services table header
  const tableHeader = [
    'FECHA', 'HORA', 'SERVICIO', 'VUELO', 'GUIA', 'BUS', 'CHOFER', 'OBSERVACIONES'
  ];
  wsData.push(tableHeader);
  
  // Add service items
  data.services.forEach(service => {
    wsData.push([
      service.fecha || '', 
      service.hora || '', 
      service.servicio || '',
      service.vuelo || '', 
      service.guia || '', 
      service.bus || '',
      service.chofer ? service.chofer.replace(/^CONT\s/i, '') : '',
      service.observaciones || ''
    ]);
  });
  
  // Add empty rows for spacing
  wsData.push([]);
  wsData.push([]);
  
  // Observations section
  if (data.observations) {
    wsData.push(['OBSERVACIONES:']);
    wsData.push([data.observations]);
    wsData.push([]);
  }
  
  // Note section
  if (data.nota) {
    wsData.push(['NOTA:', data.nota]);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(wsData, {cellStyles: true});
  
  // --- Start Formatting ---
  ws['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 10 }, { wch: 15 },
    { wch: 10 }, { wch: 15 }, { wch: 35 }
  ];

  const thinBorder = { style: 'thin', color: { rgb: '000000' } };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  const headerRowIndex = 8; // 0-indexed for wsData array
  
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }]; // Title merge

  if (data.observations) {
      const obsRow = wsData.findIndex(r => r[0] === 'OBSERVACIONES:');
      if (obsRow !== -1) {
          ws['!merges']?.push({ s: { r: obsRow + 1, c: 0 }, e: { r: obsRow + 1, c: 7 } });
      }
  }
  if (data.nota) {
      const notaRow = wsData.findIndex(r => r[0] === 'NOTA:');
      if (notaRow !== -1) {
          ws['!merges']?.push({ s: { r: notaRow, c: 1 }, e: { r: notaRow, c: 7 } });
      }
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:H1');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell_address]) continue;
        
        let cell = ws[cell_address];
        cell.s = cell.s || {};

        // Title
        if (R === 0) {
            cell.s.font = { name: 'Calibri', sz: 16, bold: true };
            cell.s.alignment = { horizontal: 'center', vertical: 'center' };
        }
        // Info Headers (GUIA, FILE, etc.)
        else if (R >= 2 && R <= 6 && C === 0) {
            cell.s.font = { name: 'Calibri', sz: 11, bold: true };
        }
        // Table Header
        else if (R === headerRowIndex) {
            cell.s.font = { name: 'Calibri', sz: 11, bold: true };
            cell.s.fill = { fgColor: { rgb: 'D9D9D9' } };
            cell.s.alignment = { horizontal: 'center', vertical: 'center' };
            cell.s.border = allBorders;
        }
        // Table content
        else if (R > headerRowIndex && R < (headerRowIndex + 1 + data.services.length)) {
             cell.s.border = allBorders;
             cell.s.font = { name: 'Calibri', sz: 11 };
             cell.s.alignment = { vertical: 'center', wrapText: true };
             if(C === 0 || C === 1) { // Center date and time
                 cell.s.alignment.horizontal = 'center';
             }
        }
        // Section Headers
        else if (String(cell.v).includes('OBSERVACIONES:') || String(cell.v).includes('NOTA:')) {
             cell.s.font = { name: 'Calibri', sz: 11, bold: true };
        }
        else {
             cell.s.font = { name: 'Calibri', sz: 11 };
        }
    }
  }
  
  XLSX.utils.book_append_sheet(wb, ws, 'Orden de Servicios');
  return wb;
}
