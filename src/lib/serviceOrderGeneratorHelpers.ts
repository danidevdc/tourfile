import { parse } from 'date-fns';
import type { Hotel, ServiceItem } from '@/lib/serviceOrderService';

export type ExcelCell = string | number | boolean | null | undefined;
export type ExcelMatrix = ExcelCell[][];

export type FileSearchResult =
  | {
      found: true;
      ambiguous: false;
      /** Real file number from the Excel, only set when matched by numeric suffix. */
      realFileNumber: string | null;
      fileColumnIndex: number;
      groupName: string;
      pax: string;
      hotelName: string;
    }
  | {
      found: false;
      ambiguous: true;
      distinctValues: string[];
    }
  | {
      found: false;
      ambiguous: false;
    };

/**
 * Searches for a file number inside a raw Excel matrix, then extracts the
 * group name, PAX count, and hotel name from the same column.
 *
 * Pure — no state, no I/O. Mirrors the logic that used to live inline in
 * ServiceOrderGeneratorSheet's handleSearchFile.
 */
export function findFileInExcelData(
  excelData: ExcelMatrix,
  fileNumberInput: string,
  hotels: Hotel[]
): FileSearchResult {
  const fileNumberToSearch = fileNumberInput.trim().toUpperCase();
  // Si el usuario escribió solo dígitos (sin el prefijo, ej. "109860" en vez de
  // "CTFI109860"), se busca por sufijo numérico. Solo se acepta si es
  // inequívoco: distintos files pueden compartir el mismo número con
  // prefijos distintos, así que un match ambiguo no se resuelve solo.
  const isDigitsOnlySearch = /^\d+$/.test(fileNumberToSearch);

  const numCols = excelData.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);

  let found = false;
  let fileColumnIndex = -1;
  let rowIdxWhereFileNumberFound = -1;

  for (let j = 0; j < numCols; j++) {
    for (let i = 0; i < excelData.length; i++) {
      if (excelData[i] && excelData[i][j] && String(excelData[i][j]).trim().toUpperCase() === fileNumberToSearch) {
        found = true; fileColumnIndex = j; rowIdxWhereFileNumberFound = i; break;
      }
    }
    if (found) break;
  }

  let realFileNumber: string | null = null;

  if (!found && isDigitsOnlySearch) {
    const suffixMatches: { row: number; col: number; value: string }[] = [];
    for (let j = 0; j < numCols; j++) {
      for (let i = 0; i < excelData.length; i++) {
        const cellValue = excelData[i] && excelData[i][j];
        if (cellValue !== undefined && cellValue !== null) {
          const cellText = String(cellValue).trim().toUpperCase();
          if (cellText.endsWith(fileNumberToSearch) && /^[A-Z]*\d+$/.test(cellText)) {
            suffixMatches.push({ row: i, col: j, value: cellText });
          }
        }
      }
    }

    const distinctValues = new Set(suffixMatches.map(m => m.value));
    if (distinctValues.size === 1) {
      fileColumnIndex = suffixMatches[0].col;
      rowIdxWhereFileNumberFound = suffixMatches[0].row;
      realFileNumber = suffixMatches[0].value;
      found = true;
    } else if (distinctValues.size > 1) {
      return { found: false, ambiguous: true, distinctValues: Array.from(distinctValues) };
    }
  }

  if (!found) {
    return { found: false, ambiguous: false };
  }

  const groupName = String(excelData[rowIdxWhereFileNumberFound + 1]?.[fileColumnIndex] || "No encontrado").toUpperCase();

  let pax = "N/A";
  for (let i = rowIdxWhereFileNumberFound + 1; i < excelData.length && i < rowIdxWhereFileNumberFound + 10; i++) {
    const paxRaw = excelData[i]?.[fileColumnIndex];
    if (paxRaw !== null && paxRaw !== undefined) {
      const paxValue = String(paxRaw).trim();
      const paxRegex = /^\d{1,3}(\s*\+\s*\d{1,3})?$/;
      if (paxRegex.test(paxValue)) { pax = paxValue; break; }
    }
  }

  let hotelName = "";
  // Busca SOLO en la columna del file, acumulando todos los hoteles encontrados
  const allFoundHotels = new Set<string>();

  for (let i = 0; i < excelData.length; i++) {
    const cellText = String(excelData[i]?.[fileColumnIndex] || "").toUpperCase().trim();

    // Busca todos los hoteles de la BD en esta celda
    hotels.forEach(h => {
      if (cellText.includes(h.name.toUpperCase())) {
        allFoundHotels.add(h.name);
      }
    });
  }

  if (allFoundHotels.size > 0) {
    // Priorizar no-POSADA
    const nonPosadaHotels = Array.from(allFoundHotels).filter(h => h.toUpperCase() !== 'POSADA');
    const hotelsToPick = nonPosadaHotels.length > 0 ? nonPosadaHotels : Array.from(allFoundHotels);

    // Entre los hoteles a seleccionar, escoger el más largo (más específico)
    hotelName = hotelsToPick.sort((a, b) => b.length - a.length)[0];
  }

  return { found: true, ambiguous: false, realFileNumber, fileColumnIndex, groupName, pax, hotelName };
}

/**
 * Sorts service items by date, then by time (items without a time sort last).
 *
 * Pure — mirrors sortServiceItems from ServiceOrderGeneratorSheet.
 */
export function sortServiceItems(items: ServiceItem[]): ServiceItem[] {
  return [...items].sort((a, b) => {
    try {
      const dateA = a.fecha ? parse(a.fecha, "dd/MM/yyyy", new Date()).getTime() : 0;
      const dateB = b.fecha ? parse(b.fecha, "dd/MM/yyyy", new Date()).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
    } catch { /* invalid date format, fall through to time comparison */ }

    const hasTimeA = a.hora && a.hora.trim() !== '';
    const hasTimeB = b.hora && b.hora.trim() !== '';

    if (hasTimeA && !hasTimeB) return -1;
    if (!hasTimeA && hasTimeB) return 1;
    if (hasTimeA && hasTimeB) return a.hora.localeCompare(b.hora);
    return 0;
  });
}
