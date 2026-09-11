
"use client";

import type { ServiceOrderRule } from './serviceOrderRuleService';
import type { Activity, PredefinedFlight, ServiceItem } from './serviceOrderService';
import { getValidDateFromExcelCell } from './validators';
import { formatDateDDMMYYYY } from './formatters';

export type SkippedTransferReason =
  | 'NO_FLIGHT_CODE'
  | 'FLIGHT_NOT_IN_DATABASE'
  | 'DIRECTION_MISMATCH';

export interface SkippedTransfer {
  rowNumber: number;
  activity: string;
  activityText: string;
  detectedFlightNumbers: string[];
  reason: SkippedTransferReason;
}

export interface ServiceGenerationResult {
  services: ServiceItem[];
  skippedTransfers: SkippedTransfer[];
}

type AirportTransferType = 'TRF IN' | 'TRF OUT';

const FLIGHT_PREFIX_ALIASES: Record<string, string> = {
  AVA: 'AV',
  AV: 'AV',
  BOV: 'OB',
  BO: 'OB',
  OB: 'OB',
  LAN: 'LA',
  LA: 'LA',
  ECO: 'ECO',
  '8J': '8J',
};

const FLIGHT_CODE_PATTERN = /(?:^|[^A-Z0-9])(AVA|BOV|LAN|ECO|AV|BO|OB|LA|8J)\s*(\d{1,4})(?:\s*\/\s*(\d{1,4}))?/gi;

const normalizeFlightCode = (value: string): string => {
  const compact = value.replace(/[\s/-]/g, '').toUpperCase();
  const match = compact.match(/^([A-Z0-9]{2,3})(\d{1,4})$/);
  if (!match) return compact;
  return `${FLIGHT_PREFIX_ALIASES[match[1]] || match[1]}${match[2]}`;
};

/**
 * Extracts explicit airline flight codes without treating times, dates or PNR
 * digits as flights. Shorthand such as OB777/685 becomes OB777 + OB685.
 */
export function extractFlightCodes(activityText: string): string[] {
  const detected: string[] = [];
  const seen = new Set<string>();
  const matcher = new RegExp(FLIGHT_CODE_PATTERN.source, FLIGHT_CODE_PATTERN.flags);
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(activityText)) !== null) {
    const prefix = FLIGHT_PREFIX_ALIASES[match[1].toUpperCase()] || match[1].toUpperCase();
    const codes = [`${prefix}${match[2]}`];
    if (match[3]) codes.push(`${prefix}${match[3]}`);

    for (const code of codes) {
      if (!seen.has(code)) {
        seen.add(code);
        detected.push(code);
      }
    }
  }

  return detected;
}

const getAirportTransferType = (activity: string): AirportTransferType | null => {
  const normalized = activity.trim().toUpperCase();
  if (normalized === 'TRF IN') return 'TRF IN';
  if (normalized === 'TRF OUT') return 'TRF OUT';
  return null;
};

const isFlightDirectionCompatible = (
  flight: PredefinedFlight,
  transferType: AirportTransferType
): boolean => {
  const observations = (flight.observations || '').toUpperCase();
  return transferType === 'TRF IN'
    ? observations.includes('LLEGA')
    : observations.includes('SALE');
};

/**
 * Checks if a value from an Excel cell is a valid date (either a Date object or an Excel serial number).
 * @param cellValue The value from the cell.
 * @returns The Date object if it's a valid date, otherwise null.
 */
const getValidDateFromCell = (cellValue: any): Date | null => {
    return getValidDateFromExcelCell(cellValue);
};


/**
 * Generates a list of services by processing a specific column from Excel data against a set of rules.
 * This version iterates through each row of the specified column and checks ALL active rules against each cell
 * to find multiple potential activities within a single cell. It now also extracts the date from Column A.
 * @param excelData The full 2D array of data from the Excel sheet.
 * @param fileColumnIndex The index of the column where the File Number was found.
 * @param rules An array of active service order rules to apply.
 * @param activities The list of all activities from the database, used to find suggested times.
 * @param flights The list of all predefined flights from the database, used for automatic detection.
 * @returns An array of generated ServiceItem objects, in the order they were found.
 */
export function generateServicesFromExcelColumn(
  excelData: any[][] | null,
  fileColumnIndex: number,
  rules: ServiceOrderRule[],
  activities: Activity[],
  flights: PredefinedFlight[]
): ServiceItem[] {
  return generateServicesFromExcelColumnWithDiagnostics(
    excelData,
    fileColumnIndex,
    rules,
    activities,
    flights
  ).services;
}

/**
 * Detailed variant used by the generator UI. Airport transfers are emitted only
 * when the Tourplan row contains a flight present in the LPB master-data list
 * and its observation agrees with the transfer direction.
 */
export function generateServicesFromExcelColumnWithDiagnostics(
  excelData: any[][] | null,
  fileColumnIndex: number,
  rules: ServiceOrderRule[],
  _activities: Activity[],
  flights: PredefinedFlight[]
): ServiceGenerationResult {
  if (!excelData || fileColumnIndex === -1) {
    return { services: [], skippedTransfers: [] };
  }

  const generatedServices: ServiceItem[] = [];
  const skippedTransfers: SkippedTransfer[] = [];
  const activeRules = rules.filter(r => r.isActive).sort((a, b) => b.keyword.length - a.keyword.length); 
  const flightsByCode = new Map<string, PredefinedFlight[]>();

  for (const flight of flights) {
    const normalizedCode = normalizeFlightCode(flight.flightNumber);
    const existing = flightsByCode.get(normalizedCode) || [];
    existing.push(flight);
    flightsByCode.set(normalizedCode, existing);
  }
  
  let currentDate: string = ''; // Variable to hold the last seen date

  // Iterate over each row of the excel data
  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row) continue;

    // --- Step 1: Check for and update the current date from Column A (index 0) ---
    const dateCell = row[0];
    const validDate = getValidDateFromCell(dateCell);
    if (validDate) {
        currentDate = formatDateDDMMYYYY(validDate);
    }

    // --- Step 2: Check for activities in the file's column ---
    const activityText = row[fileColumnIndex] ? String(row[fileColumnIndex]).trim().toUpperCase() : '';

    if (activityText) {
      for (const rule of activeRules) {
        if (activityText.includes(rule.keyword.toUpperCase())) {
          let suggestedTime = '';
          let detectedFlight: PredefinedFlight | null = null;

          const transferType = getAirportTransferType(rule.activity);
          if (transferType) {
            const detectedFlightNumbers = extractFlightCodes(activityText);
            const databaseMatches = detectedFlightNumbers.flatMap(
              code => flightsByCode.get(normalizeFlightCode(code)) || []
            );

            // The last leg normally arrives at LPB; the first normally leaves it.
            const orderedCodes = transferType === 'TRF IN'
              ? [...detectedFlightNumbers].reverse()
              : detectedFlightNumbers;

            for (const code of orderedCodes) {
              const compatibleFlight = (flightsByCode.get(normalizeFlightCode(code)) || [])
                .find(flight => isFlightDirectionCompatible(flight, transferType));
              if (compatibleFlight) {
                detectedFlight = compatibleFlight;
                break;
              }
            }

            if (!detectedFlight) {
              const reason: SkippedTransferReason = detectedFlightNumbers.length === 0
                ? 'NO_FLIGHT_CODE'
                : databaseMatches.length === 0
                  ? 'FLIGHT_NOT_IN_DATABASE'
                  : 'DIRECTION_MISMATCH';

              skippedTransfers.push({
                rowNumber: i + 1,
                activity: rule.activity,
                activityText,
                detectedFlightNumbers,
                reason,
              });
              continue;
            }
          }

          if (detectedFlight) {
            suggestedTime = detectedFlight.time;
          }

          generatedServices.push({
            fecha: currentDate, // Assign the last seen date
            hora: suggestedTime,
            servicio: rule.activity,
            vuelo: detectedFlight?.flightNumber || '',
            guia: '',
            bus: '',
            chofer: '',
            observaciones: detectedFlight?.observations || '',
          });
        }
      }
    }
  }

  return {
    services: deduplicateServices(generatedServices),
    skippedTransfers,
  };
}

/**
 * Elimina servicios duplicados generados a partir de una misma línea del
 * programa repetida en el Excel (ej. "FD LAGO" listado dos veces el mismo
 * día). Dos servicios se consideran duplicados solo si coinciden en fecha,
 * nombre de servicio, vuelo Y observaciones — así dos TRF OUT el mismo día
 * con vuelos distintos se mantienen como filas separadas.
 */
function deduplicateServices(services: ServiceItem[]): ServiceItem[] {
  const seen = new Set<string>();
  const deduped: ServiceItem[] = [];
  for (const service of services) {
    const key = [service.fecha, service.servicio, service.vuelo, service.observaciones].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(service);
  }
  return deduped;
}
