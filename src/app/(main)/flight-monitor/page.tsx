"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Car, Loader2, Plane, RefreshCw, User, XCircle } from "lucide-react";

import { getNaabolDailyMonitorSnapshot, type NaabolMonitorFlight } from "@/ai/flows/flight-monitor-flow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, type AppModule } from "@/hooks/useAuth";
import { getUpcomingFlightServiceOrders, type StoredServiceOrder } from "@/lib/serviceOrderStorage";
import {
  extractFlightNumbers,
  extractFlightTimeFromObservations,
  findServiceIssues,
  getDriverDisplay,
  getExpectedOperation,
  getFlightDigits,
  getOperationLabel,
  getOrderRoute,
  getRowLiveState,
  getTimingDifferenceMessage,
  matchNaabolFlight,
  normalizeDate,
  timeToMinutes,
  type OperationType,
  type RowLiveState,
} from "@/lib/flightMonitorParsing";

type MonitorTone = "success" | "warning" | "danger" | "info" | "neutral";

const ORDERS_CACHE_KEY = "tourfile_flight_monitor_orders_cache_v11";
const UPCOMING_ORDERS_FETCH_LIMIT = 80;
const NAABOL_POLL_INTERVAL_MS = 75_000;
// NAABOL solo expone el itinerario del dia operativo actual: no se puede
// consultar el tablero de manana con antelacion. Las filas de "Manana" y
// "Pasado manana" quedan en gris hasta que ese dia se convierta en "hoy".

// Un vuelo confirmado por NAABOL que deja de aparecer en un snapshot (por la
// ventana angosta que expone la API) se conserva con su ultimo dato conocido
// hasta que pasen estos minutos sin reaparecer.
const LAST_KNOWN_FLIGHT_TTL_MINUTES = 20;

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

interface OrdersCachePayload {
  cachedAt: number;
  serviceDate: string;
  orders: StoredServiceOrder[];
}

interface NaabolHealth {
  failedCount: number;
  totalCount: number;
  failedAirports: string[];
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

function addDaysToLaPazDate(date: Date, days: number): string {
  const parts = getLaPazParts(date);
  const asUtcNoon = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  asUtcNoon.setUTCDate(asUtcNoon.getUTCDate() + days);
  const y = asUtcNoon.getUTCFullYear();
  const m = String(asUtcNoon.getUTCMonth() + 1).padStart(2, "0");
  const d = String(asUtcNoon.getUTCDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
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

function readOrdersCache(today: string): OrdersCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ORDERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrdersCachePayload;
    if (!parsed.cachedAt || parsed.serviceDate !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeOrdersCache(orders: StoredServiceOrder[], today: string) {
  if (typeof window === "undefined") return;
  const payload: OrdersCachePayload = {
    cachedAt: Date.now(),
    serviceDate: today,
    orders,
  };
  sessionStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(payload));
}

function getNaabolFlightKey(flight: { airportCode: string; operation: string; flightDigits: string }): string {
  return `${flight.airportCode}-${flight.operation}-${flight.flightDigits}`;
}

function buildRows(
  orders: StoredServiceOrder[],
  naabolFlights: NaabolMonitorFlight[],
  allowedDates: string[],
  now: Date,
  hidePast = true
): FlightMonitorRow[] {
  const rows: FlightMonitorRow[] = [];
  const nowMinutes = getLaPazMinutes(now);
  const today = allowedDates[0];

  orders
    // Las ordenes "hijas" (splitFrom) son copias del mismo servicio separadas
    // solo para reparto de guia/chofer -- se ignoran aqui para no triplicar
    // filas; la orden madre ya trae los mismos datos de servicio.
    .filter((order) => order.status !== "eliminado" && order.status !== "cancelado" && !order.splitFrom)
    .forEach((order) => {
      (order.data.services || []).forEach((service, index) => {
        const serviceDate = normalizeDate(service.fecha);
        const { flights: flightNumbers, dominantPrefix } = extractFlightNumbers(service.vuelo, service.observaciones);
        const flightDigitsList = flightNumbers.map(getFlightDigits).filter(Boolean);

        if (!serviceDate || !allowedDates.includes(serviceDate) || flightDigitsList.length === 0) return;

        const observations = service.observaciones || "";
        const serviceName = service.servicio || "";
        const expectedOperation = getExpectedOperation(serviceName, observations);
        // NAABOL solo publica el itinerario del dia operativo actual: nunca
        // cruzar contra el tablero para filas de manana/pasado manana, o un
        // vuelo con el mismo numero que uno de hoy matchearia por error.
        const naabol = serviceDate === today
          ? matchNaabolFlight({ flightDigitsList, expectedOperation, expectedPrefix: dominantPrefix }, naabolFlights)
          : undefined;
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

        if (hidePast && serviceDate === today && effectiveMinutes !== null && effectiveMinutes < nowMinutes) return;

        if (!naabol) {
          if (serviceDate === today) issues.push("No encontrado en tablero");
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
    const aDateIndex = allowedDates.indexOf(a.serviceDate);
    const bDateIndex = allowedDates.indexOf(b.serviceDate);
    if (aDateIndex !== bDateIndex) return aDateIndex - bDateIndex;
    const aMinutes = a.effectiveMinutes ?? timeToMinutes(a.serviceTime) ?? 0;
    const bMinutes = b.effectiveMinutes ?? timeToMinutes(b.serviceTime) ?? 0;
    return aMinutes - bMinutes;
  });
}

function getStatusDisplayLabel(row: FlightMonitorRow, liveState: RowLiveState): string {
  if (liveState === "pending") return "OK";
  return row.naabol?.statusLabel || "OK";
}

function FlightMonitorRowView({ row }: { row: FlightMonitorRow }) {
  const liveState = getRowLiveState(row);
  const tone: MonitorTone = liveState === "pending" ? "neutral" : liveState === "live-mismatch" ? "danger" : row.naabol?.statusTone || "success";
  const driverDisplay = getDriverDisplay(row.driver, row.bus);
  const displayTime = row.naabol ? row.naabolTime : row.serviceTime;
  const timeSourceTag = row.naabol ? "NAABOL" : "ORDEN";
  const orderRoute = getOrderRoute(row);

  return (
    <tr className={`fm-row-${liveState}`}>
      <td>
        <div className="fm-date">{row.serviceDate}</div>
      </td>
      <td>
        <div className="fm-flight-number">
          <SplitFlapText text={row.flightNumber} />
        </div>
        <div className="fm-route">
          <span className={`fm-op-badge fm-op-${row.expectedOperation || "none"}`}>
            {getOperationLabel(row.expectedOperation)}
          </span>
          {orderRoute ? <span className="fm-route-path">{orderRoute}</span> : null}
        </div>
      </td>
      <td>
        <div className="fm-time"><SplitFlapText text={displayTime} /></div>
        <span className={`fm-source-tag fm-source-tag-${row.naabol ? "naabol" : "orden"} fm-source-tag-tone-${tone}`}>
          {timeSourceTag}
        </span>
      </td>
      <td>
        <Badge variant="outline" className={statusBadgeClass(tone)}>
          {getStatusDisplayLabel(row, liveState)}
        </Badge>
        {liveState === "live-mismatch" && row.deltaMinutes !== null ? (
          <div className="fm-delta-message">
            {getTimingDifferenceMessage(row.expectedOperation, row.deltaMinutes)}
          </div>
        ) : null}
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
    </tr>
  );
}

export default function FlightMonitorPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated, currentUser } = useAuth();
  const [orders, setOrders] = useState<StoredServiceOrder[]>([]);
  const [naabolFlights, setNaabolFlights] = useState<NaabolMonitorFlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [naabolHealth, setNaabolHealth] = useState<NaabolHealth | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [timeSource, setTimeSource] = useState<"naabol-header" | "server">("server");
  const [networkOffsetMs, setNetworkOffsetMs] = useState(0);
  const [now, setNow] = useState(new Date(Date.now() + networkOffsetMs));

  const lastKnownFlightsRef = useRef<Map<string, { flight: NaabolMonitorFlight; lastSeenAt: number }>>(new Map());

  const today = getLaPazToday(now);
  const allowedDates = useMemo(
    () => [today, addDaysToLaPazDate(now, 1), addDaysToLaPazDate(now, 2)],
    [today, now]
  );
  const hasModule = (mod: AppModule): boolean => {
    if (!isAuthenticated) return false;
    if (isCurrentUserAdmin) return true;
    return (currentUser?.profile?.modules || []).includes(mod);
  };

  const canOpen = hasModule("ordenes") || hasModule("vuelos");

  const loadOrders = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!forceRefresh) {
        const cached = readOrdersCache(today);
        if (cached) {
          setOrders(cached.orders);
          setIsUsingCache(true);
          setIsLoading(false);
          return;
        }
      }

      const ordersData = await getUpcomingFlightServiceOrders(UPCOMING_ORDERS_FETCH_LIMIT);
      setOrders(ordersData);
      setIsUsingCache(false);
      writeOrdersCache(ordersData, today);
    } catch (loadError) {
      console.error("[FlightMonitor] Unable to load orders:", loadError);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar las órdenes.");
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  const loadNaabolSnapshot = useCallback(async () => {
    try {
      const naabolSnapshot = await getNaabolDailyMonitorSnapshot();
      const nowMs = Date.now();
      const knownMap = lastKnownFlightsRef.current;

      naabolSnapshot.flights.forEach((flight) => {
        knownMap.set(getNaabolFlightKey(flight), { flight, lastSeenAt: nowMs });
      });

      const ttlMs = LAST_KNOWN_FLIGHT_TTL_MINUTES * 60 * 1000;
      Array.from(knownMap.entries()).forEach(([key, entry]) => {
        if (nowMs - entry.lastSeenAt > ttlMs) knownMap.delete(key);
      });

      setNaabolFlights(Array.from(knownMap.values()).map((entry) => entry.flight));
      setNaabolHealth({
        failedCount: naabolSnapshot.failedCount,
        totalCount: naabolSnapshot.totalCount,
        failedAirports: naabolSnapshot.failedAirports,
      });
      setLastRefresh(new Date());
      setTimeSource(naabolSnapshot.timeSource);
      const offsetMs = getNetworkOffsetFromSnapshot(naabolSnapshot.serverNowIso, Date.now());
      setNetworkOffsetMs(offsetMs);
      setNow(new Date(Date.now() + offsetMs));
    } catch (loadError) {
      console.error("[FlightMonitor] Unable to load NAABOL snapshot:", loadError);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el tablero NAABOL.");
    }
  }, []);

  const refreshAll = useCallback(async (forceRefresh = false) => {
    await Promise.all([loadOrders(forceRefresh), loadNaabolSnapshot()]);
  }, [loadOrders, loadNaabolSnapshot]);

  useEffect(() => {
    if (authLoading) return;
    if (!canOpen) {
      router.replace("/");
      return;
    }
    refreshAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canOpen]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date(Date.now() + networkOffsetMs)), 1000);
    return () => clearInterval(interval);
  }, [networkOffsetMs]);

  useEffect(() => {
    if (!canOpen) return;
    const interval = setInterval(() => { loadNaabolSnapshot(); }, NAABOL_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [canOpen, loadNaabolSnapshot]);

  const rows = useMemo(() => buildRows(orders, naabolFlights, allowedDates, now), [orders, naabolFlights, allowedDates, now]);
  const allTodayRows = useMemo(() => buildRows(orders, naabolFlights, allowedDates, now, false), [orders, naabolFlights, allowedDates, now]);
  const expiredCount = Math.max(
    allTodayRows.filter((row) => row.serviceDate === today).length -
      rows.filter((row) => row.serviceDate === today).length,
    0
  );
  const matchedCount = rows.filter((row) => row.naabol).length;
  const mismatchCount = rows.filter((row) => getRowLiveState(row) === "live-mismatch").length;

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
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Vuelos próximos</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Cruce entre las órdenes de servicio y el tablero operativo de NAABOL, para hoy, mañana y pasado mañana.
                Los vuelos de mañana y pasado mañana se muestran en gris hasta que NAABOL publique la información de ese día.
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
                <div className={mismatchCount > 0 ? "text-2xl font-bold text-red-600" : "text-2xl font-bold text-emerald-600"}>
                  {mismatchCount}
                </div>
                <div className="text-xs uppercase text-muted-foreground">Cambios</div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Fecha: {today} {lastRefresh ? `- Última verificación ${getLaPazTimeLabel(lastRefresh)}` : ""}
            {isUsingCache ? " - caché de sesión" : ""}
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {naabolHealth && naabolHealth.failedCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              NAABOL no respondió para {naabolHealth.failedCount} de {naabolHealth.totalCount} consultas
              {naabolHealth.failedAirports.length > 0 ? ` (${naabolHealth.failedAirports.join(", ")})` : ""}
              {" "}— algunos vuelos pueden faltar temporalmente.
            </span>
          </div>
        )}

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Órdenes con vuelos próximos</CardTitle>
            </div>
            <Button className="h-11 px-5 shadow-md" onClick={() => refreshAll(true)} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar estados
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {isLoading ? (
                <div className="rounded-xl border bg-background p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Cargando órdenes y tablero...
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border bg-background p-8 text-center text-muted-foreground">
                  No hay vuelos próximos en las últimas {UPCOMING_ORDERS_FETCH_LIMIT} órdenes creadas.
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
                        <th>Fecha</th>
                        <th>Vuelo</th>
                        <th>Hora</th>
                        <th>Estado</th>
                        <th>Detalles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <FlightMonitorRowView key={row.id} row={row} />
                      ))}
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
          min-width: 780px;
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
        .fm-row-pending td:first-child {
          border-left-color: hsl(var(--muted-foreground) / 0.35);
        }
        .fm-row-live-match td {
          animation: fm-halo-green 2.8s ease-in-out infinite;
        }
        .fm-row-live-mismatch td {
          animation: fm-halo-red 2.8s ease-in-out infinite;
        }
        .fm-row-live-match td:first-child,
        .fm-row-live-mismatch td:first-child {
          animation-name: fm-halo-green-border, fm-halo-green;
        }
        .fm-row-live-mismatch td:first-child {
          animation-name: fm-halo-red-border, fm-halo-red;
        }
        @keyframes fm-halo-green {
          0%, 100% { background: hsl(142 62% 40% / 0); }
          50% { background: hsl(142 62% 40% / 0.12); }
        }
        @keyframes fm-halo-red {
          0%, 100% { background: hsl(var(--destructive) / 0); }
          50% { background: hsl(var(--destructive) / 0.12); }
        }
        @keyframes fm-halo-green-border {
          0%, 100% { border-left-color: hsl(142 62% 40% / 0.5); }
          50% { border-left-color: hsl(142 62% 40% / 1); }
        }
        @keyframes fm-halo-red-border {
          0%, 100% { border-left-color: hsl(var(--destructive) / 0.5); }
          50% { border-left-color: hsl(var(--destructive) / 1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fm-row-live-match td,
          .fm-row-live-mismatch td,
          .fm-row-live-match td:first-child,
          .fm-row-live-mismatch td:first-child {
            animation: none;
          }
          .fm-row-live-match td:first-child {
            border-left-color: hsl(142 62% 40% / 1);
            border-left-width: 4px;
          }
          .fm-row-live-mismatch td:first-child {
            border-left-color: hsl(var(--destructive) / 1);
            border-left-width: 4px;
          }
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
        .fm-delta-message {
          margin-top: 6px;
          max-width: 220px;
          font-size: 11px;
          line-height: 1.35;
          color: hsl(var(--destructive));
        }
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
        .fm-date {
          font-family: inherit;
          font-size: 17px;
          font-weight: 700;
          color: hsl(var(--foreground));
          white-space: nowrap;
        }
        .fm-source-tag {
          display: inline-flex;
          align-items: center;
          margin-top: 6px;
          border-radius: 999px;
          padding: 2px 8px;
          font-family: "Space Mono", monospace;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.06em;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--muted));
          color: hsl(var(--muted-foreground));
        }
        .fm-source-tag-orden {
          border-color: hsl(214 86% 46% / 0.3);
          background: hsl(214 86% 46% / 0.1);
          color: hsl(214 72% 38%);
        }
        .fm-source-tag-naabol.fm-source-tag-tone-success {
          border-color: hsl(142 62% 40% / 0.3);
          background: hsl(142 62% 40% / 0.1);
          color: hsl(142 62% 30%);
        }
        .fm-source-tag-naabol.fm-source-tag-tone-danger {
          border-color: hsl(var(--destructive) / 0.35);
          background: hsl(var(--destructive) / 0.1);
          color: hsl(var(--destructive));
        }
        .fm-source-tag-naabol.fm-source-tag-tone-info,
        .fm-source-tag-naabol.fm-source-tag-tone-warning,
        .fm-source-tag-naabol.fm-source-tag-tone-neutral {
          border-color: hsl(198 92% 46% / 0.3);
          background: hsl(198 92% 46% / 0.1);
          color: hsl(198 92% 34%);
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
