
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, Plane, Search, ArrowLeft, PlaneTakeoff, PlaneLanding, X, RotateCcw } from "lucide-react";
import { findFlight } from "@/ai/flows/find-flight-flow";
import type { FindFlightOutput, FlightSearchProvider } from "@/ai/flows/flight-types";
import { useAuth, type AppModule } from "@/hooks/useAuth";
import { tryConsumeAirLabsSearch, tryConsumeFlightAwareSearch } from "@/lib/flightSearchCounterService";
import { getFlightRouteFromCache, normalizeFlightNumberForCache, saveFlightRouteToCache } from "@/lib/flightRouteCacheService";
import { calculateFlightDurationMinutes, getFlightRouteDurationFromCache, saveFlightRouteDurationToCache } from "@/lib/flightRouteDurationCacheService";

// ── Live dot-matrix clock ─────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(format(new Date(), 'HH:mm:ss'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="nd-clock">
      {time || '──:──:──'}
    </span>
  );
}

// ── Hourly bar chart ──────────────────────────────────────────────────────────
// ── Split-flap digit — efecto tablero aeropuerto ──────────────────────────────
function SplitFlapChar({ char, delay = 0 }: { char: string; delay?: number }) {
  const [displayed, setDisplayed] = useState('·');
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    // On mount: scramble through random chars then settle on real value
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:·';
    let step = 0;
    const totalSteps = 6;
    const interval = setInterval(() => {
      setFlipping(true);
      setTimeout(() => setFlipping(false), 80);
      if (step < totalSteps - 1) {
        setDisplayed(chars[Math.floor(Math.random() * chars.length)]);
      } else {
        setDisplayed(char);
        clearInterval(interval);
      }
      step++;
    }, 60 + delay * 8);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  return (
    <span className={`sf-char ${flipping ? 'sf-flip' : ''}`}>
      {displayed}
    </span>
  );
}

function SplitFlapText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`sf-word ${className}`}>
      {text.split('').map((c, i) => (
        <SplitFlapChar key={i} char={c} delay={i} />
      ))}
    </span>
  );
}

// ── FIDS horizontal result card with arc animation ────────────────────────────
function FlightIdentityPill({ flightNumber, compact = false }: { flightNumber: string; compact?: boolean }) {
  return (
    <span className={`nd-flight-pill ${compact ? 'nd-flight-pill-compact' : ''}`}>
      <span className="nd-flight-pill-icon">
        <Plane size={13} strokeWidth={2} />
      </span>
      <span className="nd-flight-pill-text">{flightNumber}</span>
    </span>
  );
}

function formatDisplayDate(dateValue: string) {
  if (dateValue.includes('/')) return dateValue;
  const [year, month, day] = dateValue.split('-');
  return year && month && day ? `${day}/${month}/${year}` : dateValue;
}

function getProviderLabel(provider?: FlightSearchProvider) {
  switch (provider) {
    case 'naabol':
      return 'NAABOL';
    case 'airlabs':
      return 'AirLabs';
    case 'aeroapi':
      return 'FlightAware';
    default:
      return 'Proveedor externo';
  }
}

function resultTouchesLPB(result?: FindFlightOutput | null): boolean {
  return result?.departure?.airport.code === 'LPB' || result?.arrival?.airport.code === 'LPB';
}

function FlightTime({ time, date, align = 'left' }: { time: string; date: string; align?: 'left' | 'right' }) {
  return (
    <span className={`nd-flight-time-card nd-flight-time-card-${align}`}>
      <span className="nd-flight-date">{formatDisplayDate(date)}</span>
      <span className={`nd-flight-time nd-flight-time-${align}`}>
        {time}
      </span>
    </span>
  );
}

function FlightResultCard({
  flightNumber,
  date,
  departure,
  arrival,
}: {
  flightNumber: string;
  date: string;
  departure: { code: string; city: string; time: string; date: string };
  arrival:   { code: string; city: string; time: string; date: string };
}) {
  const arcPath = "M 16,56 Q 150,4 284,56";

  return (
    <div className="nd-fids-horizontal">
      <div className="nd-airports-row">

        {/* ─ Departure left ─ */}
        <div className="nd-airport-card nd-airport-card-left">
          <div className="nd-fids-side-label">
            <PlaneTakeoff size={13} strokeWidth={1.5} className="nd-icon-muted" />
            <span className="nd-label nd-secondary">SALIDA</span>
          </div>
          <SplitFlapText text={departure.code} className="nd-fids-code-sf" />
          <div className="nd-airport-data-stack">
            <FlightTime time={departure.time} date={departure.date || date} />
            <div className="nd-label nd-disabled nd-city-label">{departure.city.toUpperCase()}</div>
          </div>
        </div>

        {/* ─ Arc SVG center ─ */}
        <div className="nd-arc-wrapper">
          <div className="nd-flight-num-center">
            <span className="nd-flight-center-label">{flightNumber}</span>
          </div>
          <svg viewBox="0 0 300 64" className="nd-arc-svg" aria-hidden="true">
            {/* Dashed arc */}
            <defs>
              <linearGradient id="ndPlaneBody" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
              <filter id="ndPlaneShadow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="hsl(var(--primary))" floodOpacity="0.28" />
              </filter>
            </defs>
            <path d={arcPath} fill="none" className="nd-arc-path nd-arc-path-glow" strokeLinecap="round" />
            <path d={arcPath} fill="none" className="nd-arc-path" strokeDasharray="7 9" strokeLinecap="round" />
            {/* Endpoint dots */}
            <circle cx="16"  cy="56" r="3.5" className="nd-arc-dot" />
            <circle cx="284" cy="56" r="3.5" className="nd-arc-dot" />
            {/* Animated plane — bigger, filled primary color */}
            <g>
              <animateMotion dur="4.4s" repeatCount="indefinite" path={arcPath} rotate="auto" />
              {/* 24×24 Lucide Plane, centered at origin, scaled up */}
              <g className="nd-plane-bank" transform="translate(-18,-12)">
                <path d="M-31 3 C-22 -3 -11 -3 -2 0" className="nd-contrail nd-contrail-1" />
                <path d="M-27 8 C-18 3 -9 3 -1 5" className="nd-contrail nd-contrail-2" />
                <ellipse cx="18" cy="14" rx="14" ry="3" className="nd-plane-shadow" />
                <path d="M34.5 10.4 15.8 3.2c-1-.4-2 .4-1.7 1.5l1.7 6.2-8.9 2.2-3-2.4-2.1.7 3 4.2-1 5 2.2-.7 2-3.2 9-2.3 2.4 6c.4 1 1.7 1.1 2.3.2l13.4-8.5c.7-.5.5-1.5-.6-1.7Z" className="nd-arc-plane-body" />
                <path d="M15.8 10.9 26.7 9.5" className="nd-arc-plane-line" />
                <path d="M17.1 14.4 27.9 12.8" className="nd-arc-plane-line nd-arc-plane-line-soft" />
              </g>
            </g>
          </svg>
        </div>

        {/* ─ Arrival right ─ */}
        <div className="nd-airport-card nd-airport-card-right">
          <div className="nd-fids-side-label nd-fids-side-label-right">
            <PlaneLanding size={13} strokeWidth={1.5} className="nd-icon-muted" />
            <span className="nd-label nd-secondary">LLEGADA</span>
          </div>
          <SplitFlapText text={arrival.code} className="nd-fids-code-sf nd-sf-right" />
          <div className="nd-airport-data-stack nd-airport-data-stack-right">
            <FlightTime time={arrival.time} date={arrival.date || date} align="right" />
            <div className="nd-label nd-disabled nd-city-label">{arrival.city.toUpperCase()}</div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main search card ──────────────────────────────────────────────────────────
function FlightSearchCard() {
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<FindFlightOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flightInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    flightInputRef.current?.focus();
  }, []);

  const handleClear = () => {
    setFlightNumber('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setSearchResult(null);
    setError(null);
    flightInputRef.current?.focus();
  };

  const handleSearch = async () => {
    if (!flightNumber || !date) {
      setError('INGRESA EL NÚMERO DE VUELO Y LA FECHA');
      return;
    }
    const normalizedFlightNumber = normalizeFlightNumberForCache(flightNumber);
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    try {
      const routeCache = await getFlightRouteFromCache(normalizedFlightNumber);
      const routeHint = routeCache ? {
        origin: routeCache.origin,
        destination: routeCache.destination,
        airlineCode: routeCache.airlineCode,
        departureTime: routeCache.departureTime,
        arrivalTime: routeCache.arrivalTime,
      } : undefined;
      const durationCache = routeHint
        ? await getFlightRouteDurationFromCache(routeHint.origin, routeHint.destination)
        : null;
      const runAeroApiSearch = async (): Promise<FindFlightOutput> => {
        const consumption = await tryConsumeFlightAwareSearch();
        if (!consumption.allowed) {
          return {
            flightFound: false,
            flightNumber: normalizedFlightNumber,
            provider: 'aeroapi',
            errorMessage: `LIMITE DIARIO DE FLIGHTAWARE ALCANZADO (${consumption.total}/${consumption.limit}). PRUEBA MANANA O USA NAABOL PARA VUELOS DE HOY.`,
          };
        }
        return findFlight({
          flightNumber: normalizedFlightNumber,
          date,
          provider: 'aeroapi',
        });
      };
      const runAirLabsSearch = async (): Promise<FindFlightOutput> => {
        const consumption = await tryConsumeAirLabsSearch({ enforceLimit: false });
        if (!consumption.allowed) {
          return {
            flightFound: false,
            flightNumber: normalizedFlightNumber,
            provider: 'airlabs',
            errorMessage: `LIMITE DIARIO DE AIRLABS ALCANZADO (${consumption.total}/${consumption.limit}).`,
          };
        }
        return findFlight({
          flightNumber: normalizedFlightNumber,
          date,
          provider: 'airlabs',
        });
      };
      const persistFlightResult = async (result: FindFlightOutput) => {
        if (result.flightFound && result.flightNumber && result.departure?.airport.code && result.arrival?.airport.code) {
          await saveFlightRouteToCache({
            flightNumber: result.flightNumber,
            origin: result.departure.airport.code,
            destination: result.arrival.airport.code,
            departureTime: result.departure.time.scheduled && result.departure.time.scheduled !== '--:--'
              ? result.departure.time.scheduled
              : undefined,
            arrivalTime: result.arrival.time.scheduled && result.arrival.time.scheduled !== '--:--'
              ? result.arrival.time.scheduled
              : undefined,
            discoveredBy: result.provider === 'aeroapi' || result.provider === 'airlabs' || result.provider === 'naabol'
              ? result.provider
              : 'manual',
          });
        }
        if (result.flightFound && result.departure?.airport.code && result.arrival?.airport.code) {
          const durationMinutes = calculateFlightDurationMinutes({
            departureDate: result.departure.time.scheduledDate,
            departureTime: result.departure.time.scheduled,
            arrivalDate: result.arrival.time.scheduledDate,
            arrivalTime: result.arrival.time.scheduled,
          });

          if (durationMinutes) {
            await saveFlightRouteDurationToCache({
              origin: result.departure.airport.code,
              destination: result.arrival.airport.code,
              durationMinutes,
            });
          }
        }
      };
      const isToday = date === format(new Date(), 'yyyy-MM-dd');
      let result = isToday
        ? await findFlight({
            flightNumber: normalizedFlightNumber,
            date,
            provider: 'naabol',
            routeHint,
            routeDurationMinutes: durationCache?.durationMinutes,
          })
        : await runAeroApiSearch();

      if (isToday && !resultTouchesLPB(result)) {
        const airLabsResult = await runAirLabsSearch();
        if (airLabsResult.flightFound && (!result.flightFound || resultTouchesLPB(airLabsResult))) {
          result = airLabsResult;
        }
      }

      if (isToday && !resultTouchesLPB(result)) {
        const aeroApiResult = await runAeroApiSearch();
        if (aeroApiResult.flightFound && (!result.flightFound || resultTouchesLPB(aeroApiResult))) {
          result = aeroApiResult;
        }
      }

      if (result.errorMessage) {
        if (result.errorMessage.includes('No flight found for this date')) {
          setError(`VUELO ${flightNumber} NO OPERA EN ESTA FECHA`);
        } else {
          setError(result.errorMessage.toUpperCase());
        }
      } else if (!result.flightFound) {
        setError(`VUELO ${flightNumber} NO ENCONTRADO`);
      }
      await persistFlightResult(result);
      setSearchResult(result);
    } catch (e) {
      setError('ERROR INESPERADO — REVISA LA CONSOLA');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const canSearch = !isLoading && !!flightNumber && !!date;

  return (
    <div className="nd-card-stack">

      {/* ── Header + clock ──────────────────────────────────────────── */}
      <div className="nd-panel nd-panel-top">
        <div className="nd-header-row">
          <div>
            <div className="nd-label nd-disabled nd-mb-sm">TOURFILE // VUELOS</div>
            <LiveClock />
          </div>
          <div className="nd-header-meta">
            <div className="nd-label nd-disabled">GMT−4 / LPB</div>
            <div className="nd-label nd-secondary nd-mt-xs">
              {format(new Date(), 'dd MMM yyyy').toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search form ─────────────────────────────────────────────── */}
      <div className="nd-panel nd-panel-mid">
        <div className="nd-form-row">
          {/* Flight number */}
          <div className="nd-field nd-field-lg">
            <label className="nd-label nd-secondary nd-mb-sm" htmlFor="nd-flight">
              N° VUELO
            </label>
            <input
              ref={flightInputRef}
              id="nd-flight"
              type="text"
              placeholder="AAL923"
              value={flightNumber}
              onChange={e => setFlightNumber(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className={`nd-input ${error ? 'nd-input-error' : ''}`}
            />
          </div>
          {/* Date */}
          <div className="nd-field nd-field-sm">
            <label className="nd-label nd-secondary nd-mb-sm" htmlFor="nd-date">
              FECHA
            </label>
            <input
              id="nd-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="nd-input nd-input-date"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="nd-btn-row">
          <button
            onClick={handleSearch}
            disabled={!canSearch}
            className={`nd-btn nd-btn-primary ${!canSearch ? 'nd-btn-disabled' : ''}`}
          >
            {isLoading
              ? <Loader2 size={15} strokeWidth={1.5} className="nd-spin" />
              : <Search size={15} strokeWidth={1.5} />
            }
            {isLoading ? 'BUSCANDO...' : 'BUSCAR VUELO'}
          </button>
          <button onClick={handleClear} className="nd-btn nd-btn-ghost" aria-label="Limpiar">
            <RotateCcw size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Inline error */}
        {error && (
          <div className="nd-error-inline">
            <X size={11} strokeWidth={2.5} />
            <span className="nd-label">{error}</span>
          </div>
        )}
      </div>

      {/* ── FIDS result ─────────────────────────────────────────────── */}
      {searchResult?.flightFound && searchResult.departure && searchResult.arrival && (
        <div className="nd-panel nd-panel-fids">
          {/* Status row */}
          <div className="nd-fids-header">
            <div className="nd-fids-tag-row">
              <span className="nd-label nd-secondary">VUELO</span>
              <FlightIdentityPill flightNumber={searchResult.flightNumber || ''} />
            </div>
            <div className="nd-status-found">
              <span className="nd-status-dot" />
              <span className="nd-label">ENCONTRADO</span>
            </div>
          </div>

          {/* Horizontal FIDS with plane animation */}
          <FlightResultCard
            flightNumber={searchResult.flightNumber || ''}
            date={date}
            departure={{
              code: searchResult.departure.airport.code || '---',
              city: searchResult.departure.airport.city || 'Origen',
              time: searchResult.departure.time.scheduled || '--:--',
              date: searchResult.departure.time.scheduledDate || date,
            }}
            arrival={{
              code: searchResult.arrival.airport.code || '---',
              city: searchResult.arrival.airport.city || 'Destino',
              time: searchResult.arrival.time.scheduled || '--:--',
              date: searchResult.arrival.time.scheduledDate || date,
            }}
          />

          {/* Data source */}
          <div className="nd-fids-action">
            <div className="nd-source-strip">
              <span className="nd-label nd-secondary">FUENTE</span>
              <span className="nd-source-name">{getProviderLabel(searchResult.provider)}</span>
              {resultTouchesLPB(searchResult) && (
                <span className="nd-source-lpb">LPB</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Scoped styles — uses app CSS variables ────────────────────── */}
      <style>{`
        /* ── Tokens mapped from app palette ────────────────────────────
           Light:  bg=#f5fafa, card=#fff, primary=#0991ea, accent=#78e3f0
           Dark:   bg=#0e1f2e, card=#16303f, primary=#1a9df5, accent=#78e3f0
        ──────────────────────────────────────────────────────────────── */

        .nd-card-stack {
          width: 100%;
          max-width: 580px;
          display: flex;
          flex-direction: column;
        }

        /* ── Panels ─────────────────────────────────────────────────── */
        .nd-panel {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          padding: 24px 28px;
        }
        .nd-panel-top    { border-radius: 16px 16px 0 0; border-bottom: none; }
        .nd-panel-mid    { border-radius: 0 0 16px 16px; }
        .nd-panel-fids   { background: hsl(var(--card)); border-bottom: none; }

        /* ── Typography ─────────────────────────────────────────────── */
        .nd-clock {
          font-family: "Doto", "Space Mono", monospace;
          font-size: 48px;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
          color: hsl(var(--primary));
          display: block;
        }
        .nd-label {
          font-family: "Space Mono", monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .nd-secondary { color: hsl(var(--muted-foreground)); }
        .nd-disabled  { color: hsl(var(--muted-foreground) / 0.6); }

        /* ── Spacing helpers ────────────────────────────────────────── */
        .nd-mb-sm  { margin-bottom: 6px; display: block; }
        .nd-mt-xs  { margin-top: 4px; display: block; }

        /* ── Header ─────────────────────────────────────────────────── */
        .nd-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .nd-header-meta { text-align: right; padding-top: 6px; }

        /* ── Form ───────────────────────────────────────────────────── */
        .nd-form-row {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(170px, 0.9fr);
          align-items: end;
          gap: 12px;
          margin-bottom: 16px;
        }
        .nd-field    { display: flex; flex-direction: column; min-width: 0; }
        .nd-field-lg { flex: 2; }
        .nd-field-sm { flex: 1; }

        .nd-input {
          background: transparent;
          border: none;
          border-bottom: 1px solid hsl(var(--border));
          padding: 8px 0 10px;
          font-family: "Space Mono", monospace;
          font-size: 20px;
          font-weight: 700;
          color: hsl(var(--foreground));
          letter-spacing: 0.04em;
          outline: none;
          width: 100%;
          min-height: 48px;
          box-sizing: border-box;
          transition: border-color 150ms ease-out;
        }
        .nd-input::placeholder { color: hsl(var(--muted-foreground) / 0.5); font-weight: 400; font-size: 16px; }
        .nd-input:focus        { border-bottom-color: hsl(var(--primary)); }
        .nd-input-error        { border-bottom-color: hsl(var(--destructive)); }
        .nd-input-date {
          font-size: 20px;
          font-weight: 700;
          color-scheme: light;
        }
        .nd-input-date::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.85;
          filter: invert(47%) sepia(86%) saturate(1723%) hue-rotate(179deg) brightness(95%) contrast(91%);
          transition: opacity 150ms ease-out, transform 150ms ease-out;
        }
        .nd-input-date::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
          transform: scale(1.08);
        }

        /* ── Buttons ────────────────────────────────────────────────── */
        .nd-btn-row {
          display: flex;
          gap: 8px;
        }
        .nd-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 999px;
          padding: 11px 24px;
          font-family: "Space Mono", monospace;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          min-height: 44px;
          transition: all 200ms ease-out;
          border: none;
        }
        .nd-btn-primary {
          flex: 1;
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }
        .nd-btn-primary:hover:not(:disabled) {
          background: hsl(var(--primary) / 0.85);
        }
        .nd-btn-secondary {
          background: transparent;
          border: 1px solid hsl(var(--border));
          color: hsl(var(--foreground));
        }
        .nd-btn-secondary:hover:not(:disabled) {
          border-color: hsl(var(--primary));
          color: hsl(var(--primary));
        }
        .nd-btn-ghost {
          background: transparent;
          border: 1px solid hsl(var(--border));
          color: hsl(var(--muted-foreground));
          padding: 11px 16px;
        }
        .nd-btn-ghost:hover {
          border-color: hsl(var(--foreground) / 0.4);
          color: hsl(var(--foreground));
        }
        .nd-btn-full   { width: 100%; }
        .nd-btn-disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Error ──────────────────────────────────────────────────── */
        .nd-error-inline {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          color: hsl(var(--destructive));
        }
        .nd-error-inline .nd-label { color: hsl(var(--destructive)); }

        /* ── FIDS status row ─────────────────────────────────────────── */
        .nd-fids-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .nd-fids-tag-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .nd-flight-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: max-content;
          min-height: 32px;
          padding: 5px 12px 5px 7px;
          font-family: "Space Mono", monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: hsl(var(--foreground));
          background:
            linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.10)),
            hsl(var(--background));
          border: 1px solid hsl(var(--primary) / 0.24);
          border-radius: 999px;
          box-shadow: 0 10px 26px hsl(var(--primary) / 0.08);
          transition: transform 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out;
        }
        .nd-flight-pill:hover {
          transform: translateY(-2px);
          border-color: hsl(var(--primary) / 0.52);
          box-shadow: 0 16px 32px hsl(var(--primary) / 0.16);
        }
        .nd-flight-pill-compact {
          min-height: 28px;
          padding: 4px 10px 4px 6px;
          font-size: 11px;
        }
        .nd-flight-pill-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          color: hsl(var(--primary));
          background: hsl(var(--primary) / 0.12);
        }
        .nd-flight-pill-text { line-height: 1; }
        .nd-status-found {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nd-status-found .nd-label { color: hsl(142 62% 40%); }
        .nd-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: hsl(142 62% 40%);
          flex-shrink: 0;
        }

        /* ── FIDS horizontal layout ──────────────────────────────────── */
        .nd-fids-horizontal {
          margin-top: 2px;
          padding: 18px 20px;
          background:
            linear-gradient(135deg, hsl(var(--primary) / 0.10), hsl(var(--accent) / 0.07)),
            hsl(var(--background));
          border: 1px solid hsl(var(--primary) / 0.18);
          border-radius: 12px;
          box-shadow: 0 16px 40px hsl(var(--primary) / 0.10);
          transition: transform 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out;
        }
        .nd-fids-horizontal:hover {
          transform: translateY(-2px);
          border-color: hsl(var(--primary) / 0.38);
          box-shadow: 0 22px 48px hsl(var(--primary) / 0.16);
        }

        .nd-airports-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Airport blocks */
        .nd-airport-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .nd-airport-card-left  { align-items: flex-start; }
        .nd-airport-card-right { align-items: flex-end; text-align: right; }

        .nd-fids-side-label {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 6px;
        }
        .nd-fids-side-label-right {
          flex-direction: row-reverse;
        }

        /* ── Split-flap display ─────────────────────────────────────── */
        .sf-word {
          display: inline-flex;
          gap: 0px;
          line-height: 1;
        }
        .sf-char {
          display: inline-block;
          transition: opacity 60ms ease-out, transform 80ms ease-out;
          transform-style: preserve-3d;
          transform-origin: center 60%;
        }
        .sf-flip {
          opacity: 0.4;
          transform: rotateX(-40deg) scaleY(0.6);
        }

        /* Airport code: big Space Grotesk, split-flap style */
        .nd-fids-code-sf {
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 52px;
          font-weight: 300;
          color: hsl(var(--foreground));
          letter-spacing: -0.02em;
          line-height: 1;
          display: block;
          margin-top: 2px;
        }
        .nd-airport-data-stack {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 7px;
          width: max-content;
          margin-top: 8px;
        }
        .nd-airport-data-stack-right {
          align-items: flex-end;
        }
        .nd-flight-time-card {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          width: max-content;
          min-width: 112px;
          padding: 7px 11px 8px;
          background: hsl(var(--background) / 0.72);
          border: 1px solid hsl(var(--primary) / 0.18);
          border-radius: 8px;
        }
        .nd-flight-time-card-right {
          align-items: flex-end;
        }
        .nd-flight-date {
          font-family: "Space Mono", monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: hsl(var(--muted-foreground) / 0.78);
          line-height: 1;
        }
        .nd-flight-time {
          font-family: "Space Mono", monospace;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: hsl(var(--primary));
          line-height: 1;
        }
        .nd-flight-time-right {
          justify-content: flex-end;
        }
        .nd-sf-right { justify-content: flex-end; }
        .nd-city-label { display: block; padding-inline: 2px; }

        /* Arc SVG center */
        .nd-arc-wrapper {
          flex: 0 0 auto;
          width: 140px;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 4px;
        }
        .nd-flight-num-center {
          text-align: center;
          margin-bottom: 8px;
        }
        .nd-flight-center-label {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 2px 8px;
          font-family: "Space Mono", monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: hsl(var(--muted-foreground));
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 999px;
        }
        .nd-arc-svg {
          width: 100%;
          height: auto;
          overflow: visible;
        }
        .nd-arc-path {
          stroke: hsl(var(--primary) / 0.28);
          stroke-width: 1.5;
        }
        .nd-arc-path-glow {
          stroke: hsl(var(--primary) / 0.10);
          stroke-width: 8;
        }
        .nd-arc-dot {
          fill: hsl(var(--background));
          stroke: hsl(var(--primary) / 0.55);
          stroke-width: 2;
        }
        .nd-plane-bank {
          filter: url(#ndPlaneShadow);
          animation: nd-plane-bank 4.4s ease-in-out infinite;
          transform-origin: 18px 12px;
        }
        .nd-contrail {
          fill: none;
          stroke: hsl(var(--primary) / 0.28);
          stroke-width: 1.4;
          stroke-linecap: round;
          stroke-dasharray: 18 10;
          animation: nd-contrail-flow 1.4s linear infinite;
        }
        .nd-contrail-2 {
          opacity: 0.55;
          animation-delay: 180ms;
        }
        .nd-plane-shadow {
          fill: hsl(var(--primary) / 0.14);
        }
        .nd-arc-plane-body {
          fill: url(#ndPlaneBody);
          stroke: hsl(var(--primary));
          stroke-width: 0.8;
          stroke-linejoin: round;
        }
        .nd-arc-plane-line {
          fill: none;
          stroke: hsl(var(--primary-foreground) / 0.75);
          stroke-width: 0.9;
          stroke-linecap: round;
        }
        .nd-arc-plane-line-soft {
          opacity: 0.5;
        }

        .nd-icon-muted    { color: hsl(var(--muted-foreground)); }
        .nd-icon-disabled { color: hsl(var(--muted-foreground) / 0.5); }

        /* ── Data source ────────────────────────────────────────────── */
        .nd-fids-action { margin-top: 20px; }
        .nd-source-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 44px;
          padding: 10px 14px;
          border: 1px solid hsl(var(--primary) / 0.22);
          border-radius: 10px;
          background: hsl(var(--primary) / 0.07);
        }
        .nd-source-name {
          flex: 1;
          font-family: "Space Mono", monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: hsl(var(--foreground));
        }
        .nd-source-lpb {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          padding: 3px 8px;
          border-radius: 999px;
          background: hsl(142 62% 40% / 0.12);
          color: hsl(142 62% 34%);
          font-family: "Space Mono", monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        /* ── Stats bar ──────────────────────────────────────────────── */
        /* ── Spin animation ─────────────────────────────────────────── */
        .nd-spin {
          animation: nd-spin 1s linear infinite;
        }
        @keyframes nd-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nd-plane-bank {
          0%, 100% { transform: translate(-18px, -12px) rotate(-5deg); }
          48% { transform: translate(-18px, -13px) rotate(7deg); }
          68% { transform: translate(-18px, -12px) rotate(2deg); }
        }
        @keyframes nd-contrail-flow {
          to { stroke-dashoffset: -28; }
        }
        @media (max-width: 560px) {
          .nd-panel { padding: 20px; }
          .nd-header-row { gap: 18px; }
          .nd-clock { font-size: 40px; }
          .nd-form-row {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .nd-airports-row {
            display: grid;
            grid-template-columns: 1fr;
            gap: 18px;
          }
          .nd-airport-card-right {
            align-items: flex-start;
            text-align: left;
          }
          .nd-airport-data-stack-right {
            align-items: flex-start;
          }
          .nd-fids-side-label-right {
            flex-direction: row;
          }
          .nd-sf-right { justify-content: flex-start; }
          .nd-arc-wrapper {
            width: min(100%, 280px);
            order: 2;
            justify-self: center;
          }
          .nd-airport-card-left { order: 1; }
          .nd-airport-card-right { order: 3; }
          .nd-fids-code-sf { font-size: 46px; }
        }
      `}</style>
    </div>
  );
}

// ── Page with auth guard ──────────────────────────────────────────────────────
export default function FlightSearchPage() {
  const router = useRouter();
  const { isCurrentUserAdmin, isLoading: authLoading, isAuthenticated, currentUser } = useAuth();

  const hasModule = (mod: AppModule): boolean => {
    if (!isAuthenticated) return false;
    if (isCurrentUserAdmin) return true;
    return (currentUser?.profile?.modules || []).includes(mod);
  };

  if (authLoading) {
    return (
      <div className="nd-page-loading">
        <span className="nd-label nd-secondary">[CARGANDO...]</span>
        <style>{`
          .nd-page-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 10rem);
          }
        `}</style>
      </div>
    );
  }

  if (!hasModule('vuelos')) {
    router.replace('/');
    return null;
  }

  return (
    <div className="nd-page">
      <div className="nd-page-inner">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="nd-back-btn"
          aria-label="Volver al inicio"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <FlightSearchCard />
      </div>

      <style>{`
        .nd-page {
          min-height: 100vh;
          background: hsl(var(--background));
          padding: 24px 16px 48px;
          display: flex;
          justify-content: center;
        }
        .nd-page-inner {
          width: 100%;
          max-width: 580px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .nd-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 50%;
          cursor: pointer;
          color: hsl(var(--muted-foreground));
          align-self: flex-start;
          margin-bottom: 20px;
          transition: border-color 150ms ease-out, color 150ms ease-out;
        }
        .nd-back-btn:hover {
          border-color: hsl(var(--primary));
          color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
}
