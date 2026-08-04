import { describe, it, expect } from 'vitest';
import {
  extractFlightNumbers,
  getExpectedOperation,
  getOrderRoute,
  getRowLiveState,
  matchNaabolFlight,
  normalizeDate,
  MISMATCH_THRESHOLD_MINUTES,
} from '@/lib/flightMonitorParsing';
import type { NaabolMonitorFlight } from '@/ai/flows/flight-monitor-flow';

function buildNaabolFlight(overrides: Partial<NaabolMonitorFlight> = {}): NaabolMonitorFlight {
  return {
    airportCode: 'LPB',
    operation: 'L',
    flightDigits: '123',
    statusLabel: 'EN HORARIO',
    statusTone: 'success',
    ...overrides,
  };
}

describe('normalizeDate', () => {
  it('converts yyyy-mm-dd to dd/mm/yyyy', () => {
    expect(normalizeDate('2026-08-04')).toBe('04/08/2026');
  });

  it('keeps dd/mm/yyyy as-is', () => {
    expect(normalizeDate('04/08/2026')).toBe('04/08/2026');
  });

  it('expands dd/mm/yy to dd/mm/20yy', () => {
    expect(normalizeDate('04/08/26')).toBe('04/08/2026');
  });

  it('returns null for unrecognized formats', () => {
    expect(normalizeDate('4 de agosto')).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });
});

describe('extractFlightNumbers', () => {
  it('extracts a bolivian-prefixed flight number from the vuelo field', () => {
    const { flights, dominantPrefix } = extractFlightNumbers('OB123', '');
    expect(flights).toContain('OB123');
    expect(dominantPrefix).toBe('OB');
  });

  it('normalizes BOV alias to OB', () => {
    const { flights, dominantPrefix } = extractFlightNumbers('BOV456', '');
    expect(flights).toContain('OB456');
    expect(dominantPrefix).toBe('OB');
  });

  it('falls back to observaciones when vuelo is empty', () => {
    const { flights } = extractFlightNumbers('', 'VUELO LLEGA 10:00 UYU/LPB OB988');
    expect(flights.some((f) => f.includes('988'))).toBe(true);
  });
});

describe('getExpectedOperation', () => {
  it('detects salida from OUT in service name', () => {
    expect(getExpectedOperation('TRF OUT AEROPUERTO', '')).toBe('S');
  });

  it('detects llegada from IN in service name', () => {
    expect(getExpectedOperation('TRF IN HOTEL', '')).toBe('L');
  });

  it('detects llegada from LLEGA in observaciones', () => {
    expect(getExpectedOperation('TRASLADO', 'VUELO LLEGA 10:00 UYU/LPB')).toBe('L');
  });

  it('returns undefined when nothing matches', () => {
    expect(getExpectedOperation('CITY TOUR', 'SIN DATOS')).toBeUndefined();
  });
});

describe('getOrderRoute', () => {
  it('parses the real order format "VUELO LLEGA 10:00 UYU/LPB"', () => {
    const route = getOrderRoute({
      serviceName: 'TRF IN AEROPUERTO',
      observations: 'VUELO LLEGA 10:00 UYU/LPB',
      expectedOperation: 'L',
    });
    expect(route).toBe('UYU -> LPB');
  });

  it('parses a dash-separated pair', () => {
    const route = getOrderRoute({
      serviceName: 'OB123 LPB-VVI',
      observations: '',
      expectedOperation: 'S',
    });
    expect(route).toBe('LPB -> VVI');
  });

  it('falls back to a known city name when no XXX/YYY pair is present', () => {
    const route = getOrderRoute({
      serviceName: 'TRF OUT',
      observations: 'SALE A SANTA CRUZ',
      expectedOperation: 'S',
    });
    expect(route).toBe('LPB -> VVI');
  });

  it('returns null when nothing recognizable is found', () => {
    const route = getOrderRoute({
      serviceName: 'CITY TOUR',
      observations: 'Sin datos de vuelo',
    });
    expect(route).toBeNull();
  });
});

describe('getRowLiveState', () => {
  it('is pending when there is no NAABOL match', () => {
    expect(getRowLiveState({ naabol: undefined, deltaMinutes: null })).toBe('pending');
  });

  it('is live-match when NAABOL data exists and delta is under the threshold', () => {
    const naabol = buildNaabolFlight();
    expect(getRowLiveState({ naabol, deltaMinutes: MISMATCH_THRESHOLD_MINUTES - 1 })).toBe('live-match');
    expect(getRowLiveState({ naabol, deltaMinutes: 0 })).toBe('live-match');
  });

  it('is live-mismatch when delta reaches the threshold', () => {
    const naabol = buildNaabolFlight();
    expect(getRowLiveState({ naabol, deltaMinutes: MISMATCH_THRESHOLD_MINUTES })).toBe('live-mismatch');
    expect(getRowLiveState({ naabol, deltaMinutes: -MISMATCH_THRESHOLD_MINUTES - 5 })).toBe('live-mismatch');
  });
});

describe('matchNaabolFlight', () => {
  it('matches by digits, airport and operation', () => {
    const flights = [
      buildNaabolFlight({ flightDigits: '123', operation: 'L', airportCode: 'LPB' }),
      buildNaabolFlight({ flightDigits: '999', operation: 'S', airportCode: 'VVI' }),
    ];
    const result = matchNaabolFlight({ flightDigitsList: ['123'], expectedOperation: 'L' }, flights);
    expect(result?.flightDigits).toBe('123');
  });

  it('disambiguates same digits+operation by airline when a prefix is known', () => {
    const flights = [
      buildNaabolFlight({ flightDigits: '500', operation: 'L', airportCode: 'LPB', airline: 'BOLIVIANA DE AVIACION' }),
      buildNaabolFlight({ flightDigits: '500', operation: 'L', airportCode: 'LPB', airline: 'OTRA AEROLINEA' }),
    ];
    const result = matchNaabolFlight({ flightDigitsList: ['500'], expectedOperation: 'L', expectedPrefix: 'OB' }, flights);
    expect(result?.airline).toBe('BOLIVIANA DE AVIACION');
  });

  it('falls back to the first candidate when no airline match is found', () => {
    const flights = [
      buildNaabolFlight({ flightDigits: '500', operation: 'L', airportCode: 'LPB', airline: 'DESCONOCIDA' }),
    ];
    const result = matchNaabolFlight({ flightDigitsList: ['500'], expectedOperation: 'L', expectedPrefix: 'OB' }, flights);
    expect(result?.flightDigits).toBe('500');
  });

  it('returns undefined when nothing matches', () => {
    const result = matchNaabolFlight({ flightDigitsList: ['999'] }, []);
    expect(result).toBeUndefined();
  });
});
