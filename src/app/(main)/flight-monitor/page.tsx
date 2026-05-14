"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, Car, CheckCircle2, Loader2, Plane, RefreshCw, User, XCircle } from "lucide-react";

import { getNaabolDailyMonitorSnapshot, type NaabolMonitorFlight } from "@/ai/flows/flight-monitor-flow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, type AppModule } from "@/hooks/useAuth";
import { getRecentServiceOrders, type StoredServiceOrder } from "@/lib/serviceOrderStorage";

type MonitorTone = "success" | "warning" | "danger" | "info" | "neutral";
type OperationType = "S" | "L";

const MONITOR_CACHE_KEY = "tourfile_flight_monitor_cache_v10_team";
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

interface FlightMonitorRow {
  id: string;
  orderId: string;
  orderName: string;
  file: string;
  ref: string;
  serviceDate: string;
  serviceTime: string;
  serviceName: string;
  flightNumber: string;
  flightDigits: string;
  guide: string;
  driver: string;
  bus: string;
  observations: string;
  expectedOperation?: OperationType;
  naabol?: NaabolMonitorFlight;
  naabolTime: string;
  naabolTimeSource: "real" | "estimada" | "sin dato";
  effectiveMinutes: number | null;
  deltaMinutes: number | null;
  issues: string[];
}

interface MonitorCachePayload {
  cachedAt: number;
  serviceDate: string;
  orders: StoredServiceOrder[];
  naabolFlights: NaabolMonitorFlight[];
  serverNowIso: string;
  timeSource: "naabol-header" | "server";
}

function normalizeDate(value?: string): string | null {
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

function getLaPazParts(date = new Date()): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/La_Paz",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
}

function getLaPazToday(date = new Date()): string {
  const parts = getLaPazParts(date);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

function getLaPazDateLabel(date = new Date()): string {
  const parts = getLaPazParts(date);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

function getLaPazTimeLabel(date = new Date()): string {
  const parts = getLaPazParts(date);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

function getLaPazMinutes(date = new Date()): number {
  const parts = getLaPazParts(date);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function getNetworkOffsetFromSnapshot(serverNowIso: string, snapshotLocalMs: number): number {
  return new Date(serverNowIso).getTime() - snapshotLocalMs;
}

function normalizeFlightNumber(value?: string): string {
  return (value || "").replace(/\s/g, "").toUpperCase();
}

function normalizeFlightPrefix(prefix?: string): string {
  if (!prefix) return "";
  return FLIGHT_PREFIX_ALIASES[prefix] || prefix;
}

function extractFlightNumbers(flightValue?: string, observations?: string): string[] {
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

  return Array.from(new Set(flights));
}

function getFlightDigits(value?: string): string {
  return normalizeFlightNumber(value).replace(/\D/g, "");
}

function timeToMinutes(value?: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function extractFlightTimeFromObservations(observations?: string): string | null {
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

function formatDelta(minutes: number | null): string {
  if (minutes === null) return "-";
  if (minutes === 0) return "0 min";
  const sign = minutes > 0 ? "+" : "";
  return `${sign}${minutes} min`;
}

function formatMinutesText(minutes: number): string {
  const absolute = Math.abs(minutes);
  return `${absolute} min`;
}

function getOperationLabel(operation?: OperationType): string {
  if (operation === "S") return "Salida";
  if (operation === "L") return "Llegada";
  return "Sin tipo";
}

function getTimingDifferenceMessage(operation: OperationType | undefined, deltaMinutes: number): string {
  const action = operation === "S" ? "saldrá" : "llegará";
  const reference = operation === "S" ? "salida" : "llegada";
  if (deltaMinutes > 0) {
    return `El vuelo ${action} ${formatMinutesText(deltaMinutes)} antes de lo previsto en la orden`;
  }
  return `El vuelo ${action} con un retraso de ${formatMinutesText(deltaMinutes)} respecto a la ${reference} de la orden`;
}

function getDisplayRoute(row: { expectedOperation?: OperationType; naabol?: NaabolMonitorFlight }): string {
  const otherPoint = row.naabol?.route || row.naabol?.airportCode || "-";
  if (row.expectedOperation === "L") return `${otherPoint} -> LPB`;
  if (row.expectedOperation === "S") return `LPB -> ${otherPoint}`;
  return row.naabol ? `LPB / ${otherPoint}` : "Sin cruce";
}

function getDriverDisplay(driver: string, bus: string): string {
  const cleanBus = bus?.replace(/\bBUS\b/gi, "").replace(/\s+/g, " ").trim();
  const cleanDriver = driver?.replace(/\bCONT\b/gi, "").replace(/\s+/g, " ").trim();
  if (cleanBus && cleanBus !== "-" && cleanBus.toUpperCase() !== "SIN BUS") {
    return `${cleanBus} ${cleanDriver}`.trim();
  }
  return cleanDriver || driver;
}

function getExpectedOperation(serviceName: string, observations: string): OperationType | undefined {
  const service = serviceName.toUpperCase();
  const obs = observations.toUpperCase();
  if (service.includes("OUT") || obs.includes("SALE")) return "S";
  if (service.includes("IN") || obs.includes("LLEGA")) return "L";
  return undefined;
}

function findServiceIssues(serviceName: string, observations: string): string[] {
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

function matchNaabolFlight(
  row: { flightDigitsList: string[]; expectedOperation?: OperationType },
  naabolFlights: NaabolMonitorFlight[]
): NaabolMonitorFlight | undefined {
  const candidates = naabolFlights.filter((flight) => row.flightDigitsList.includes(flight.flightDigits));
  const prioritized = candidates.filter((flight) => flight.airportCode === "LPB" || (flight.route || "").toUpperCase().includes("LPB"));
  if (row.expectedOperation) {
    return prioritized.find((flight) => flight.operation === row.expectedOperation) || prioritized[0];
  }
  return prioritized[0];
}

function statusBadgeClass(tone: MonitorTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "danger":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "info":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function SplitFlapText({ text }: { text: string }) {
  return (
    <span className="fm-split">
      {text.split("").map((char, index) => (
        <span key={`${char}-${index}`} className="fm-split-char" style={{ animationDelay: `${index * 28}ms` }}>
          {char}
        </span>
      ))}
    </span>
  );
}

function readMonitorCache(today: string): MonitorCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MONITOR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MonitorCachePayload;
    if (!parsed.cachedAt || parsed.serviceDate !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMonitorCache(
  orders: StoredServiceOrder[],
  naabolFlights: NaabolMonitorFlight[],
  today: string,
  serverNowIso: string,
  timeSource: "naabol-header" | "server"
) {
  if (typeof window === "undefined") return;
  const payload: MonitorCachePayload = {
    cachedAt: Date.now(),
    serviceDate: today,
    orders,
    naabolFlights,
    serverNowIso,
    timeSource,
  };
  sessionStorage.setItem(MONITOR_CACHE_KEY, JSON.stringify(payload));
}

function buildRows(
  orders: StoredServiceOrder[],
  naabolFlights: NaabolMonitorFlight[],
  today: string,
  now: Date,
  hidePast = true
): FlightMonitorRow[] {
  const rows: FlightMonitorRow[] = [];
  const nowMinutes = getLaPazMinutes(now);

  orders
    .filter((order) => order.status !== "eliminado" && order.status !== "cancelado")
    .forEach((order) => {
      (order.data.services || []).forEach((service, index) => {
        const serviceDate = normalizeDate(service.fecha);
        const flightNumbers = extractFlightNumbers(service.vuelo, service.observaciones);
        const flightDigitsList = flightNumbers.map(getFlightDigits).filter(Boolean);

        if (!serviceDate || serviceDate !== today || flightDigitsList.length === 0) return;

        const observations = service.observaciones || "";
        const serviceName = service.servicio || "";
        const expectedOperation = getExpectedOperation(serviceName, observations);
        const naabol = matchNaabolFlight({ flightDigitsList, expectedOperation }, naabolFlights);
        const issues = findServiceIssues(serviceName, observations);
        const naabolTime = naabol?.realTime || naabol?.estimatedTime || "--:--";
        const naabolTimeSource = naabol?.realTime ? "real" : naabol?.estimatedTime ? "estimada" : "sin dato";
        const displayFlightNumber = naabol
          ? flightNumbers.find((flight) => getFlightDigits(flight) === naabol.flightDigits) || flightNumbers[0]
          : flightNumbers.join(" / ");
        const serviceFlightTime = extractFlightTimeFromObservations(observations) || service.hora || "--:--";
        const serviceMinutes = timeToMinutes(serviceFlightTime);
        const naabolMinutes = timeToMinutes(naabolTime);
        const effectiveMinutes = naabolMinutes ?? serviceMinutes;
        const deltaMinutes = serviceMinutes !== null && naabolMinutes !== null ? serviceMinutes - naabolMinutes : null;

        if (hidePast && effectiveMinutes !== null && effectiveMinutes < nowMinutes) return;

        if (!naabol) {
          issues.push("No encontrado en tablero");
        } else if (deltaMinutes !== null && deltaMinutes !== 0) {
          issues.push(getTimingDifferenceMessage(expectedOperation, deltaMinutes));
        }

        rows.push({
          id: `${order.id}-${index}`,
          orderId: order.id,
          orderName: order.orderName,
          file: order.data.file || "-",
          ref: order.data.ref || "-",
          serviceDate,
          serviceTime: serviceFlightTime,
          serviceName,
          flightNumber: displayFlightNumber,
          flightDigits: naabol?.flightDigits || flightDigitsList[0],
          guide: service.guia || order.data.guia || "-",
          driver: service.chofer || order.data.responsible?.chofer || "-",
          bus: service.bus || "-",
          observations,
          expectedOperation,
          naabol,
          naabolTime,
          naabolTimeSource,
          effectiveMinutes,
          deltaMinutes,
          issues,
        });
      });
    });

  return rows.sort((a, b) => {
    const aMinutes = a.effectiveMinutes ?? timeToMinutes(a.serviceTime) ?? 0;
    const bMinutes = b.effectiveMinutes ?? timeToMinutes(b.serviceTime) ?? 0;
    return aMinutes - bMinutes;
  });
}

export default function FlightMonitorPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated, currentUser } = useAuth();
  const [orders, setOrders] = useState<StoredServiceOrder[]>([]);
  const [naabolFlights, setNaabolFlights] = useState<NaabolMonitorFlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [timeSource, setTimeSource] = useState<"naabol-header" | "server">("server");
  const [networkOffsetMs, setNetworkOffsetMs] = useState(0);
  const [now, setNow] = useState(new Date(Date.now() + networkOffsetMs));

  const today = getLaPazToday(now);
  const hasModule = (mod: AppModule): boolean => {
    if (!isAuthenticated) return false;
    if (isCurrentUserAdmin) return true;
    return (currentUser?.profile?.modules || []).includes(mod);
  };

  const canOpen = hasModule("ordenes") || hasModule("vuelos");

  const loadData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!forceRefresh) {
        const cached = readMonitorCache(today);
        if (cached) {
          const offsetMs = getNetworkOffsetFromSnapshot(cached.serverNowIso || new Date(cached.cachedAt).toISOString(), cached.cachedAt);
          setOrders(cached.orders);
          setNaabolFlights(cached.naabolFlights);
          setLastRefresh(new Date(cached.cachedAt));
          setTimeSource(cached.timeSource || "server");
          setNetworkOffsetMs(offsetMs);
          setNow(new Date(Date.now() + offsetMs));
          setIsUsingCache(true);
          return;
        }
      }

      const [ordersData, naabolSnapshot] = await Promise.all([
        getRecentServiceOrders(20),
        getNaabolDailyMonitorSnapshot(),
      ]);
      setOrders(ordersData);
      setNaabolFlights(naabolSnapshot.flights);
      setLastRefresh(new Date());
      setTimeSource(naabolSnapshot.timeSource);
      const offsetMs = getNetworkOffsetFromSnapshot(naabolSnapshot.serverNowIso, Date.now());
      setNetworkOffsetMs(offsetMs);
      setNow(new Date(Date.now() + offsetMs));
      setIsUsingCache(false);
      writeMonitorCache(ordersData, naabolSnapshot.flights, today, naabolSnapshot.serverNowIso, naabolSnapshot.timeSource);
    } catch (loadError) {
      console.error("[FlightMonitor] Unable to load data:", loadError);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el monitor.");
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => {
    if (authLoading) return;
    if (!canOpen) {
      router.replace("/");
      return;
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canOpen]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date(Date.now() + networkOffsetMs)), 1000);
    return () => clearInterval(interval);
  }, [networkOffsetMs]);

  const rows = useMemo(() => buildRows(orders, naabolFlights, today, now), [orders, naabolFlights, today, now]);
  const allTodayRows = useMemo(() => buildRows(orders, naabolFlights, today, now, false), [orders, naabolFlights, today, now]);
  const expiredCount = Math.max(allTodayRows.length - rows.length, 0);
  const issueCount = rows.filter((row) => row.issues.length > 0).length;
  const matchedCount = rows.filter((row) => row.naabol).length;

  useEffect(() => {
    if (isLoading || rows.length === 0) return;
    const currentMinutes = getLaPazMinutes(now);
    const nextExpiry = rows
      .map((row) => row.effectiveMinutes)
      .filter((minutes): minutes is number => minutes !== null && minutes >= currentMinutes)
      .sort((a, b) => a - b)[0];

    if (nextExpiry === undefined) return;

    const msUntilExpired =
      (nextExpiry - currentMinutes + 1) * 60 * 1000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds() +
      500;

    const timeout = window.setTimeout(() => {
      setNow(new Date(Date.now() + networkOffsetMs));
      loadData(true);
    }, Math.max(msUntilExpired, 1000));

    return () => window.clearTimeout(timeout);
  }, [isLoading, loadData, networkOffsetMs, now, rows]);

  if (authLoading || (!canOpen && !authLoading)) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/")} aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                <Plane className="h-4 w-4" />
                Control de vuelos
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Vuelos de hoy</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Cruce local entre ordenes de servicio del dia y tablero operativo. Solo usa datos de hoy.
              </p>
            </div>
            <div className="fm-live-clock">
              <div className="fm-clock-label">GMT-4 / LPB</div>
              <div className="fm-clock-value"><SplitFlapText text={getLaPazTimeLabel(now)} /></div>
              <div className="fm-clock-date">
                {getLaPazDateLabel(now)} · {timeSource === "naabol-header" ? "hora red" : "hora servidor"}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border bg-background px-4 py-3">
                <div className="text-2xl font-bold">{rows.length}</div>
                <div className="text-xs uppercase text-muted-foreground">Vuelos</div>
              </div>
              <div className="rounded-xl border bg-background px-4 py-3">
                <div className="text-2xl font-bold text-emerald-600">{matchedCount}</div>
                <div className="text-xs uppercase text-muted-foreground">Coinciden</div>
              </div>
              <div className="rounded-xl border bg-background px-4 py-3">
                <div className={issueCount > 0 ? "text-2xl font-bold text-red-600" : "text-2xl font-bold text-emerald-600"}>
                  {issueCount}
                </div>
                <div className="text-xs uppercase text-muted-foreground">Alertas</div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Fecha: {today} {lastRefresh ? `- Ultima verificacion ${getLaPazTimeLabel(lastRefresh)}` : ""}
            {isUsingCache ? " - cache de sesion" : ""}
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Ordenes con vuelos del dia</CardTitle>
            </div>
            <Button className="h-11 px-5 shadow-md" onClick={() => loadData(true)} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar estados
            </Button>
          </CardHeader>
          <CardContent>
            <div>
              {isLoading ? (
                <div className="rounded-xl border bg-background p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Cargando ordenes y tablero...
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border bg-background p-8 text-center text-muted-foreground">
                  No hay vuelos pendientes de hoy en las ultimas 20 ordenes.
                  {expiredCount > 0 ? (
                    <div className="mt-2 text-xs">
                      {expiredCount} vuelo{expiredCount === 1 ? "" : "s"} de hoy ya pasaron y fueron ocultados.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="fm-table-shell">
                  <table className="fm-table">
                    <thead>
                      <tr>
                        <th>Vuelo</th>
                        <th>Hora orden</th>
                        <th>Hora NAABOL</th>
                        <th>Diferencia</th>
                        <th>Estado</th>
                        <th>File / equipo</th>
                        <th>Alertas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const tone = row.naabol?.statusTone || "danger";
                        const driverDisplay = getDriverDisplay(row.driver, row.bus);
                        return (
                          <tr key={row.id}>
                            <td>
                              <div className="fm-flight-number">
                                <SplitFlapText text={row.flightNumber} />
                              </div>
                              <div className="fm-route">
                                <span className={`fm-op-badge fm-op-${row.expectedOperation || "none"}`}>
                                  {getOperationLabel(row.expectedOperation)}
                                </span>
                                <span className="fm-route-path">{getDisplayRoute(row)}</span>
                              </div>
                            </td>
                            <td>
                              <div className="fm-time fm-time-order"><SplitFlapText text={row.serviceTime} /></div>
                              <div className="fm-subtle">observaciones</div>
                            </td>
                            <td>
                              <div className="fm-time fm-time-board"><SplitFlapText text={row.naabolTime} /></div>
                              <div className="fm-subtle">{row.naabolTimeSource}</div>
                            </td>
                            <td>
                              <div className={row.deltaMinutes === 0 ? "fm-delta fm-delta-ok" : row.deltaMinutes === null ? "fm-delta" : "fm-delta fm-delta-alert"}>
                                {formatDelta(row.deltaMinutes)}
                              </div>
                            </td>
                            <td>
                              <Badge variant="outline" className={statusBadgeClass(tone)}>
                                {row.naabol?.statusLabel || "NO ENCONTRADO"}
                              </Badge>
                            </td>
                            <td>
                              <div className="fm-file">{row.file}</div>
                              <div className="fm-subtle">{row.ref}</div>
                              <div className="fm-team-stack">
                                {row.guide && row.guide !== "-" ? (
                                  <div className="fm-team-line fm-team-guide">
                                    <User size={13} />
                                    <span>{row.guide}</span>
                                  </div>
                                ) : null}
                                {row.driver && row.driver !== "-" ? (
                                  <div className="fm-team-line fm-team-driver">
                                    <Car size={13} />
                                    <span>{driverDisplay}</span>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <div className="fm-alerts">
                                {row.issues.length === 0 ? (
                                  <span className="fm-ok"><CheckCircle2 className="h-4 w-4" /> OK</span>
                                ) : (
                                  row.issues.map((issue) => (
                                    <span key={issue} className="fm-issue">
                                      <AlertTriangle className="h-4 w-4" />
                                      {issue}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="fm-source-card">
          <span>Fuente</span>
          <strong>NAABOL</strong>
        </div>
      </div>
      <style>{`
        .fm-row {
          border: 1px solid hsl(var(--primary) / 0.18);
          border-radius: 14px;
          background:
            linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.05)),
            hsl(var(--background));
          padding: 14px;
          box-shadow: 0 14px 34px hsl(var(--primary) / 0.08);
        }
        .fm-main {
          display: grid;
          grid-template-columns: minmax(170px, 1.4fr) repeat(3, minmax(112px, 0.8fr)) minmax(150px, 0.9fr);
          gap: 12px;
          align-items: stretch;
        }
        .fm-flight-cell,
        .fm-time-card,
        .fm-delta-card,
        .fm-status-cell {
          border: 1px solid hsl(var(--border));
          border-radius: 10px;
          background: hsl(var(--card) / 0.72);
          padding: 10px 12px;
          min-width: 0;
        }
        .fm-label {
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          margin-bottom: 7px;
        }
        .fm-flight-number {
          font-family: "Space Mono", monospace;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: hsl(var(--foreground));
          line-height: 1;
        }
        .fm-route {
          margin-top: 7px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fm-op-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--muted));
          color: hsl(var(--muted-foreground));
        }
        .fm-op-S {
          border-color: hsl(198 92% 46% / 0.28);
          background: hsl(198 92% 46% / 0.11);
          color: hsl(198 92% 34%);
        }
        .fm-op-L {
          border-color: hsl(142 62% 40% / 0.28);
          background: hsl(142 62% 40% / 0.11);
          color: hsl(142 62% 30%);
        }
        .fm-route-path {
          font-family: "Space Mono", monospace;
          font-weight: 800;
          color: hsl(var(--foreground));
        }
        .fm-time {
          font-family: "Space Mono", monospace;
          font-size: 24px;
          font-weight: 800;
          color: hsl(var(--primary));
          line-height: 1;
        }
        .fm-time-order {
          color: hsl(214 86% 46%);
        }
        .fm-time-card-naabol .fm-time {
          color: hsl(198 92% 46%);
        }
        .fm-table-shell {
          overflow-x: auto;
          border: 1px solid hsl(var(--primary) / 0.16);
          border-radius: 16px;
          background:
            linear-gradient(180deg, hsl(var(--primary) / 0.05), transparent 160px),
            hsl(var(--background));
          box-shadow: 0 16px 38px hsl(var(--primary) / 0.08);
        }
        .fm-table {
          width: 100%;
          min-width: 980px;
          border-collapse: separate;
          border-spacing: 0;
        }
        .fm-table th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: hsl(var(--card));
          border-bottom: 1px solid hsl(var(--primary) / 0.14);
          padding: 12px 14px;
          text-align: left;
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
        }
        .fm-table td {
          border-bottom: 1px solid hsl(var(--border) / 0.72);
          padding: 13px 14px;
          vertical-align: middle;
          background: hsl(var(--card) / 0.42);
        }
        .fm-table tbody tr:last-child td {
          border-bottom: 0;
        }
        .fm-table tbody tr:hover td {
          background: hsl(var(--primary) / 0.055);
        }
        .fm-table tbody tr td:first-child {
          border-left: 3px solid transparent;
        }
        .fm-table tbody tr:hover td:first-child {
          border-left-color: hsl(var(--primary));
        }
        .fm-live-clock {
          border: 1px solid hsl(var(--primary) / 0.18);
          border-radius: 14px;
          background: hsl(var(--background));
          padding: 12px 14px;
          min-width: 190px;
          box-shadow: inset 0 1px 0 hsl(var(--primary) / 0.08);
        }
        .fm-clock-label,
        .fm-clock-date {
          font-family: "Space Mono", monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
        }
        .fm-clock-value {
          margin: 4px 0;
          font-family: "Space Mono", monospace;
          font-size: 30px;
          font-weight: 800;
          color: hsl(var(--primary));
          line-height: 1;
        }
        .fm-time-board {
          color: hsl(175 78% 32%);
        }
        .fm-subtle {
          margin-top: 4px;
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          white-space: nowrap;
        }
        .fm-team-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 7px;
        }
        .fm-team-line {
          display: inline-flex;
          width: fit-content;
          max-width: 260px;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.15;
        }
        .fm-team-line span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fm-team-guide {
          background: hsl(214 86% 46% / 0.11);
          color: hsl(214 72% 34%);
        }
        .fm-team-driver {
          background: hsl(142 62% 40% / 0.12);
          color: hsl(142 52% 28%);
        }
        .fm-delta {
          font-family: "Space Mono", monospace;
          font-size: 21px;
          font-weight: 800;
          color: hsl(var(--muted-foreground));
        }
        .fm-delta-ok { color: hsl(142 62% 40%); }
        .fm-delta-alert { color: hsl(var(--destructive)); }
        .fm-status-cell {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 9px;
        }
        .fm-file {
          font-family: "Space Mono", monospace;
          font-size: 12px;
          font-weight: 700;
          color: hsl(var(--foreground));
        }
        .fm-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 11px;
          color: hsl(var(--muted-foreground));
          font-size: 12px;
        }
        .fm-alerts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .fm-ok,
        .fm-issue {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 12px;
          font-weight: 700;
        }
        .fm-ok {
          background: hsl(142 62% 40% / 0.10);
          color: hsl(142 62% 36%);
        }
        .fm-issue {
          background: hsl(var(--destructive) / 0.10);
          color: hsl(var(--destructive));
        }
        .fm-split {
          display: inline-flex;
          gap: 1px;
        }
        .fm-split-char {
          display: inline-block;
          animation: fm-flap-in 240ms ease-out both;
          transform-origin: center 60%;
        }
        .fm-source-card {
          align-self: flex-end;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid hsl(var(--primary) / 0.18);
          border-radius: 999px;
          background: hsl(var(--card));
          padding: 8px 13px;
          box-shadow: 0 10px 24px hsl(var(--primary) / 0.07);
          font-size: 12px;
          color: hsl(var(--muted-foreground));
        }
        .fm-source-card strong {
          font-family: "Space Mono", monospace;
          color: hsl(var(--foreground));
          letter-spacing: 0.06em;
        }
        @keyframes fm-flap-in {
          0% { opacity: 0.35; transform: rotateX(-65deg) translateY(-2px); }
          100% { opacity: 1; transform: rotateX(0deg) translateY(0); }
        }
        @media (max-width: 900px) {
          .fm-table th,
          .fm-table td {
            padding: 11px 12px;
          }
        }
        @media (max-width: 560px) {
          .fm-main {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
