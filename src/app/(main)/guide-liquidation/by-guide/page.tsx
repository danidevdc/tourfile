"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Pencil, CheckCircle2, Loader2, Search } from "lucide-react";
import {
  getAllGuideNames,
  getOrdersByGuideAndMonth,
  getLiquidationsByGuide,
  payLiquidation,
  type GuideLiquidation,
} from "@/lib/guideLiquidationService";
import {
  getLiquidationCriteria,
  getSuggestedIdioma,
  applyBestCriteriaRule,
  IDIOMAS, IDIOMA_LABELS, IDIOMA_COLORS,
  type Idioma, type LiquidationCriteriaRule,
} from "@/lib/guideLiquidationCriteriaService";
import { saveLiquidation } from "@/lib/guideLiquidationService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const CSS = {
  bg:       "hsl(var(--background))",
  card:     "hsl(var(--card))",
  border:   "hsl(var(--border))",
  muted:    "hsl(var(--muted))",
  mutedFg:  "hsl(var(--muted-foreground))",
  fg:       "hsl(var(--foreground))",
  subtle:   "hsl(var(--muted) / 0.4)",
};
const BLUE   = "#0991ea";
const GREEN  = "#16a34a";
const AMBER  = "#f59e0b";
const RED    = "#ef4444";

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const YEARS = [2025, 2026];

type OrderRow = {
  orderId: string;
  fileNumber: string;
  orderName: string;
  fecha: string;
  hora: string;
  servicio: string;
  paxName: string;
  paxCount: number;
  hasLiquidation: boolean;
};

type LiqStatus = 'SIN LIQUIDAR' | 'SOLICITADO' | 'PAGADO';

type EnrichedRow = OrderRow & {
  liqStatus: LiqStatus;
  liq?: GuideLiquidation;
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LiqStatus }) {
  const color = status === 'PAGADO' ? GREEN : status === 'SOLICITADO' ? AMBER : RED;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "4px",
      border: `1px solid ${color}55`,
      background: `${color}14`,
      fontFamily: "'Space Mono', monospace", fontSize: "9px",
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
      color, whiteSpace: "nowrap" as const,
    }}>
      <span style={{
        width: "5px", height: "5px", borderRadius: "50%",
        background: color, display: "inline-block", flexShrink: 0,
        animation: status === 'SOLICITADO' ? "nd-pulse 2.4s ease-in-out infinite" : "none",
      }} />
      {status}
    </span>
  );
}

// ── Idioma selector ───────────────────────────────────────────────────────────
function IdiomaSelector({ value, onChange, suggested, disabled }: {
  value: Idioma | ""; onChange: (v: Idioma) => void; suggested: Idioma | null; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>
          Idioma del guía
        </span>
        {suggested && !value && (
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: IDIOMA_COLORS[suggested], letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "4px" }}>
            <Sparkles size={10} /> sugerido: {IDIOMA_LABELS[suggested]}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
        {IDIOMAS.map((idioma) => {
          const color = IDIOMA_COLORS[idioma];
          const isSelected = value === idioma;
          const isSuggested = suggested === idioma && !value;
          return (
            <button key={idioma} type="button" disabled={disabled} onClick={() => onChange(idioma)} style={{
              padding: "5px 12px", borderRadius: "999px",
              border: `1.5px solid ${isSelected ? color : isSuggested ? `${color}88` : CSS.border}`,
              background: isSelected ? `${color}18` : isSuggested ? `${color}08` : "transparent",
              color: isSelected ? color : isSuggested ? color : CSS.mutedFg,
              fontFamily: "'Space Mono', monospace", fontSize: "10px",
              fontWeight: isSelected ? 700 : 400, letterSpacing: "0.06em",
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 150ms ease-out", opacity: disabled ? 0.5 : 1,
              display: "flex", alignItems: "center", gap: "5px",
            }}>
              {isSuggested && <Sparkles size={9} />}
              {IDIOMA_LABELS[idioma]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Pay modal ─────────────────────────────────────────────────────────────────
function PayModal({ liq, onConfirm, onCancel, loading }: {
  liq: GuideLiquidation; onConfirm: (date: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "12px", padding: "28px 32px", width: "360px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: CSS.fg, marginBottom: "6px" }}>
            Confirmar pago
          </p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em" }}>
            {liq.guideName} · {liq.liquidationNumber}
          </p>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, color: GREEN, marginTop: "10px" }}>
            Bs. {fmt(liq.total)}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>
            Fecha de pago
          </label>
          <input
            type="date"
            value={payDate}
            onChange={e => setPayDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "13px", outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={loading} style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: `1px solid ${CSS.border}`, background: "transparent", color: CSS.mutedFg, fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(payDate)} disabled={loading || !payDate} style={{ height: "36px", padding: "0 20px", borderRadius: "8px", border: "none", background: GREEN, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            Confirmar pago
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New liquidation modal (idioma picker + confirm) ───────────────────────────
function NewLiqModal({ guideName, fileNumber, month, year, onConfirm, onCancel, loading, suggested, criteriaRules }: {
  guideName: string; fileNumber: string; month: number; year: number;
  onConfirm: (idioma: Idioma) => void; onCancel: () => void; loading: boolean;
  suggested: Idioma | null; criteriaRules: LiquidationCriteriaRule[];
}) {
  const [idioma, setIdioma] = useState<Idioma | "">(suggested ?? "");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "12px", padding: "28px 32px", width: "480px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: CSS.fg, marginBottom: "4px" }}>
            Generar liquidación
          </p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em" }}>
            {guideName} · File {fileNumber} · {MONTHS[month - 1]} {year}
          </p>
        </div>
        <IdiomaSelector value={idioma} onChange={setIdioma} suggested={suggested} />
        {criteriaRules.length === 0 && (
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: AMBER, letterSpacing: "0.04em" }}>
            ⚠ Sin reglas de criterios — los montos quedarán en 0. Configurá el Motor de Criterios primero.
          </p>
        )}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={loading} style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: `1px solid ${CSS.border}`, background: "transparent", color: CSS.mutedFg, fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={() => idioma && onConfirm(idioma as Idioma)} disabled={loading || !idioma} style={{ height: "36px", padding: "0 20px", borderRadius: "8px", border: "none", background: !idioma ? CSS.muted : GREEN, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: (loading || !idioma) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            Generar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiquidationByGuidePage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [guides, setGuides] = useState<string[]>([]);
  const [guideSearch, setGuideSearch] = useState("");
  const [selectedGuide, setSelectedGuide] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [criteriaRules, setCriteriaRules] = useState<LiquidationCriteriaRule[]>([]);
  const [suggestedIdioma, setSuggestedIdioma] = useState<Idioma | null>(null);

  // Modals
  const [payTarget, setPayTarget] = useState<GuideLiquidation | null>(null);
  const [paying, setPaying] = useState(false);
  const [newLiqTarget, setNewLiqTarget] = useState<{ fileNumber: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  // PDF preview
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    getAllGuideNames().then(setGuides).catch(console.error);
    getLiquidationCriteria().then(r => { if (r) setCriteriaRules(r); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedGuide) { setSuggestedIdioma(null); return; }
    getSuggestedIdioma(selectedGuide).then(setSuggestedIdioma).catch(console.error);
  }, [selectedGuide]);

  const filteredGuides = guideSearch
    ? guides.filter(g => g.toLowerCase().includes(guideSearch.toLowerCase()))
    : guides;

  const handleSearch = useCallback(async () => {
    if (!selectedGuide) return;
    setLoading(true);
    setSearched(false);
    try {
      const [orderRows, liqList] = await Promise.all([
        getOrdersByGuideAndMonth(selectedGuide, selectedMonth, selectedYear),
        getLiquidationsByGuide(selectedGuide),
      ]);

      const enriched: EnrichedRow[] = orderRows.map(row => {
        // Find a liquidation that covers this order's file
        const liq = liqList.find(l =>
          l.fileNumber.replace(/^CTF/i, '').trim() === row.fileNumber.replace(/^CTF/i, '').trim()
        );
        let liqStatus: LiqStatus = 'SIN LIQUIDAR';
        if (liq) {
          if (liq.status === 'Liquidado' && (liq as any).paymentDate) {
            liqStatus = 'PAGADO';
          } else if (liq.status === 'Liquidado') {
            liqStatus = 'SOLICITADO';
          }
        }
        return { ...row, liqStatus, liq };
      });

      setRows(enriched);
      setSearched(true);
    } catch (e) {
      console.error(e);
      toast({ title: "Error al buscar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedGuide, selectedMonth, selectedYear, toast]);

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
      toast({ title: "Pago registrado", description: `${payTarget.guideName} · ${payTarget.liquidationNumber}`, variant: "success" as any });
      setPayTarget(null);
      await handleSearch();
    } catch (e) {
      toast({ title: "Error al registrar pago", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const handleGenerateLiq = async (idioma: Idioma) => {
    if (!newLiqTarget || !currentUser) return;
    setGenerating(true);
    try {
      // Get all order rows for this file
      const fileRows = rows.filter(r => r.fileNumber.replace(/^CTF/i, '').trim() === newLiqTarget.fileNumber.replace(/^CTF/i, '').trim());
      const items = fileRows.map(r => ({
        serviceOrderId: r.orderId,
        fileNumber: r.fileNumber,
        fecha: r.fecha,
        hora: r.hora,
        servicio: r.servicio,
        paxName: r.paxName,
        paxCount: r.paxCount,
        monto: applyBestCriteriaRule(criteriaRules, { servicio: r.servicio, hora: r.hora, paxCount: r.paxCount }, idioma) ?? 0,
        checked: true,
      }));

      await saveLiquidation({
        fileNumber: newLiqTarget.fileNumber,
        guideId: selectedGuide,
        guideName: selectedGuide,
        paxName: fileRows[0]?.paxName ?? '',
        paxCount: fileRows[0]?.paxCount ?? 0,
        items,
        createdBy: currentUser.email ?? currentUser.uid,
      });

      toast({ title: "Liquidación generada", description: `File ${newLiqTarget.fileNumber} · ${IDIOMA_LABELS[idioma]}`, variant: "success" as any });
      setNewLiqTarget(null);
      await handleSearch();
    } catch (e) {
      console.error(e);
      toast({ title: "Error al generar liquidación", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });
  const COL_HEADERS = ["FECHA", "FILE", "SERVICIO", "PAX", "TOTAL", "ESTADO", "ACCIONES"];
  const GRID = "90px 90px 1fr 60px 110px 120px 120px";

  return (
    <div style={{ minHeight: "100vh", background: CSS.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{`
        @keyframes nd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: "24px" }}>

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
              Servicios del mes · estado de liquidación · pagos
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", padding: "20px 24px", display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-end" }}>

          {/* Guide selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 220px", minWidth: "200px" }}>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Guía</label>
            <div style={{ position: "relative" as const }}>
              <Search size={13} color={CSS.mutedFg} style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                placeholder="Buscar guía..."
                value={guideSearch}
                onChange={e => { setGuideSearch(e.target.value); setSelectedGuide(""); }}
                style={{ width: "100%", paddingLeft: "32px", paddingRight: "10px", paddingTop: "8px", paddingBottom: "8px", fontFamily: "'Space Mono', monospace", fontSize: "12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, outline: "none", boxSizing: "border-box" as const }}
              />
            </div>
            {guideSearch && filteredGuides.length > 0 && !selectedGuide && (
              <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "8px", maxHeight: "180px", overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
                {filteredGuides.map(g => (
                  <button key={g} onClick={() => { setSelectedGuide(g); setGuideSearch(g); }} style={{ width: "100%", textAlign: "left" as const, padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: CSS.fg }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = `${BLUE}0a`}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
                  >{g}</button>
                ))}
              </div>
            )}
            {selectedGuide && (
              <div style={{ padding: "6px 10px", borderRadius: "6px", border: `1px solid ${BLUE}44`, background: `${BLUE}0e`, fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 600, color: BLUE }}>
                {selectedGuide}
              </div>
            )}
          </div>

          {/* Month */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Mes</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "12px", outline: "none", cursor: "pointer" }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>

          {/* Year */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Año</label>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "12px", outline: "none", cursor: "pointer" }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!selectedGuide || loading}
            style={{ height: "38px", padding: "0 22px", borderRadius: "8px", border: "none", background: !selectedGuide || loading ? CSS.muted : BLUE, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: (!selectedGuide || loading) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 150ms" }}
          >
            {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={13} />}
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {/* Results table */}
        {searched && (
          <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", overflow: "hidden" }}>
            {/* Title bar */}
            <div style={{ background: CSS.subtle, borderBottom: `1px solid ${CSS.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: BLUE, fontWeight: 700 }}>
                {selectedGuide} · {MONTHS[selectedMonth - 1]} {selectedYear}
              </span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg }}>
                {rows.length} servicio{rows.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "10px 20px", borderBottom: `1px solid ${CSS.border}`, background: CSS.subtle }}>
              {COL_HEADERS.map(h => (
                <span key={h} style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {rows.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>
                  Sin servicios para {selectedGuide} en {MONTHS[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
            ) : (
              rows.map((row, i) => {
                const liq = row.liq;
                const total = liq ? liq.total : 0;
                return (
                  <div key={`${row.orderId}-${i}`} style={{ display: "grid", gridTemplateColumns: GRID, padding: "12px 20px", borderBottom: i < rows.length - 1 ? `1px solid ${CSS.border}` : "none", alignItems: "center" }}>
                    {/* Fecha */}
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.fg, letterSpacing: "0.04em" }}>{row.fecha}</span>

                    {/* File */}
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: BLUE, letterSpacing: "0.04em" }}>{row.fileNumber}</span>

                    {/* Servicio */}
                    <div>
                      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 600, color: CSS.fg }}>{row.servicio}</p>
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg, letterSpacing: "0.03em", marginTop: "1px" }}>{row.hora || "—"}</p>
                    </div>

                    {/* Pax */}
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.fg }}>{row.paxCount}</span>

                    {/* Total */}
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: liq ? CSS.fg : CSS.mutedFg }}>
                      {liq ? `Bs. ${fmt(total)}` : "—"}
                    </span>

                    {/* Status */}
                    <StatusBadge status={row.liqStatus} />

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {row.liqStatus === 'SIN LIQUIDAR' && (
                        <button
                          onClick={() => setNewLiqTarget({ fileNumber: row.fileNumber })}
                          title="Generar liquidación"
                          style={{ height: "32px", padding: "0 12px", borderRadius: "6px", border: `1px solid ${GREEN}44`, background: `${GREEN}0d`, color: GREEN, fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.04em", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", transition: "all 150ms", whiteSpace: "nowrap" as const }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${GREEN}20`; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${GREEN}0d`; }}
                        >
                          Bs.
                        </button>
                      )}
                      {(row.liqStatus === 'SOLICITADO' || row.liqStatus === 'PAGADO') && liq && (
                        <>
                          <button onClick={() => router.push(`/guide-liquidation/edit/${liq.id}`)} title="Editar" style={{ width: "32px", height: "32px", borderRadius: "6px", border: `1px solid ${AMBER}28`, background: `${AMBER}0d`, color: AMBER, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${AMBER}20`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${AMBER}0d`; }}
                          ><Pencil size={13} /></button>
                          <button onClick={() => handlePrint(liq)} disabled={printingId === liq.id} title="Imprimir PDF" style={{ width: "32px", height: "32px", borderRadius: "6px", border: `1px solid ${BLUE}28`, background: `${BLUE}0d`, color: BLUE, display: "flex", alignItems: "center", justifyContent: "center", cursor: printingId === liq.id ? "wait" : "pointer", transition: "all 150ms" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${BLUE}20`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${BLUE}0d`; }}
                          >{printingId === liq.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Printer size={13} />}</button>
                        </>
                      )}
                      {row.liqStatus === 'SOLICITADO' && liq && (
                        <button onClick={() => setPayTarget(liq)} title="Marcar como pagado" style={{ width: "32px", height: "32px", borderRadius: "6px", border: `1px solid ${GREEN}44`, background: `${GREEN}0d`, color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${GREEN}20`; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${GREEN}0d`; }}
                        ><CheckCircle2 size={14} /></button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {payTarget && (
        <PayModal
          liq={payTarget}
          onConfirm={handlePay}
          onCancel={() => setPayTarget(null)}
          loading={paying}
        />
      )}
      {newLiqTarget && (
        <NewLiqModal
          guideName={selectedGuide}
          fileNumber={newLiqTarget.fileNumber}
          month={selectedMonth}
          year={selectedYear}
          onConfirm={handleGenerateLiq}
          onCancel={() => setNewLiqTarget(null)}
          loading={generating}
          suggested={suggestedIdioma}
          criteriaRules={criteriaRules}
        />
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
