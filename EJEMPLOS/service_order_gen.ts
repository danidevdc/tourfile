// src/lib/service-order-generator.ts
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

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
  
  // Create worksheet data as array of arrays
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
  wsData.push([
    'FECHA',
    'HORA',
    'SERVICIO',
    'VUELO',
    'GUIA',
    'BUS',
    'CHOFER',
    'OBSERVACIONES'
  ]);
  
  // Add service items
  data.services.forEach(service => {
    wsData.push([
      service.fecha || '',
      service.hora || '',
      service.servicio || '',
      service.vuelo || '',
      service.guia || '',
      service.bus || '',
      service.chofer || '',
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
  
  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Apply formatting and styling
  formatServiceOrderWorksheet(ws, wsData.length);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Orden de Servicios');
  
  return wb;
}

// Function to apply formatting to the worksheet
function formatServiceOrderWorksheet(ws: XLSX.WorkSheet, totalRows: number): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // Set column widths
  ws['!cols'] = [
    { wch: 10 }, // FECHA
    { wch: 8 },  // HORA
    { wch: 25 }, // SERVICIO
    { wch: 10 }, // VUELO
    { wch: 12 }, // GUIA
    { wch: 8 },  // BUS
    { wch: 12 }, // CHOFER
    { wch: 20 }  // OBSERVACIONES
  ];
  
  // Apply borders and alignment to all cells
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell_address]) continue;
      
      const cell = ws[cell_address];
      
      // Apply border to all cells
      cell.s = cell.s || {};
      cell.s.border = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      };
      
      // Title formatting (first row)
      if (R === 0) {
        cell.s.font = { bold: true, size: 14 };
        cell.s.alignment = { horizontal: 'center' };
      }
      
      // Header information formatting (rows 3-7)
      if (R >= 2 && R <= 6 && C === 0) {
        cell.s.font = { bold: true };
      }
      
      // Table header formatting
      const headerRowIndex = findTableHeaderRow(totalRows);
      if (R === headerRowIndex) {
        cell.s.font = { bold: true };
        cell.s.fill = { fgColor: { rgb: 'E0E0E0' } };
        cell.s.alignment = { horizontal: 'center' };
      }
      
      // Center align date and time columns
      if ((C === 0 || C === 1) && R > headerRowIndex) {
        cell.s.alignment = { horizontal: 'center' };
      }
    }
  }
  
  // Merge cells for title
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } } // Merge title across all columns
  ];
}

// Helper function to find the table header row
function findTableHeaderRow(totalRows: number): number {
  // The table header is typically around row 7-8 (0-indexed: 6-7)
  return 7;
}

// Function to save the Excel file
export function saveServiceOrderExcel(workbook: XLSX.WorkBook, filename?: string): void {
  const defaultFilename = `Orden_Servicios_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  const finalFilename = filename || defaultFilename;
  
  XLSX.writeFile(workbook, finalFilename);
}

// Complete function to generate and save service order
export function createServiceOrder(data: ServiceOrderData, filename?: string): void {
  const workbook = generateServiceOrderExcel(data);
  saveServiceOrderExcel(workbook, filename);
}

// Example usage function
export function createExampleServiceOrder(): void {
  const exampleData: ServiceOrderData = {
    guia: 'NATALIA CAMARGO',
    file: 'CTT106303',
    ref: 'BUCHANAN x 02 REF: EAK1K4',
    nPax: '8',
    hotel: 'EUROPA',
    services: [
      {
        fecha: '2/8/2025',
        hora: '07:30',
        servicio: 'TRF IN',
        vuelo: 'LA 890*',
        guia: 'NATALIA',
        bus: '8',
        chofer: 'JHONNY',
        observaciones: 'VUELO LLEGA 08:34 SC/LP PAX TIENEN FRIE NOCHE'
      },
      {
        fecha: '',
        hora: '14:00',
        servicio: 'HD CITY+TELEFERICO+VALLE',
        vuelo: '',
        guia: 'NATALIA',
        bus: '8',
        chofer: 'JHONNY',
        observaciones: ''
      },
      {
        fecha: '',
        hora: '',
        servicio: 'CENA',
        vuelo: '',
        guia: 'NATALIA',
        bus: '8',
        chofer: 'JHONNY',
        observaciones: 'MANKA'
      },
      {
        fecha: '3/8/2025',
        hora: '04:15',
        servicio: 'TRF OUT',
        vuelo: 'OB',
        guia: 'NATALIA',
        bus: '8',
        chofer: 'JHONNY',
        observaciones: 'VUELO SALE 06:20 LP/VVI/SRE'
      }
    ],
    observations: '',
    nota: 'SERVICIOS EN EL LAGO.\nTODOS LOS GUIAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA'
  };
  
  createServiceOrder(exampleData, 'Orden_Servicios_Ejemplo.xlsx');
}

// Function to convert data from your existing expense system
export function convertFromExpenseData(
  guideName: string,
  fileNumber: string,
  ref: string,
  paxCount: string,
  hotel: string,
  tourStartDate: string,
  services: { servicio: string; hora?: string; observaciones?: string }[]
): ServiceOrderData {
  
  const serviceItems: ServiceItem[] = services.map((service, index) => ({
    fecha: index === 0 ? tourStartDate : '', // Only first service gets the date
    hora: service.hora || '',
    servicio: service.servicio,
    vuelo: '',
    guia: guideName.split(' ')[0], // First name only
    bus: paxCount,
    chofer: '',
    observaciones: service.observaciones || ''
  }));
  
  return {
    guia: guideName,
    file: fileNumber,
    ref: ref,
    nPax: paxCount,
    hotel: hotel,
    services: serviceItems,
    nota: 'SERVICIOS EN EL LAGO.\nTODOS LOS GUIAS DEBEN ENVIAR UN INFORME DIARIO POR WHATSAPP A LA SEÑORA JUDITH SOBRE LOS SERVICIOS.\nGUIA DEBE PRESENTAR COPIA DE PASAPORTE DE PAX DESPUES DE CADA SERVICIO JUNTO A SU LIQUIDACION Y CAJA CHICA'
  };
}