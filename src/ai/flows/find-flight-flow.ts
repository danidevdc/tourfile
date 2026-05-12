
'use server';
/**
 * @fileOverview Finds real-time flight information by calling the FlightAware AeroAPI.
 *
 * - findFlight - The exported server action to find flight details.
 */
import { addDays, addMinutes, format, parse, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { formatTime, formatISO } from '@/lib/date-utils';
import type { FindFlightInput, FindFlightOutput, FlightRouteHint } from './flight-types';

const FLIGHTAWARE_TOO_FAR_FUTURE_ERROR = 'FLIGHTAWARE_TOO_FAR_FUTURE';

function getApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_AEROAPI_KEY;
  if (!apiKey) {
    throw new Error("AeroAPI key is missing. Please set NEXT_PUBLIC_AEROAPI_KEY in your .env file.");
  }
  return apiKey;
}

const IATA_TO_ICAO_AIRLINE_PREFIX: Record<string, string> = {
  '8J': 'ECO', // EcoJet
  AVA: 'AV', // Avianca canonical display/cache code for this module
  BO: 'BOV', // Boliviana de Aviacion / BoA alias
  LA: 'LAN', // LATAM Chile
  OB: 'BOV', // Boliviana de Aviacion
};

const AIRLABS_IATA_PREFIX: Record<string, string> = {
  '8J': '8J',
  AV: 'AV',
  AVA: 'AV',
  BO: 'OB',
  BOV: 'OB',
  ECO: '8J',
  LA: 'LA',
  LAN: 'LA',
  OB: 'OB',
};

const AIRLABS_ICAO_PREFIX: Record<string, string> = {
  '8J': 'ECO',
  AV: 'AVA',
  AVA: 'AVA',
  BO: 'BOV',
  BOV: 'BOV',
  ECO: 'ECO',
  LA: 'LAN',
  LAN: 'LAN',
  OB: 'BOV',
};

// Normalizes the flight number to the format expected by AeroAPI.
// "ob 305" -> "OB305" -> "BOV305"; "LA2401" -> "LAN2401"
function normalizeIdent(flightNumber: string): string {
  const upperCaseNoSpace = flightNumber.replace(/\s/g, '').toUpperCase();
  const match = upperCaseNoSpace.match(/^([A-Z0-9]+?)(\d+)$/);
  if (!match) return upperCaseNoSpace;

  const [, prefix, rest] = match;
  return `${IATA_TO_ICAO_AIRLINE_PREFIX[prefix] || prefix}${rest}`;
}

function getIdentCandidates(flightNumber: string): string[] {
  const compact = flightNumber.replace(/\s/g, '').toUpperCase();
  const normalized = normalizeIdent(compact);
  const digits = getFlightDigits(compact);
  const candidates = [normalized, compact];

  if (compact.startsWith('LA') && digits) {
    candidates.push(`LPE${digits}`);
  }

  return Array.from(new Set(candidates));
}

function getAirLabsIdentCandidates(flightNumber: string): Array<{ key: 'flight_iata' | 'flight_icao'; ident: string }> {
  const compact = flightNumber.replace(/\s/g, '').toUpperCase();
  const match = compact.match(/^([A-Z0-9]+?)(\d+)$/);
  if (!match) return [{ key: 'flight_iata', ident: compact }];

  const [, prefix, digits] = match;
  const candidates: Array<{ key: 'flight_iata' | 'flight_icao'; ident: string }> = [
    { key: 'flight_iata', ident: `${AIRLABS_IATA_PREFIX[prefix] || prefix}${digits}` },
    { key: 'flight_icao', ident: `${AIRLABS_ICAO_PREFIX[prefix] || prefix}${digits}` },
    { key: 'flight_iata', ident: compact },
  ];

  return candidates.filter((candidate, index, list) =>
    list.findIndex((item) => item.key === candidate.key && item.ident === candidate.ident) === index
  );
}

function formatAeroApiErrorMessage(rawErrorMessage: unknown, flightIdent: string): string {
  const message = String(rawErrorMessage || '');
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('too far in the future') || lowerMessage.includes('limit: 2 days')) {
    return 'FlightAware solo permite consultar vuelos programados hasta 2 dias hacia adelante para esta busqueda.';
  }

  if (lowerMessage.includes('invalid argument')) {
    return `FlightAware no acepto ${flightIdent}.`;
  }

  return message || 'FlightAware no pudo completar la busqueda.';
}

function isAeroApiTooFarFutureError(rawError: unknown): boolean {
  const message = typeof rawError === 'string'
    ? rawError
    : JSON.stringify(rawError || {});
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes('invalid end bound') ||
    lowerMessage.includes('too far in the future') ||
    lowerMessage.includes('limit: 2 days')
  );
}

// Maps the AeroAPI response to our app's FindFlightOutput format
function mapApiResponseToFlightOutput(apiData: any, originalFlightNumber: string): FindFlightOutput {
  if (!apiData || !apiData.flights || apiData.flights.length === 0) {
    return { 
        flightFound: false, 
        flightNumber: originalFlightNumber, 
        errorMessage: `No flight found for this date. Please check if the flight operates on the selected day.` 
    };
  }

  // Prefer flights that involve La Paz (El Alto), but allow other routes too.
  const laPazFlight = apiData.flights.find((f: any) =>
    f.origin?.code_iata === 'LPB' ||
    f.destination?.code_iata === 'LPB'
  );
  
  const flight = laPazFlight || apiData.flights[0];

  const formatTimeWithTimezone = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      // AeroAPI returns ISO 8601 with UTC offset (e.g. "2026-04-23T13:10:00Z").
      // Convert to Bolivia local time (America/La_Paz = UTC-4, no DST).
      const utcDate = parseISO(dateStr);
      const localDate = toZonedTime(utcDate, 'America/La_Paz');
      return formatTime(localDate);
    } catch (e) {
      console.error(`Error formatting date: ${dateStr}`, e);
      return undefined;
    }
  };

  const formatDateWithTimezone = (dateStr: string | null | undefined): string | undefined => {
    if (!dateStr) return undefined;
    try {
      const utcDate = parseISO(dateStr);
      const localDate = toZonedTime(utcDate, 'America/La_Paz');
      const day = String(localDate.getDate()).padStart(2, '0');
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const year = localDate.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.error(`Error formatting date: ${dateStr}`, e);
      return undefined;
    }
  };

  return {
    flightFound: true,
    flightNumber: flight.ident_iata || normalizeIdent(flight.ident), // Prefer the user-facing IATA ident.
    departure: {
      airport: {
        code: flight.origin?.code_iata,
        name: flight.origin?.name,
        city: flight.origin?.city,
      },
      time: {
        scheduled: formatTimeWithTimezone(flight.scheduled_out)!,
        scheduledDate: formatDateWithTimezone(flight.scheduled_out),
      },
    },
    arrival: {
      airport: {
        code: flight.destination?.code_iata,
        name: flight.destination?.name,
        city: flight.destination?.city,
      },
      time: {
        scheduled: formatTimeWithTimezone(flight.scheduled_in)!,
        scheduledDate: formatDateWithTimezone(flight.scheduled_in),
      },
    },
    flightSegment: `${flight.origin?.code_iata}/${flight.destination?.code_iata}`,
    provider: 'aeroapi',
  };
}

function getFlightDigits(flightNumber: string): string {
  return flightNumber.replace(/\D/g, '');
}

interface AirLabsFlight {
  airline_iata?: string;
  airline_icao?: string;
  flight_iata?: string;
  flight_icao?: string;
  flight_number?: string;
  dep_iata?: string;
  dep_icao?: string;
  dep_time?: string;
  dep_estimated?: string;
  dep_actual?: string;
  arr_iata?: string;
  arr_icao?: string;
  arr_time?: string;
  arr_estimated?: string;
  arr_actual?: string;
  duration?: number;
  status?: string;
}

interface AirLabsResponse {
  response?: AirLabsFlight | AirLabsFlight[];
  error?: {
    code?: string;
    message?: string;
  };
}

interface NaabolItinerary {
  FECHA_HORA?: string;
  FECHA_HORA_FORMAT?: string;
  NRO_VUELO?: string;
  HORA_ESTIMADA?: string;
  HORA_REAL?: string;
  OBSERVACION?: string;
  NOMBRE_AEROLINEA?: string;
  RUTA0?: string;
  AEROPUERTO?: string;
  TIPO_OPERACION?: 'S' | 'L';
}

const NAABOL_AIRPORTS: Record<string, { aero: string; city: string; name: string }> = {
  LPB: { aero: 'El ALTo', city: 'La Paz', name: 'Aeropuerto Internacional El Alto' },
  VVI: { aero: 'Viru Viru', city: 'Santa Cruz', name: 'Aeropuerto Internacional Viru Viru' },
  CBB: { aero: 'Jorge Wilstermann', city: 'Cochabamba', name: 'Aeropuerto Internacional Jorge Wilstermann' },
  SRE: { aero: 'Sucre', city: 'Sucre', name: 'Aeropuerto Alcantari' },
  TJA: { aero: 'Tarija', city: 'Tarija', name: 'Aeropuerto Oriel Lea Plaza' },
  TDD: { aero: 'Trinidad', city: 'Trinidad', name: 'Aeropuerto Jorge Henrich Arauz' },
  UYU: { aero: 'Uyuni', city: 'Uyuni', name: 'Aeropuerto La Joya Andina' },
  ORU: { aero: 'Oruro', city: 'Oruro', name: 'Aeropuerto Juan Mendoza' },
  POI: { aero: 'Potosi', city: 'Potosi', name: 'Aeropuerto Nicolas Rojas' },
  CIJ: { aero: 'Cobija', city: 'Cobija', name: 'Aeropuerto Anibal Arab Fadul' },
  RIB: { aero: 'Riberalta', city: 'Riberalta', name: 'Aeropuerto Selin Zeitun Lopez' },
  RBQ: { aero: 'Rurrenabaque', city: 'Rurrenabaque', name: 'Aeropuerto de Rurrenabaque' },
  GYA: { aero: 'Guayamerin', city: 'Guayaramerin', name: 'Aeropuerto Ernesto Roca Barbadillo' },
  BYC: { aero: 'Yacuiba', city: 'Yacuiba', name: 'Aeropuerto de Yacuiba' },
};

const NAABOL_CITY_TO_IATA = Object.entries(NAABOL_AIRPORTS).reduce<Record<string, string>>((acc, [code, info]) => {
  acc[info.city.toUpperCase()] = code;
  return acc;
}, {
  CUZCO: 'CUZ',
  CUSCO: 'CUZ',
  LIMA: 'LIM',
  BOGOTA: 'BOG',
  BOGOTÁ: 'BOG',
  'SAO PAULO': 'GRU',
  'SÃO PAULO': 'GRU',
  'BUENOS AIRES': 'EZE',
});

function isBoliviaAirport(code?: string): boolean {
  return !!code && !!NAABOL_AIRPORTS[code.toUpperCase()];
}

function isBolivianCarrier(flightNumber: string): boolean {
  const normalized = flightNumber.replace(/\s/g, '').toUpperCase();
  return normalized.startsWith('OB') || normalized.startsWith('BO') || normalized.startsWith('BOV') || normalized.startsWith('ECO') || normalized.startsWith('8J') || normalized.startsWith('TAM');
}

function formatNaabolFlightNumber(inputFlightNumber: string, naabolFlightNumber?: string): string {
  const input = inputFlightNumber.replace(/\s/g, '').toUpperCase();
  const rawNaabol = (naabolFlightNumber || '').replace(/\s/g, '').toUpperCase();

  if (/^[A-Z]{2,4}\d+/.test(rawNaabol)) {
    return rawNaabol;
  }

  const naabolDigits = getFlightDigits(rawNaabol);
  const inputPrefix = input.match(/^[A-Z0-9]+?(?=\d)/)?.[0];
  const displayPrefix = inputPrefix ? IATA_TO_ICAO_AIRLINE_PREFIX[inputPrefix] || inputPrefix : undefined;
  if (inputPrefix && naabolDigits) {
    return `${displayPrefix}${naabolDigits}`;
  }

  return input || rawNaabol;
}

function isTodayInBolivia(date: string): boolean {
  const today = format(toZonedTime(new Date(), 'America/La_Paz'), 'yyyy-MM-dd');
  return date === today;
}

function formatDateForDisplay(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function shiftNaabolDateTime(date: string, time: string, minutes: number): { time: string; date: string } {
  try {
    const base = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    const shifted = addMinutes(base, minutes);
    return {
      time: format(shifted, 'HH:mm'),
      date: format(shifted, 'dd/MM/yyyy'),
    };
  } catch {
    return {
      time: '--:--',
      date: formatDateForDisplay(date),
    };
  }
}

function inferAirportCodeFromRoute(route?: string): string | undefined {
  if (!route) return undefined;
  const firstStop = route.split(' - ')[0]?.trim().toUpperCase();
  return NAABOL_CITY_TO_IATA[firstStop];
}

function getNaabolDisplayTime(flight?: NaabolItinerary): string {
  return flight?.HORA_REAL?.trim() || flight?.HORA_ESTIMADA?.trim() || '--:--';
}

function getNaabolRouteCity(flight?: NaabolItinerary, fallback?: string): string {
  return flight?.RUTA0?.split(' - ')[0]?.trim() || fallback || 'Ruta';
}

async function fetchNaabolItineraries(aero: string, tipo: 'S' | 'L'): Promise<NaabolItinerary[]> {
  const url = new URL('https://fids.naabol.gob.bo/Fids/itin/vuelos');
  url.searchParams.set('aero', aero);
  url.searchParams.set('tipo', tipo);

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`NAABOL request failed with status ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function mapNaabolFlightToOutput(
  flight: NaabolItinerary,
  input: FindFlightInput,
  airportCode: string,
  routeHint?: FlightRouteHint,
  routeDurationMinutes?: number
): FindFlightOutput {
  const tipo = flight.TIPO_OPERACION || 'S';
  const airport = NAABOL_AIRPORTS[airportCode];
  const routeCode = tipo === 'S'
    ? routeHint?.destination || inferAirportCodeFromRoute(flight.RUTA0)
    : routeHint?.origin || inferAirportCodeFromRoute(flight.RUTA0);
  const routeCity = getNaabolRouteCity(flight, routeCode);
  const scheduledDate = formatDateForDisplay(input.date);
  const displayTime = getNaabolDisplayTime(flight);
  const estimatedPair = routeDurationMinutes
    ? tipo === 'S'
      ? shiftNaabolDateTime(input.date, displayTime, routeDurationMinutes)
      : shiftNaabolDateTime(input.date, displayTime, -routeDurationMinutes)
    : { time: '--:--', date: scheduledDate };
  const displayFlightNumber = formatNaabolFlightNumber(input.flightNumber, flight.NRO_VUELO);

  const departure = tipo === 'S'
    ? {
        airport: { code: airportCode, name: airport.name, city: airport.city },
        time: { scheduled: displayTime, scheduledDate },
      }
    : {
        airport: { code: routeCode, city: routeCity },
        time: { scheduled: estimatedPair.time, scheduledDate: estimatedPair.date },
      };

  const arrival = tipo === 'S'
    ? {
        airport: { code: routeCode, city: routeCity },
        time: { scheduled: estimatedPair.time, scheduledDate: estimatedPair.date },
      }
    : {
        airport: { code: airportCode, name: airport.name, city: airport.city },
        time: { scheduled: displayTime, scheduledDate },
      };

  return {
    flightFound: true,
    flightNumber: displayFlightNumber,
    departure,
    arrival,
    flightSegment: `${departure.airport.code || '---'}/${arrival.airport.code || '---'}`,
    provider: 'naabol',
  };
}

function mapNaabolMergedFlightToOutput(
  params: {
    input: FindFlightInput;
    departureMatch?: { target: { code: string; tipo: 'S' | 'L' }; flight: NaabolItinerary };
    arrivalMatch?: { target: { code: string; tipo: 'S' | 'L' }; flight: NaabolItinerary };
    routeHint?: FlightRouteHint;
  }
): FindFlightOutput {
  const { input, departureMatch, arrivalMatch, routeHint } = params;

  if (!departureMatch && arrivalMatch) {
    return mapNaabolFlightToOutput(arrivalMatch.flight, input, arrivalMatch.target.code, routeHint, input.routeDurationMinutes);
  }

  if (departureMatch && !arrivalMatch) {
    return mapNaabolFlightToOutput(departureMatch.flight, input, departureMatch.target.code, routeHint, input.routeDurationMinutes);
  }

  if (!departureMatch || !arrivalMatch) {
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'naabol',
      errorMessage: `NAABOL no encontro ${input.flightNumber} en itinerarios del dia.`,
    };
  }

  const departureAirport = NAABOL_AIRPORTS[departureMatch.target.code];
  const arrivalAirport = NAABOL_AIRPORTS[arrivalMatch.target.code];
  const scheduledDate = formatDateForDisplay(input.date);
  const displayFlightNumber = formatNaabolFlightNumber(
    input.flightNumber,
    departureMatch.flight.NRO_VUELO || arrivalMatch.flight.NRO_VUELO
  );

  return {
    flightFound: true,
    flightNumber: displayFlightNumber,
    departure: {
      airport: {
        code: departureMatch.target.code,
        name: departureAirport.name,
        city: departureAirport.city,
      },
      time: {
        scheduled: getNaabolDisplayTime(departureMatch.flight),
        scheduledDate,
      },
    },
    arrival: {
      airport: {
        code: arrivalMatch.target.code,
        name: arrivalAirport.name,
        city: arrivalAirport.city,
      },
      time: {
        scheduled: getNaabolDisplayTime(arrivalMatch.flight),
        scheduledDate,
      },
    },
    flightSegment: `${departureMatch.target.code}/${arrivalMatch.target.code}`,
    provider: 'naabol',
  };
}

async function findFlightWithNaabol(input: FindFlightInput, routeHint?: FlightRouteHint): Promise<FindFlightOutput> {
  if (!isTodayInBolivia(input.date)) {
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'naabol',
      errorMessage: 'NAABOL solo publica itinerarios operativos del dia actual.',
    };
  }

  const flightDigits = getFlightDigits(input.flightNumber);
  if (!flightDigits) {
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'naabol',
      errorMessage: 'Numero de vuelo invalido para consultar NAABOL.',
    };
  }

  const targets: Array<{ code: string; tipo: 'S' | 'L' }> = [];
  if (routeHint?.origin && isBoliviaAirport(routeHint.origin)) {
    targets.push({ code: routeHint.origin.toUpperCase(), tipo: 'S' });
  }
  if (routeHint?.destination && isBoliviaAirport(routeHint.destination)) {
    targets.push({ code: routeHint.destination.toUpperCase(), tipo: 'L' });
  }

  if (targets.length === 0) {
    for (const code of Object.keys(NAABOL_AIRPORTS)) {
      targets.push({ code, tipo: 'S' }, { code, tipo: 'L' });
    }
  }

  if (targets.length === 0) {
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'naabol',
      errorMessage: 'NAABOL se omitio porque no hay ruta boliviana conocida para este vuelo.',
    };
  }

  const seen = new Set<string>();
  const uniqueTargets = targets.filter((target) => {
    const key = `${target.code}-${target.tipo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  try {
    const settledBatches = await Promise.allSettled(uniqueTargets.map(async (target) => ({
      target,
      flights: await fetchNaabolItineraries(NAABOL_AIRPORTS[target.code].aero, target.tipo),
    })));
    const batches = settledBatches
      .filter((batch): batch is PromiseFulfilledResult<{ target: { code: string; tipo: 'S' | 'L' }; flights: NaabolItinerary[] }> => batch.status === 'fulfilled')
      .map((batch) => batch.value);

    if (batches.length === 0) {
      throw new Error('No NAABOL airport endpoint responded.');
    }

    const matches = batches.flatMap((batch) =>
      batch.flights
        .filter((flight) => getFlightDigits(flight.NRO_VUELO || '') === flightDigits)
        .map((flight) => ({ target: batch.target, flight }))
    );

    const departureMatch = matches.find((match) =>
      match.target.tipo === 'S' &&
      (!routeHint?.origin || match.target.code === routeHint.origin.toUpperCase())
    ) || matches.find((match) => match.target.tipo === 'S');

    const arrivalMatch = matches.find((match) =>
      match.target.tipo === 'L' &&
      (!routeHint?.destination || match.target.code === routeHint.destination.toUpperCase())
    ) || matches.find((match) => match.target.tipo === 'L');

    if (departureMatch || arrivalMatch) {
      return mapNaabolMergedFlightToOutput({
        input,
        departureMatch,
        arrivalMatch,
        routeHint,
      });
    }

    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'naabol',
      errorMessage: `NAABOL no encontro ${input.flightNumber} en itinerarios del dia.`,
    };
  } catch (error) {
    console.error('[NAABOL] Search failed:', error);
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'naabol',
      errorMessage: 'NAABOL no respondio para consultar itinerarios del dia.',
    };
  }
}

function formatAirLabsDateTime(value?: string): { time: string; date?: string } {
  if (!value) return { time: '--:--' };
  const [datePart, timePart] = value.split(' ');
  return {
    time: timePart?.slice(0, 5) || '--:--',
    date: datePart ? formatDateForDisplay(datePart) : undefined,
  };
}

function getAirLabsComparableDate(flight: AirLabsFlight): string | undefined {
  return (flight.dep_time || flight.arr_time || flight.dep_estimated || flight.arr_estimated)?.slice(0, 10);
}

function flightTouchesAirport(
  flight: { dep_iata?: string; arr_iata?: string },
  airportCode: string
): boolean {
  const code = airportCode.toUpperCase();
  return flight.dep_iata?.toUpperCase() === code || flight.arr_iata?.toUpperCase() === code;
}

function mapAirLabsFlightToOutput(flight: AirLabsFlight, input: FindFlightInput): FindFlightOutput {
  const departure = formatAirLabsDateTime(flight.dep_estimated || flight.dep_actual || flight.dep_time);
  const arrival = formatAirLabsDateTime(flight.arr_estimated || flight.arr_actual || flight.arr_time);

  return {
    flightFound: true,
    flightNumber: flight.flight_iata || flight.flight_icao || input.flightNumber,
    departure: {
      airport: {
        code: flight.dep_iata,
      },
      time: {
        scheduled: departure.time,
        scheduledDate: departure.date || formatDateForDisplay(input.date),
      },
    },
    arrival: {
      airport: {
        code: flight.arr_iata,
      },
      time: {
        scheduled: arrival.time,
        scheduledDate: arrival.date || formatDateForDisplay(input.date),
      },
    },
    flightSegment: `${flight.dep_iata || '---'}/${flight.arr_iata || '---'}`,
    provider: 'airlabs',
  };
}

async function fetchAirLabs(key: 'flight_iata' | 'flight_icao', ident: string): Promise<AirLabsResponse> {
  const apiKey = process.env.AIRLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Falta AIRLABS_API_KEY.');
  }

  const url = new URL('https://airlabs.co/api/v9/flight');
  url.searchParams.set(key, ident);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('_fields', 'airline_iata,airline_icao,flight_iata,flight_icao,flight_number,dep_iata,dep_time,dep_estimated,dep_actual,arr_iata,arr_time,arr_estimated,arr_actual,duration,status');

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  const payload = await response.json() as AirLabsResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `AirLabs request failed with status ${response.status}.`);
  }

  return payload;
}

async function findFlightWithAirLabs(input: FindFlightInput): Promise<FindFlightOutput> {
  const candidate = getAirLabsIdentCandidates(input.flightNumber)[0];

  try {
    const payload = await fetchAirLabs(candidate.key, candidate.ident);
    const flights = Array.isArray(payload.response)
      ? payload.response
      : payload.response
        ? [payload.response]
        : [];
    const datedFlights = flights.filter((flight) => getAirLabsComparableDate(flight) === input.date);
    const match = datedFlights.find((flight) => flightTouchesAirport(flight, 'LPB')) || datedFlights[0];

    if (match?.dep_iata && match?.arr_iata) {
      return mapAirLabsFlightToOutput(match, input);
    }

    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'airlabs',
      errorMessage: `AirLabs no encontro ${input.flightNumber} para ${input.date}. AirLabs Flight devuelve el vuelo mas cercano y Schedules solo cubre hasta 10 horas hacia adelante.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      provider: 'airlabs',
      errorMessage: message.includes('AIRLABS_API_KEY') ? message : `AirLabs no pudo consultar ${input.flightNumber}: ${message}`,
    };
  }
}

/**
 * Finds a flight by calling the AeroAPI.
 */
export async function findFlight(input: FindFlightInput): Promise<FindFlightOutput> {
  try {
    if (input.provider === 'airlabs') {
      return findFlightWithAirLabs(input);
    }


    if (input.provider === 'naabol') {
      return findFlightWithNaabol(input, input.routeHint);
    }

    const apiKey = getApiKey(); // First, check for API key.
    
    // Step 1: Normalize the flight number. Some operators, like LATAM, may need fallback idents.
    const flightIdent = normalizeIdent(input.flightNumber);
    
    // Step 2: Prepare date range for the API query according to docs
    // The API expects a range. For a single day, we use the day itself as start
    // and the next day as the end (since 'end' is exclusive).
    const targetDate = parseISO(input.date);
    const startDate = formatISO(targetDate);
    const endDate = formatISO(addDays(targetDate, 1));


    // Step 3: Call the API endpoint with date filters
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${flightIdent}?start=${startDate}&end=${endDate}&max_pages=1`;
    
    // --- SERVER-SIDE LOGGING ---
    console.log(`[SERVER] Requesting URL: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'x-apikey': apiKey },
      cache: 'no-store' // Avoid caching flight data
    });

    const responseBody = await response.json();
    
    // --- SERVER-SIDE LOGGING ---
    console.log('[SERVER] Raw API Response:', JSON.stringify(responseBody, null, 2));

    if (!response.ok) {
        // If the API itself returns an error (like 429 Too Many Requests), handle it here.
        if (response.status === 429) {
            return {
                flightFound: false,
                flightNumber: input.flightNumber,
                errorMessage: "El límite de la API de FlightAware ha sido excedido. Por favor, inténtalo de nuevo más tarde."
            };
        }
        const rawErrorMessage = responseBody.detail || responseBody.title || `API request failed with status ${response.status}.`;
        if (isAeroApiTooFarFutureError(responseBody) || isAeroApiTooFarFutureError(rawErrorMessage)) {
          return {
            flightFound: false,
            flightNumber: input.flightNumber,
            provider: 'aeroapi',
            errorMessage: formatAeroApiErrorMessage(rawErrorMessage, flightIdent),
            errorCode: FLIGHTAWARE_TOO_FAR_FUTURE_ERROR,
          };
        }
        const remainingCandidates = getIdentCandidates(input.flightNumber).filter((candidate) => candidate !== flightIdent);
        for (const fallbackIdent of remainingCandidates) {
          const fallbackUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${fallbackIdent}?start=${startDate}&end=${endDate}&max_pages=1`;
          console.log(`[SERVER] Retrying URL: ${fallbackUrl}`);
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: { 'x-apikey': apiKey },
            cache: 'no-store',
          });
          const fallbackBody = await fallbackResponse.json();
          console.log('[SERVER] Raw fallback API Response:', JSON.stringify(fallbackBody, null, 2));
          if (fallbackResponse.ok) {
            const fallbackResult = mapApiResponseToFlightOutput(fallbackBody, input.flightNumber);
            if (fallbackResult.flightFound) {
              return fallbackResult;
            }
          }
        }
        const errorMessage = String(rawErrorMessage).toLowerCase().includes('invalid argument')
          ? `FlightAware no aceptó el identificador ${input.flightNumber}. Se intentó consultar como ${flightIdent}.`
          : rawErrorMessage;
        return { flightFound: false, flightNumber: input.flightNumber, errorMessage: formatAeroApiErrorMessage(rawErrorMessage, flightIdent) };
    }
    
    // Step 4: Map the API response to our output format
    const result = mapApiResponseToFlightOutput(responseBody, input.flightNumber);
    
    return result;

  } catch (e: any) {
    console.error("[FATAL] An unhandled error occurred in the findFlight flow:", e);
    return {
      flightFound: false,
      flightNumber: input.flightNumber,
      errorMessage: e.message || 'An unknown error occurred during the flight search.',
    };
  }
}
