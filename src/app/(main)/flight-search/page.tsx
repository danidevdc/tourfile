
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, Plane, Search, ArrowLeft, PlaneTakeoff, PlaneLanding, Plus, X, RotateCcw } from "lucide-react";
import { findFlight } from "@/ai/flows/find-flight-flow";
import type { FindFlightOutput, FindFlightInput } from "@/ai/flows/flight-types";
import { useAuth, type AppModule } from "@/hooks/useAuth";
import { incrementFlightSearchCount, getTodaysFlightSearchStats, type FlightSearchStat } from "@/lib/flightSearchCounterService";
import { createFlight, type PredefinedFlight } from "@/lib/serviceOrderService";
import { useToast } from "@/hooks/use-toast";

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
function HourlyBar({ data }: { data: FlightSearchStat[] }) {
  const max = Math.max(...data.map(d => d.searches), 1);
  const now = new Date().getHours();
  return (
    <div className="nd-bar-container">
      {data.map((d, i) => {
        const heightPct = Math.max(8, (d.searches / max) * 100);
        const isNow = i === now;
        const hasData = d.searches > 0;
        return (
          <div
            key={d.hour}
            title={`${d.hour}h: ${d.searches}`}
            className={`nd-bar-segment ${isNow ? 'nd-bar-now' : hasData ? 'nd-bar-active' : 'nd-bar-empty'}`}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
}

// ── FIDS horizontal result card ───────────────────────────────────────────────
function FlightResultCard({
  flightNumber,
  departure,
  arrival,
}: {
  flightNumber: string;
  departure: { code: string; city: string; time: string };
  arrival:   { code: string; city: string; time: string };
}) {
  return (
    <div className="nd-fids-horizontal">
      {/* ─ Departure (left) ─ */}
      <div className="nd-fids-side nd-fids-left">
        <div className="nd-fids-side-label">
          <PlaneTakeoff size={14} strokeWidth={1.5} className="nd-icon-muted" />
          <span className="nd-label nd-secondary">SALIDA</span>
        </div>
        <div className="nd-fids-code">{departure.code}</div>
        <div className="nd-fids-time-hero">{departure.time}</div>
        <div className="nd-label nd-disabled nd-city-label">{departure.city.toUpperCase()}</div>
      </div>

      {/* ─ Animated plane path (center) ─ */}
      <div className="nd-fids-center">
        <div className="nd-label nd-disabled nd-flight-num">{flightNumber}</div>
        <div className="nd-track">
          <div className="nd-track-dot nd-track-dot-left" />
          <div className="nd-track-line" />
          <div className="nd-track-plane">
            <Plane size={18} strokeWidth={1.5} />
          </div>
          <div className="nd-track-line" />
          <div className="nd-track-dot nd-track-dot-right" />
        </div>
      </div>

      {/* ─ Arrival (right) ─ */}
      <div className="nd-fids-side nd-fids-right">
        <div className="nd-fids-side-label">
          <PlaneLanding size={14} strokeWidth={1.5} className="nd-icon-muted" />
          <span className="nd-label nd-secondary">LLEGADA</span>
        </div>
        <div className="nd-fids-code">{arrival.code}</div>
        <div className="nd-fids-time-hero">{arrival.time}</div>
        <div className="nd-label nd-disabled nd-city-label">{arrival.city.toUpperCase()}</div>
      </div>
    </div>
  );
}

// ── Main search card ──────────────────────────────────────────────────────────
function FlightSearchCard() {
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchResult, setSearchResult] = useState<FindFlightOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchStats, setSearchStats] = useState<FlightSearchStat[]>([]);
  const [addedOk, setAddedOk] = useState(false);
  const { toast } = useToast();
  const flightInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = async () => {
    const stats = await getTodaysFlightSearchStats();
    setSearchStats(stats);
  };

  useEffect(() => {
    fetchStats();
    flightInputRef.current?.focus();
  }, []);

  const handleClear = () => {
    setFlightNumber('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setSearchResult(null);
    setError(null);
    setAddedOk(false);
    flightInputRef.current?.focus();
  };

  const handleSearch = async () => {
    if (!flightNumber || !date) {
      setError('INGRESA EL NÚMERO DE VUELO Y LA FECHA');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setAddedOk(false);
    try {
      await incrementFlightSearchCount();
      const result = await findFlight({ flightNumber, date } as FindFlightInput);
      if (result.errorMessage) {
        if (result.errorMessage.includes('No flight found for this date')) {
          setError(`VUELO ${flightNumber} NO OPERA EN ESTA FECHA`);
        } else {
          setError(result.errorMessage.toUpperCase());
        }
      } else if (!result.flightFound) {
        setError(`VUELO ${flightNumber} NO ENCONTRADO`);
      }
      setSearchResult(result);
    } catch (e) {
      setError('ERROR INESPERADO — REVISA LA CONSOLA');
      console.error(e);
    } finally {
      setIsLoading(false);
      fetchStats();
    }
  };

  const handleAddFlight = async () => {
    if (!searchResult?.flightFound) return;
    setIsAdding(true);
    try {
      const { flightNumber: ident, departure, arrival, flightSegment } = searchResult;
      if (ident && departure?.time.scheduled && arrival?.time.scheduled) {
        await createFlight({
          flightNumber: ident,
          time: arrival.time.scheduled,
          observations: `VUELO LLEGA ${arrival.time.scheduled}. ${flightSegment}`,
        } as Omit<PredefinedFlight, 'id'>);
        await createFlight({
          flightNumber: ident,
          time: departure.time.scheduled,
          observations: `VUELO SALE ${departure.time.scheduled}. ${flightSegment}`,
        } as Omit<PredefinedFlight, 'id'>);
        setAddedOk(true);
        toast({ title: 'Vuelo guardado', description: `${ident} añadido a la lista.`, variant: 'success' as any });
      } else {
        throw new Error('Datos insuficientes para guardar el vuelo.');
      }
    } catch (e: any) {
      toast({ title: 'Error al guardar', description: e.message, variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const totalSearches = searchStats.reduce((s, d) => s + d.searches, 0);
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
              <span className="nd-flight-tag">{searchResult.flightNumber}</span>
            </div>
            <div className="nd-status-found">
              <span className="nd-status-dot" />
              <span className="nd-label">ENCONTRADO</span>
            </div>
          </div>

          {/* Horizontal FIDS with plane animation */}
          <FlightResultCard
            flightNumber={searchResult.flightNumber || ''}
            departure={{
              code: searchResult.departure.airport.code,
              city: searchResult.departure.airport.city,
              time: searchResult.departure.time.scheduled,
            }}
            arrival={{
              code: searchResult.arrival.airport.code,
              city: searchResult.arrival.airport.city,
              time: searchResult.arrival.time.scheduled,
            }}
          />

          {/* Save action */}
          <div className="nd-fids-action">
            {addedOk ? (
              <div className="nd-saved-inline">
                <span className="nd-label">[GUARDADO] — VUELO AÑADIDO A LA LISTA</span>
              </div>
            ) : (
              <button
                onClick={handleAddFlight}
                disabled={isAdding}
                className={`nd-btn nd-btn-secondary nd-btn-full ${isAdding ? 'nd-btn-disabled' : ''}`}
              >
                {isAdding
                  ? <Loader2 size={14} strokeWidth={1.5} className="nd-spin" />
                  : <Plus size={14} strokeWidth={1.5} />
                }
                {isAdding ? 'GUARDANDO...' : 'AÑADIR A MIS VUELOS'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Stats footer ─────────────────────────────────────────────── */}
      <div className="nd-panel nd-panel-bottom">
        <div className="nd-stats-header">
          <span className="nd-label nd-disabled">BÚSQUEDAS HOY (GMT−4)</span>
          <span className="nd-stat-count">{totalSearches}</span>
        </div>
        {searchStats.length > 0 && (
          <>
            <HourlyBar data={searchStats} />
            <div className="nd-bar-labels">
              <span className="nd-label nd-disabled">00H</span>
              <span className="nd-label nd-disabled">23H</span>
            </div>
          </>
        )}
      </div>

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
        .nd-panel-mid    { border-bottom: none; }
        .nd-panel-fids   { background: hsl(var(--muted)); border-bottom: none; }
        .nd-panel-bottom { border-radius: 0 0 16px 16px; }

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
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .nd-field    { display: flex; flex-direction: column; }
        .nd-field-lg { flex: 2; }
        .nd-field-sm { flex: 1; }

        .nd-input {
          background: transparent;
          border: none;
          border-bottom: 1px solid hsl(var(--border));
          padding: 8px 0;
          font-family: "Space Mono", monospace;
          font-size: 20px;
          font-weight: 700;
          color: hsl(var(--foreground));
          letter-spacing: 0.04em;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 150ms ease-out;
        }
        .nd-input::placeholder { color: hsl(var(--muted-foreground) / 0.5); font-weight: 400; font-size: 16px; }
        .nd-input:focus        { border-bottom-color: hsl(var(--primary)); }
        .nd-input-error        { border-bottom-color: hsl(var(--destructive)); }
        .nd-input-date {
          font-size: 13px;
          font-weight: 400;
          color-scheme: light dark;
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
        .nd-flight-tag {
          font-family: "Space Mono", monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: hsl(var(--foreground));
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 4px;
          padding: 3px 10px;
        }
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
          display: flex;
          align-items: center;
          gap: 8px;
          border-top: 1px solid hsl(var(--border));
          padding-top: 20px;
        }

        /* Left side: departure */
        .nd-fids-side {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .nd-fids-left  { align-items: flex-start; }
        .nd-fids-right { align-items: flex-end; text-align: right; }

        .nd-fids-side-label {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 8px;
        }
        .nd-fids-right .nd-fids-side-label {
          flex-direction: row-reverse;
        }

        .nd-fids-code {
          font-family: "Space Grotesk", system-ui, sans-serif;
          font-size: 52px;
          font-weight: 300;
          color: hsl(var(--foreground));
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .nd-fids-time-hero {
          font-family: "Doto", "Space Mono", monospace;
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: hsl(var(--primary));
          line-height: 1;
          margin-top: 4px;
        }
        .nd-city-label { margin-top: 6px; display: block; }

        /* Center: animated track */
        .nd-fids-center {
          flex: 0 0 auto;
          width: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .nd-flight-num { text-align: center; }

        .nd-track {
          display: flex;
          align-items: center;
          width: 100%;
          position: relative;
          gap: 0;
        }
        .nd-track-dot-left,
        .nd-track-dot-right {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
          background: hsl(var(--muted-foreground) / 0.5);
        }
        .nd-track-line {
          flex: 1;
          height: 1px;
          background: hsl(var(--border));
        }
        .nd-track-plane {
          position: absolute;
          left: 0;
          color: hsl(var(--primary));
          display: flex;
          align-items: center;
          animation: nd-fly 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes nd-fly {
          0%   { left: 4px;    opacity: 0; transform: scale(0.7); }
          8%   { opacity: 1;   transform: scale(1); }
          85%  { opacity: 1;   transform: scale(1); }
          100% { left: calc(100% - 22px); opacity: 0; transform: scale(0.7); }
        }

        .nd-icon-muted    { color: hsl(var(--muted-foreground)); }
        .nd-icon-disabled { color: hsl(var(--muted-foreground) / 0.5); }

        /* ── Save feedback ──────────────────────────────────────────── */
        .nd-fids-action { margin-top: 20px; }
        .nd-saved-inline {
          display: flex;
          align-items: center;
          padding: 10px 0;
        }
        .nd-saved-inline .nd-label { color: hsl(142 62% 40%); }

        /* ── Stats bar ──────────────────────────────────────────────── */
        .nd-stats-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 14px;
        }
        .nd-stat-count {
          font-family: "Space Mono", monospace;
          font-size: 28px;
          font-weight: 700;
          color: hsl(var(--foreground));
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .nd-bar-container {
          display: flex;
          gap: 2px;
          align-items: flex-end;
          height: 48px;
        }
        .nd-bar-segment {
          flex: 1;
          border-radius: 0;
          transition: height 300ms cubic-bezier(0.25, 0.1, 0.25, 1);
        }
        .nd-bar-now    { background: hsl(var(--primary)); }
        .nd-bar-active { background: hsl(var(--primary) / 0.4); }
        .nd-bar-empty  { background: hsl(var(--border)); }

        .nd-bar-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
        }

        /* ── Spin animation ─────────────────────────────────────────── */
        .nd-spin {
          animation: nd-spin 1s linear infinite;
        }
        @keyframes nd-spin {
          to { transform: rotate(360deg); }
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
