import { describe, expect, it } from 'vitest';
import type { ServiceOrderRule } from '@/lib/serviceOrderRuleService';
import type { PredefinedFlight } from '@/lib/serviceOrderService';
import {
  extractFlightCodes,
  generateServicesFromExcelColumnWithDiagnostics,
} from '@/lib/serviceOrderProcessor';

const transferRule = (
  activity: 'TRF IN' | 'TRF OUT' = 'TRF IN'
): ServiceOrderRule => ({
  id: `rule-${activity}`,
  keyword: activity === 'TRF IN'
    ? 'PRIVATE TRANSFER FROM AIRPORT TO HOTEL'
    : 'PRIVATE TRANSFER FROM HOTEL TO AIRPORT',
  activity,
  isActive: true,
  order: 1,
});

const flight = (
  flightNumber: string,
  observations: string,
  time = '10:30'
): PredefinedFlight => ({
  id: `${flightNumber}-${observations}`,
  flightNumber,
  observations,
  time,
});

describe('extractFlightCodes', () => {
  it('normalizes aliases and expands a shared-prefix multi-leg code', () => {
    expect(extractFlightCodes('OB777/685 MAD/VVI/LPB')).toEqual(['OB777', 'OB685']);
    expect(extractFlightCodes('AVA 105 CUZ/LPB')).toEqual(['AV105']);
  });

  it('does not treat times, dates or PNR digits as flight codes', () => {
    expect(extractFlightCodes('AV 105 CUZ/LPB 12:30 14:45 PNR 7MLSMS')).toEqual(['AV105']);
  });
});

describe('generateServicesFromExcelColumnWithDiagnostics', () => {
  it('generates TRF IN only for a database flight marked as arriving', () => {
    const result = generateServicesFromExcelColumnWithDiagnostics(
      [
        [null, '10-CT-Private transfer from airport to hotel - AV 105 CUZ/LPB'],
        [null, '10-Anavin-Private transfer from airport to hotel - OB735 GRU/VVI'],
        [null, '10-Anavin-Private transfer from airport to hotel - Day time'],
      ],
      1,
      [transferRule('TRF IN')],
      [],
      [flight('AV105', 'LLEGA A LA PAZ', '14:45')]
    );

    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toMatchObject({
      servicio: 'TRF IN',
      vuelo: 'AV105',
      hora: '14:45',
      observaciones: 'LLEGA A LA PAZ',
    });
    expect(result.skippedTransfers.map(item => item.reason)).toEqual([
      'FLIGHT_NOT_IN_DATABASE',
      'NO_FLIGHT_CODE',
    ]);
  });

  it('rejects a known flight when its direction conflicts with the transfer', () => {
    const result = generateServicesFromExcelColumnWithDiagnostics(
      [[null, 'Private transfer from airport to hotel - OB735 GRU/VVI']],
      1,
      [transferRule('TRF IN')],
      [],
      [flight('OB735', 'SALE DE LA PAZ')]
    );

    expect(result.services).toEqual([]);
    expect(result.skippedTransfers[0].reason).toBe('DIRECTION_MISMATCH');
  });

  it('uses the last compatible leg for TRF IN shorthand', () => {
    const result = generateServicesFromExcelColumnWithDiagnostics(
      [[null, 'Private transfer from airport to hotel - OB777/685 MAD/VVI/LPB']],
      1,
      [transferRule('TRF IN')],
      [],
      [
        flight('OB777', 'SALE DE LA PAZ', '08:00'),
        flight('OB685', 'LLEGA A LA PAZ', '11:20'),
      ]
    );

    expect(result.services[0]).toMatchObject({ vuelo: 'OB685', hora: '11:20' });
    expect(result.skippedTransfers).toEqual([]);
  });

  it('uses the first compatible leg for TRF OUT', () => {
    const result = generateServicesFromExcelColumnWithDiagnostics(
      [[null, 'Private transfer from hotel to airport - OB685/777 LPB/VVI/MAD']],
      1,
      [transferRule('TRF OUT')],
      [],
      [
        flight('OB685', 'SALE DE LA PAZ', '09:15'),
        flight('OB777', 'LLEGA A LA PAZ', '13:00'),
      ]
    );

    expect(result.services[0]).toMatchObject({ vuelo: 'OB685', hora: '09:15' });
    expect(result.skippedTransfers).toEqual([]);
  });

  it('keeps non-transfer rules independent from the flight database', () => {
    const cityTourRule: ServiceOrderRule = {
      id: 'city-tour',
      keyword: 'CITY TOUR',
      activity: 'CITY TOUR LA PAZ',
      isActive: true,
      order: 10,
    };

    const result = generateServicesFromExcelColumnWithDiagnostics(
      [[null, '10-CT-City Tour, Moon Valley and Cable Car']],
      1,
      [cityTourRule],
      [],
      []
    );

    expect(result.services).toHaveLength(1);
    expect(result.services[0].servicio).toBe('CITY TOUR LA PAZ');
    expect(result.skippedTransfers).toEqual([]);
  });
});
