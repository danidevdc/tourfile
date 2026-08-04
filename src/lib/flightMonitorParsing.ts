import type { NaabolMonitorFlight } from "@/ai/flows/flight-monitor-flow";

export type OperationType = "S" | "L";
export type RowLiveState = "pending" | "live-match" | "live-mismatch";

export const MISMATCH_THRESHOLD_MINUTES = 10;

const FLIGHT_PREFIX_ALIASES: Record<string, string> = {
  AVA: "AV",
  AV: "AV",
  BO: "OB",
  BOV: "OB",
  OB: "OB",
  LA: "LA",
  LAN: "LA",
  "8J": "8J",
  ECO: "ECO",
};
const FLIGHT_PREFIX_PATTERN = "AVA|BOV|LAN|ECO|AV|BO|OB|LA|8J";

// Nombres de aerolinea tal como los devuelve NAABOL (NOMBRE_AEROLINEA), mapeados
// al prefijo que usamos internamente. Se completa solo con aerolineas confirmadas
// en respuestas reales de la API; una aerolinea sin entrada simplemente no
// participa del desempate (fallback seguro al primer candidato).
export const AIRLINE_NAME_TO_PREFIX: Record<string, string> = {
  "BOLIVIANA DE AVIACION": "OB",
};

export function normalizeDate(value?: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${day}/${month}/20${year}`;
  }
  return null;
}

export function normalizeFlightNumber(value?: string): string {
  return (value || "").replace(/\s/g, "").toUpperCase();
}

function normalizeFlightPrefix(prefix?: string): string {
  if (!prefix) return "";
  return FLIGHT_PREFIX_ALIASES[prefix] || prefix;
}

export interface ExtractedFlights {
  flights: string[];
  dominantPrefix?: string;
}

export function extractFlightNumbers(flightValue?: string, observations?: string): ExtractedFlights {
  const primarySource = (flightValue || "").toUpperCase();
  const fallbackSource = flightValue?.trim()
    ? ""
    : (observations || "").toUpperCase();
  const flights: string[] = [];
  let lastPrefix = "";

  const appendMatches = (source: string, allowBareFlight: boolean) => {
    if (!source.trim()) return;
    const matcher = new RegExp(`(?:${FLIGHT_PREFIX_PATTERN})?\\s*\\d{1,4}`, "g");
    const matches = source.match(matcher) || [];

    matches.forEach((match) => {
      const compact = match.replace(/\s/g, "");
      const prefix = compact.match(new RegExp(`^(${FLIGHT_PREFIX_PATTERN})`))?.[0];
      const normalizedPrefix = normalizeFlightPrefix(prefix);
      const digits = compact.replace(/\D/g, "");
      if (normalizedPrefix) lastPrefix = normalizedPrefix;
      if (!digits || (!normalizedPrefix && !lastPrefix && !allowBareFlight)) return;
      flights.push(`${normalizedPrefix || lastPrefix}${digits}`);
    });
  };

  appendMatches(primarySource, true);
  appendMatches(fallbackSource, false);

  return { flights: Array.from(new Set(flights)), dominantPrefix: lastPrefix || undefined };
}

export function getFlightDigits(value?: string): string {
  return normalizeFlightNumber(value).replace(/\D/g, "");
}

export function timeToMinutes(value?: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function extractFlightTimeFromObservations(observations?: string): string | null {
  if (!observations) return null;
  const normalized = observations.toUpperCase();
  const keywordMatch = normalized.match(/\b(?:SALE|SALIDA|DEP|DEPARTURE|LLEGA|LLEGADA|ARR|ARRIVAL)\b[^\d]*(\d{1,2})[:H.](\d{2})/);
  const genericMatch = normalized.match(/\b(\d{1,2})[:H.](\d{2})\b/);
  const match = keywordMatch || genericMatch;
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDelta(minutes: number | null): string {
  if (minutes === null) return "-";
  if (minutes === 0) return "0 min";
  const sign = minutes > 0 ? "+" : "";
  return `${sign}${minutes} min`;
}

function formatMinutesText(minutes: number): string {
  const absolute = Math.abs(minutes);
  return `${absolute} min`;
}

export function getOperationLabel(operation?: OperationType): string {
  if (operation === "S") return "Salida";
  if (operation === "L") return "Llegada";
  return "Sin tipo";
}

export function getTimingDifferenceMessage(operation: OperationType | undefined, deltaMinutes: number): string {
  const action = operation === "S" ? "saldrá" : "llegará";
  const reference = operation === "S" ? "salida" : "llegada";
  if (deltaMinutes > 0) {
    return `El vuelo ${action} ${formatMinutesText(deltaMinutes)} antes de lo previsto en la orden`;
  }
  return `El vuelo ${action} con un retraso de ${formatMinutesText(deltaMinutes)} respecto a la ${reference} de la orden`;
}

const KNOWN_AIRPORTS: Record<string, string> = {
  LPB: "LPB", "EL ALTO": "LPB", "LA PAZ": "LPB",
  VVI: "VVI", "VIRU VIRU": "VVI", "SANTA CRUZ": "VVI", SRZ: "VVI",
  CBB: "CBB", COCHABAMBA: "CBB",
  SRE: "SRE", SUCRE: "SRE",
  TJA: "TJA", TARIJA: "TJA",
  TDD: "TDD", TRINIDAD: "TDD",
  UYU: "UYU", UYUNI: "UYU",
  ORU: "ORU", ORURO: "ORU",
  POI: "POI", POTOSI: "POI",
  CIJ: "CIJ", COBIJA: "CIJ",
  RIB: "RIB", RIBERALTA: "RIB",
  RBQ: "RBQ", RURRENABAQUE: "RBQ",
  GYA: "GYA", GUAYARAMERIN: "GYA",
  BYC: "BYC", YACUIBA: "BYC",
  MIA: "MIA", MIAMI: "MIA",
  SCL: "SCL", SANTIAGO: "SCL",
  LIM: "LIM", LIMA: "LIM",
  EZE: "EZE", "BUENOS AIRES": "EZE",
  GRU: "GRU", "SAO PAULO": "GRU",
  MAD: "MAD", MADRID: "MAD",
};

function findKnownAirport(text: string): string | undefined {
  const normalized = text.toUpperCase();
  for (const [keyword, code] of Object.entries(KNOWN_AIRPORTS)) {
    if (normalized.includes(keyword)) return code;
  }
  return undefined;
}

export function getOrderRoute(row: { serviceName: string; observations: string; expectedOperation?: OperationType }): string | null {
  const text = `${row.serviceName} ${row.observations}`.toUpperCase();

  // Formato real de las ordenes: "VUELO LLEGA 10:00 UYU/LPB" u "OB123 LPB-VVI"
  const pairMatch = text.match(/\b([A-Z]{3})\s*[\/-]\s*([A-Z]{3})\b/);
  if (pairMatch) return `${pairMatch[1]} -> ${pairMatch[2]}`;

  const otherAirport = findKnownAirport(row.observations) || findKnownAirport(row.serviceName);
  if (!otherAirport || otherAirport === "LPB") return null;

  if (row.expectedOperation === "L") return `${otherAirport} -> LPB`;
  if (row.expectedOperation === "S") return `LPB -> ${otherAirport}`;
  return `LPB / ${otherAirport}`;
}

export function getDriverDisplay(driver: string, bus: string): string {
  const cleanBus = bus?.replace(/\bBUS\b/gi, "").replace(/\s+/g, " ").trim();
  const cleanDriver = driver?.replace(/\bCONT\b/gi, "").replace(/\s+/g, " ").trim();
  if (cleanBus && cleanBus !== "-" && cleanBus.toUpperCase() !== "SIN BUS") {
    return `${cleanBus} ${cleanDriver}`.trim();
  }
  return cleanDriver || driver;
}

export function getExpectedOperation(serviceName: string, observations: string): OperationType | undefined {
  const service = serviceName.toUpperCase();
  const obs = observations.toUpperCase();
  if (service.includes("OUT") || obs.includes("SALE")) return "S";
  if (service.includes("IN") || obs.includes("LLEGA")) return "L";
  return undefined;
}

export function findServiceIssues(serviceName: string, observations: string): string[] {
  const service = serviceName.toUpperCase();
  const obs = observations.toUpperCase();
  const issues: string[] = [];

  if (service.includes("OUT") && obs.includes("LLEGA")) {
    issues.push("TRF OUT con texto de llegada");
  }
  if (service.includes("IN") && obs.includes("SALE")) {
    issues.push("TRF IN con texto de salida");
  }

  return issues;
}

export function matchNaabolFlight(
  row: { flightDigitsList: string[]; expectedOperation?: OperationType; expectedPrefix?: string },
  naabolFlights: NaabolMonitorFlight[]
): NaabolMonitorFlight | undefined {
  const candidates = naabolFlights.filter((flight) => row.flightDigitsList.includes(flight.flightDigits));
  const prioritized = candidates.filter((flight) => flight.airportCode === "LPB" || (flight.route || "").toUpperCase().includes("LPB"));
  const byOperation = row.expectedOperation
    ? prioritized.filter((flight) => flight.operation === row.expectedOperation)
    : prioritized;
  if (byOperation.length <= 1) return byOperation[0] || prioritized[0];

  // Desempate por aerolinea cuando hay mas de un candidato con mismos digitos+operacion
  if (row.expectedPrefix) {
    const airlineMatch = byOperation.find((flight) => AIRLINE_NAME_TO_PREFIX[flight.airline || ""] === row.expectedPrefix);
    if (airlineMatch) return airlineMatch;
  }
  return byOperation[0];
}

export function getRowLiveState(row: { naabol?: NaabolMonitorFlight; deltaMinutes: number | null }): RowLiveState {
  if (!row.naabol) return "pending";
  if (row.deltaMinutes === null) return "live-match";
  if (Math.abs(row.deltaMinutes) >= MISMATCH_THRESHOLD_MINUTES) return "live-mismatch";
  return "live-match";
}
