'use server';

type OperationType = 'S' | 'L';

interface NaabolItinerary {
  NRO_VUELO?: string;
  HORA_ESTIMADA?: string;
  HORA_REAL?: string;
  OBSERVACION?: string;
  OBSERVACION_INGLES?: string;
  RUTA0?: string;
  AEROPUERTO?: string;
  TIPO_OPERACION?: OperationType;
}

export interface NaabolMonitorFlight {
  airportCode: string;
  operation: OperationType;
  flightDigits: string;
  estimatedTime?: string;
  realTime?: string;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  route?: string;
}

export interface NaabolMonitorSnapshot {
  flights: NaabolMonitorFlight[];
  serverNowIso: string;
  timeSource: 'naabol-header' | 'server';
}

const NAABOL_AIRPORTS: Record<string, { aero: string; city: string }> = {
  LPB: { aero: 'El ALTo', city: 'La Paz' },
  VVI: { aero: 'Viru Viru', city: 'Santa Cruz' },
  CBB: { aero: 'Jorge Wilstermann', city: 'Cochabamba' },
  SRE: { aero: 'Sucre', city: 'Sucre' },
  TJA: { aero: 'Tarija', city: 'Tarija' },
  TDD: { aero: 'Trinidad', city: 'Trinidad' },
  UYU: { aero: 'Uyuni', city: 'Uyuni' },
  ORU: { aero: 'Oruro', city: 'Oruro' },
  POI: { aero: 'Potosi', city: 'Potosi' },
  CIJ: { aero: 'Cobija', city: 'Cobija' },
  RIB: { aero: 'Riberalta', city: 'Riberalta' },
  RBQ: { aero: 'Rurrenabaque', city: 'Rurrenabaque' },
  GYA: { aero: 'Guayamerin', city: 'Guayaramerin' },
  BYC: { aero: 'Yacuiba', city: 'Yacuiba' },
};

function normalizeStatusTone(label?: string): NaabolMonitorFlight['statusTone'] {
  const normalized = (label || '').toUpperCase();
  if (normalized.includes('CANCEL')) return 'danger';
  if (normalized.includes('DELAY') || normalized.includes('DEMOR') || normalized.includes('RETRAS')) return 'danger';
  if (normalized.includes('TIERRA') || normalized.includes('ARRIVED') || normalized.includes('LANDED')) return 'info';
  if (normalized.includes('PRE-EMBARQUE') || normalized.includes('BOARD')) return 'info';
  if (normalized.includes('CONFIRM') || normalized.includes('HORARIO') || normalized.includes('TIME')) return 'success';
  return 'neutral';
}

async function fetchNaabolItineraries(aero: string, tipo: OperationType): Promise<{ flights: NaabolItinerary[]; responseDate?: string }> {
  const url = new URL('https://fids.naabol.gob.bo/Fids/itin/vuelos');
  url.searchParams.set('aero', aero);
  url.searchParams.set('tipo', tipo);

  const response = await fetch(url.toString(), {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`NAABOL ${aero} ${tipo} respondio ${response.status}.`);
  }

  const data = await response.json();
  return {
    flights: Array.isArray(data) ? data : [],
    responseDate: response.headers.get('date') || undefined,
  };
}

export async function getNaabolDailyMonitorSnapshot(): Promise<NaabolMonitorSnapshot> {
  const entries = await Promise.allSettled(
    Object.entries(NAABOL_AIRPORTS).flatMap(([airportCode, airport]) =>
      (['S', 'L'] as const).map(async (operation) => ({
        airportCode,
        operation,
        result: await fetchNaabolItineraries(airport.aero, operation),
      }))
    )
  );

  const firstResponseDate = entries.find((entry) => entry.status === 'fulfilled' && entry.value.result.responseDate);
  const serverNowIso = firstResponseDate?.status === 'fulfilled' && firstResponseDate.value.result.responseDate
    ? new Date(firstResponseDate.value.result.responseDate).toISOString()
    : new Date().toISOString();

  const flights = entries.flatMap((entry) => {
    if (entry.status !== 'fulfilled') return [];

    return entry.value.result.flights.map((flight) => {
      const statusLabel = flight.OBSERVACION?.trim().toUpperCase() || 'EN HORARIO';
      return {
        airportCode: entry.value.airportCode,
        operation: entry.value.operation,
        flightDigits: (flight.NRO_VUELO || '').replace(/\D/g, ''),
        estimatedTime: flight.HORA_ESTIMADA?.trim() || undefined,
        realTime: flight.HORA_REAL?.trim() || undefined,
        statusLabel,
        statusTone: normalizeStatusTone(statusLabel),
        route: flight.RUTA0?.trim() || undefined,
      };
    }).filter((flight) => flight.flightDigits);
  });

  return {
    flights,
    serverNowIso,
    timeSource: firstResponseDate ? 'naabol-header' : 'server',
  };
}

export async function getNaabolDailyMonitorFlights(): Promise<NaabolMonitorFlight[]> {
  const snapshot = await getNaabolDailyMonitorSnapshot();
  return snapshot.flights;
}
