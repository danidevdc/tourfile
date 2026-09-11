"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Pencil, CheckCircle2, Loader2, Search, Receipt, X } from "lucide-react";
import {
  getAllGuideNames,
  getOrdersByGuideAndMonth,
  getLiquidationsByGuide,
  getAvailableMonthsForGuide,
  payLiquidation,
  saveLiquidation,
  type GuideLiquidation,
  type GuideFileRow,
  type LiquidationItem,
  type GuideAvailableMonths,
} from "@/lib/guideLiquidationService";
import {
  getLiquidationCriteria,
  getSuggestedIdioma,
  IDIOMA_LABELS,
  type Idioma, type LiquidationCriteriaRule,
} from "@/lib/guideLiquidationCriteriaService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";
import { StatusBadge, type LiqStatus } from "@/components/guide-liquidation/StatusBadge";
import { IconBtn } from "@/components/guide-liquidation/IconBtn";
import { GenerateLiqModal } from "@/components/guide-liquidation/GenerateLiqModal";
import { EditLiqModal } from "@/components/guide-liquidation/EditLiqModal";
import { PayModal } from "@/components/guide-liquidation/PayModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/config/agency";

// ── Design tokens ─────────────────────────────────────────────────────────────
const CSS = {
  bg:      "hsl(var(--background))",
  card:    "hsl(var(--card))",
  border:  "hsl(var(--border))",
  muted:   "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg:      "hsl(var(--foreground))",
  subtle:  "hsl(var(--muted) / 0.4)",
};
const BLUE  = "#0991ea";
const GREEN = "#16a34a";
const AMBER = "#f59e0b";
const RED   = "#ef4444";

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

type EnrichedFileRow = GuideFileRow & { liqStatus: LiqStatus; liq?: GuideLiquidation };

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiquidationByGuidePage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // ── Session cache key ────────────────────────────────────────────────────────
  const SESSION_KEY = "liq_byguide_state";
  const restoringFromSession = useRef(false);

  // ── State ────────────────────────────────────────────────────────────────────
  const [guides, setGuides] = useState<string[]>([]);
  const [guideSearch, setGuideSearch] = useState("");
  const [selectedGuide, setSelectedGuide] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const [availableMonths, setAvailableMonths] = useState<GuideAvailableMonths>({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [rows, setRows] = useState<EnrichedFileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [criteriaRules, setCriteriaRules] = useState<LiquidationCriteriaRule[]>([]);
  const [suggestedIdioma, setSuggestedIdioma] = useState<Idioma | null>(null);

  const [payTarget, setPayTarget] = useState<GuideLiquidation | null>(null);
  const [paying, setPaying] = useState(false);
  const [liqTarget, setLiqTarget] = useState<EnrichedFileRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editLiqId, setEditLiqId] = useState<string | null>(null);

  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // ── Computed selectors ───────────────────────────────────────────────────────
  const availableYears = Object.keys(availableMonths).map(Number).sort((a, b) => b - a);
  const monthsForYear = (availableMonths[selectedYear] ?? []);

  const filteredGuides = guideOpen
    ? (guideSearch ? guides.filter(g => g.toLowerCase().includes(guideSearch.toLowerCase())) : guides)
    : [];

  // ── Init: load guides + restore session ─────────────────────────────────────
  useEffect(() => {
    getAllGuideNames().then(setGuides).catch(console.error);
    getLiquidationCriteria().then(r => { if (r) setCriteriaRules(r); }).catch(console.error);

    // Restore last search from sessionStorage
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const { guide, month, year, rows: savedRows, availableMonths: savedAM } = JSON.parse(saved);
        if (guide && savedRows) {
          restoringFromSession.current = true;
          setSelectedGuide(guide);
          setGuideSearch(guide);
          setAvailableMonths(savedAM ?? {});
          setSelectedYear(year);
          setSelectedMonth(month);
          setRows(savedRows);
          setSearched(true);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Click-outside for guide combobox ────────────────────────────────────────
  useEffect(() => {
    if (!guideOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest("[data-guide-combo]")) setGuideOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [guideOpen]);

  // ── When guide changes: load available months ────────────────────────────────
  useEffect(() => {
    if (!selectedGuide) { setSuggestedIdioma(null); setAvailableMonths({}); return; }
    getSuggestedIdioma(selectedGuide).then(setSuggestedIdioma).catch(console.error);
    getAvailableMonthsForGuide(selectedGuide).then(am => {
      setAvailableMonths(am);
      // If restoring from session, keep the saved month/year — don't auto-select
      if (restoringFromSession.current) {
        restoringFromSession.current = false;
        return;
      }
      // Auto-select: prefer current month/year if available, else latest
      const years = Object.keys(am).map(Number).sort((a, b) => b - a);
      if (years.length === 0) return;
      const now = new Date();
      const curY = now.getFullYear();
      const curM = now.getMonth() + 1;
      if (am[curY]?.includes(curM)) {
        setSelectedYear(curY);
        setSelectedMonth(curM);
      } else {
        const latestY = years[0];
        const latestM = (am[latestY] ?? []).at(-1) ?? 1;
        setSelectedYear(latestY);
        setSelectedMonth(latestM);
      }
    }).catch(console.error);
  }, [selectedGuide]);

  // ── When year changes: snap month to a valid one if needed ──────────────────
  useEffect(() => {
    const months = availableMonths[selectedYear] ?? [];
    if (months.length > 0 && !months.includes(selectedMonth)) {
      setSelectedMonth(months.at(-1)!);
    }
  }, [selectedYear, availableMonths]);

  // ── Enter key triggers search when guide + month + year are selected ─────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (!selectedGuide || loading) return;
      // Don't trigger if focus is inside the guide combobox search input
      if ((e.target as HTMLElement).closest?.("[data-guide-combo]")) return;
      doSearch();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedGuide, selectedMonth, selectedYear, loading]);

  // ── Core fetch — shared by full search and silent refresh ───────────────────
  const fetchRows = useCallback(async (): Promise<EnrichedFileRow[]> => {
    const [fileRows, liqList] = await Promise.all([
      getOrdersByGuideAndMonth(selectedGuide, selectedMonth, selectedYear),
      getLiquidationsByGuide(selectedGuide),
    ]);
    const norm = (s: string) => s.replace(/^CTF/i, '').trim();
    return fileRows.map(row => {
      const liq = liqList.find(l => norm(l.fileNumber) === norm(row.fileNumber));
      let liqStatus: LiqStatus = 'SIN LIQUIDAR';
      if (liq) liqStatus = liq.paymentDate ? 'PAGADO' : 'SOLICITADO';
      return { ...row, liqStatus, liq };
    });
  }, [selectedGuide, selectedMonth, selectedYear]);

  const persistRows = useCallback((enriched: EnrichedFileRow[]) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        guide: selectedGuide, month: selectedMonth, year: selectedYear,
        rows: enriched, availableMonths,
      }));
    } catch { /* quota exceeded */ }
  }, [selectedGuide, selectedMonth, selectedYear, availableMonths]);

  // ── Full search — shows spinner, hides table (user-triggered) ───────────────
  const doSearch = useCallback(async () => {
    if (!selectedGuide) return;
    setLoading(true);
    setSearched(false);
    try {
      const enriched = await fetchRows();
      setRows(enriched);
      setSearched(true);
      persistRows(enriched);
    } catch (e) {
      console.error(e);
      toast({ title: "Error al buscar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedGuide, fetchRows, persistRows, toast]);

  // ── Silent refresh — keeps table visible, just updates data ─────────────────
  const silentRefresh = useCallback(async () => {
    if (!selectedGuide) return;
    try {
      const enriched = await fetchRows();
      setRows(enriched);
      persistRows(enriched);
    } catch (e) {
      console.error(e);
    }
  }, [selectedGuide, fetchRows, persistRows]);

  const handlePrint = async (liq: GuideLiquidation) => {
    setPrintingId(liq.id);
    try {
      const url = await buildLiquidationPDFUrl(liq);
      const fileName = `Liquidacion-${liq.liquidationNumber}-${liq.fileNumber}-${liq.guideName.replace(/\s+/g, "_")}.pdf`;
      setPdfPreview({ url, fileName });
    } catch (e) { console.error(e); }
    finally { setPrintingId(null); }
  };

  const handlePay = async (date: string) => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await payLiquidation(payTarget.id, date);
      const paidLiq = { ...payTarget, paymentDate: date };
      // Optimistic update — mark row as PAGADO immediately
      setRows(prev => prev.map(r => {
        const norm = (s: string) => s.replace(/^CTF/i, '').trim();
        if (norm(r.fileNumber) !== norm(payTarget.fileNumber)) return r;
        return { ...r, liqStatus: 'PAGADO' as LiqStatus, liq: paidLiq };
      }));
      toast({ title: "Pago registrado", description: `${payTarget.guideName} · ${payTarget.liquidationNumber}`, variant: "success" });
      setPayTarget(null);
      silentRefresh();
    } catch (e) {
      toast({ title: "Error al registrar pago", variant: "destructive" });
    } finally { setPaying(false); }
  };

  const handleSaveLiq = async (items: LiquidationItem[], idioma: Idioma) => {
    if (!liqTarget || !currentUser) return;
    setGenerating(true);
    const savedFileNumber = liqTarget.fileNumber;
    try {
      const saved = await saveLiquidation({
        fileNumber: savedFileNumber,
        guideKey: selectedGuide,
        guideName: selectedGuide,
        paxName: liqTarget.paxName,
        paxCount: liqTarget.paxCount,
        items,
        createdBy: currentUser.email ?? currentUser.uid,
      });
      // Optimistic update — mark row as SOLICITADO immediately, no wait
      setRows(prev => prev.map(r => {
        const norm = (s: string) => s.replace(/^CTF/i, '').trim();
        if (norm(r.fileNumber) !== norm(savedFileNumber)) return r;
        return { ...r, liqStatus: 'SOLICITADO' as LiqStatus, liq: saved };
      }));
      toast({ title: "Liquidación guardada", description: `File ${savedFileNumber} · ${IDIOMA_LABELS[idioma]}`, variant: "success" });
      setLiqTarget(null);
      silentRefresh();
    } catch (e) {
      console.error(e);
      toast({ title: "Error al guardar liquidación", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: CSS.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{`
        @keyframes nd-pulse    { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes nd-halo {
          0%, 100% { box-shadow: 0 0 0 0 #ef444400; }
          50%       { box-shadow: 0 0 0 4px #ef444433; }
        }
        .nd-halo-badge {
          animation: nd-halo 2s ease-in-out infinite;
        }
        @keyframes nd-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .nd-shimmer-badge {
          background: linear-gradient(
            105deg,
            #16a34a 0%,
            #16a34a 35%,
            #86efac 48%,
            #fff    52%,
            #86efac 56%,
            #16a34a 65%,
            #16a34a 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: nd-shimmer 2.4s linear infinite;
        }
      `}</style>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => router.push("/guide-liquidation")} style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${CSS.border}`, background: CSS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: CSS.mutedFg }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", color: CSS.fg }}>
              Liquidaciones por Guía
            </h1>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: CSS.mutedFg, marginTop: "2px" }}>
              Files del mes · estado · pagos
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", padding: "20px 24px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>

          {/* Guide combobox */}
          <div data-guide-combo style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px", minWidth: "200px", position: "relative" as const }}>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Guía</label>
            <button
              onClick={() => { setGuideSearch(""); setGuideOpen(o => !o); }}
              style={{
                height: "36px", padding: "0 12px", borderRadius: "6px",
                border: `1px solid ${selectedGuide ? BLUE : CSS.border}`,
                background: CSS.bg, color: selectedGuide ? BLUE : CSS.mutedFg,
                fontFamily: "'Space Mono', monospace", fontSize: "12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", textAlign: "left" as const, gap: "8px",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, fontWeight: selectedGuide ? 700 : 400 }}>
                {selectedGuide || "Seleccionar guía..."}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: guideOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {guideOpen && (
              <div style={{ position: "absolute" as const, top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", overflow: "hidden" }}>
                <div style={{ padding: "8px", borderBottom: `1px solid ${CSS.border}` }}>
                  <div style={{ position: "relative" as const }}>
                    <Search size={12} color={CSS.mutedFg} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      autoFocus
                      placeholder="Buscar..."
                      value={guideSearch}
                      onChange={e => setGuideSearch(e.target.value)}
                      style={{ width: "100%", paddingLeft: "28px", paddingRight: "8px", paddingTop: "6px", paddingBottom: "6px", fontFamily: "'Space Mono', monospace", fontSize: "11px", borderRadius: "4px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, outline: "none", boxSizing: "border-box" as const }}
                    />
                  </div>
                </div>
                <div style={{ maxHeight: "200px", overflowY: "auto" as const }}>
                  {filteredGuides.length === 0 ? (
                    <div style={{ padding: "12px 14px", fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>Sin resultados</div>
                  ) : filteredGuides.map(g => (
                    <button key={g}
                      onClick={() => { setSelectedGuide(g); setGuideSearch(g); setGuideOpen(false); setSearched(false); setRows([]); try { sessionStorage.removeItem(SESSION_KEY); } catch {} }}
                      style={{ width: "100%", textAlign: "left" as const, padding: "9px 14px", border: "none", background: g === selectedGuide ? `${BLUE}0f` : "transparent", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: g === selectedGuide ? BLUE : CSS.fg, fontWeight: g === selectedGuide ? 600 : 400 }}
                      onMouseEnter={e => { if (g !== selectedGuide) (e.currentTarget as HTMLButtonElement).style.background = `${BLUE}08`; }}
                      onMouseLeave={e => { if (g !== selectedGuide) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                    >{g}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Month */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Mes</label>
            <select value={selectedMonth} onChange={e => { setSelectedMonth(Number(e.target.value)); setRows([]); setSearched(false); }}
              disabled={monthsForYear.length === 0}
              style={{ height: "36px", padding: "0 12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: monthsForYear.length === 0 ? CSS.mutedFg : CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "12px", outline: "none", cursor: monthsForYear.length === 0 ? "not-allowed" : "pointer" }}>
              {monthsForYear.length === 0
                ? <option>—</option>
                : monthsForYear.map(m => <option key={m} value={m}>{MONTHS[m - 1]}</option>)
              }
            </select>
          </div>

          {/* Year */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Año</label>
            <select value={selectedYear} onChange={e => { setSelectedYear(Number(e.target.value)); setRows([]); setSearched(false); }}
              disabled={availableYears.length === 0}
              style={{ height: "36px", padding: "0 12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: availableYears.length === 0 ? CSS.mutedFg : CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "12px", outline: "none", cursor: availableYears.length === 0 ? "not-allowed" : "pointer" }}>
              {availableYears.length === 0
                ? <option>—</option>
                : availableYears.map(y => <option key={y} value={y}>{y}</option>)
              }
            </select>
          </div>

          <button onClick={doSearch} disabled={!selectedGuide || loading}
            style={{ height: "36px", padding: "0 22px", borderRadius: "8px", border: "none", background: (!selectedGuide || loading) ? CSS.muted : BLUE, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: (!selectedGuide || loading) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 150ms" }}>
            {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={13} />}
            {loading ? "Buscando..." : "Buscar"}
          </button>
          {searched && (
            <button onClick={() => {
              setSelectedGuide(""); setGuideSearch(""); setAvailableMonths({});
              setRows([]); setSearched(false);
              try { sessionStorage.removeItem(SESSION_KEY); } catch {}
            }}
              style={{ height: "36px", padding: "0 16px", borderRadius: "8px", border: `1px solid ${CSS.border}`, background: "transparent", color: CSS.mutedFg, fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 150ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = RED + "66"; (e.currentTarget as HTMLButtonElement).style.color = RED; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = CSS.border; (e.currentTarget as HTMLButtonElement).style.color = CSS.mutedFg; }}
            >
              <X size={12} />
              Limpiar
            </button>
          )}
        </div>

        {/* Results */}
        {searched && (
          <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", overflow: "hidden" }}>
            {/* Title bar */}
            <div style={{ background: CSS.subtle, borderBottom: `1px solid ${CSS.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>
                {selectedGuide} · {MONTHS[selectedMonth - 1]} {selectedYear}
              </span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg }}>
                {rows.length} file{rows.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 70px 130px 140px 120px", padding: "10px 20px", borderBottom: `1px solid ${CSS.border}`, background: CSS.subtle }}>
              {["N° FILE", "NOMBRE PAX", "N° PAX", "TOTAL", "ESTADO", "ACCIONES"].map(h => (
                <span key={h} style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>{h}</span>
              ))}
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>
                  Sin files para {selectedGuide} en {MONTHS[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
            ) : rows.map((row, i) => {
              const liq = row.liq;
              return (
                <div key={row.fileNumber} style={{ display: "grid", gridTemplateColumns: "130px 1fr 70px 130px 140px 120px", padding: "14px 20px", borderBottom: i < rows.length - 1 ? `1px solid ${CSS.border}` : "none", alignItems: "center" }}>

                  {/* N° File */}
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: CSS.fg }}>
                    {row.fileNumber}
                  </span>

                  {/* Nombre Pax */}
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: CSS.fg }}>
                    {row.paxName || "—"}
                  </span>

                  {/* N° Pax */}
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: CSS.fg }}>
                    {row.paxCount || "—"}
                  </span>

                  {/* Total */}
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: liq ? GREEN : CSS.mutedFg }}>
                    {liq ? formatMoney(liq.total) : "—"}
                  </span>

                  {/* Status */}
                  <div><StatusBadge status={row.liqStatus} /></div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {row.liqStatus === 'SIN LIQUIDAR' && (
                      <IconBtn onClick={() => setLiqTarget(row)} title="Generar liquidación" color={GREEN}>
                        <Receipt size={14} />
                      </IconBtn>
                    )}
                    {(row.liqStatus === 'SOLICITADO' || row.liqStatus === 'PAGADO') && liq && (
                      <>
                        {row.liqStatus === 'SOLICITADO' && (
                          <IconBtn onClick={() => setEditLiqId(liq.id)} title="Editar" color={AMBER}>
                            <Pencil size={13} />
                          </IconBtn>
                        )}
                        <IconBtn onClick={() => handlePrint(liq)} title="Imprimir PDF" color={BLUE} disabled={printingId === liq.id}>
                          {printingId === liq.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Printer size={13} />}
                        </IconBtn>
                      </>
                    )}
                    {row.liqStatus === 'SOLICITADO' && liq && (
                      <IconBtn onClick={() => setPayTarget(liq)} title="Marcar como pagado" color={GREEN}>
                        <CheckCircle2 size={14} />
                      </IconBtn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate modal */}
      {liqTarget && (
        <GenerateLiqModal
          fileRow={liqTarget}
          guideName={selectedGuide}
          suggested={suggestedIdioma}
          criteriaRules={criteriaRules}
          onSave={handleSaveLiq}
          onCancel={() => setLiqTarget(null)}
          saving={generating}
        />
      )}

      {/* Edit modal */}
      {editLiqId && (
        <EditLiqModal
          liqId={editLiqId}
          onSaved={() => { setEditLiqId(null); silentRefresh(); }}
          onCancel={() => setEditLiqId(null)}
        />
      )}

      {/* Pay modal */}
      {payTarget && (
        <PayModal liq={payTarget} onConfirm={handlePay} onCancel={() => setPayTarget(null)} loading={paying} />
      )}

      <LiquidationPDFPreviewModal
        open={!!pdfPreview}
        onClose={() => { if (pdfPreview) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        blobUrl={pdfPreview?.url ?? null}
        fileName={pdfPreview?.fileName ?? ""}
      />
    </div>
  );
}
