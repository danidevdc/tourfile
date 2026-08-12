"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Search, Pencil, X, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { getAllLiquidations, payLiquidation, deleteLiquidation, type GuideLiquidation } from "@/lib/guideLiquidationService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";
import { useAuth } from "@/hooks/useAuth";

const TOKEN = { blue: "#0991ea", amber: "#f59e0b", green: "#16a34a" };
const CSS = {
  bg: "hsl(var(--background))",
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  muted: "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
  subtleBg: "hsl(var(--muted) / 0.4)",
};

function PayModal({ liq, onConfirm, onCancel, loading }: {
  liq: GuideLiquidation; onConfirm: (date: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "12px", padding: "28px 32px", width: "360px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: CSS.fg, marginBottom: "6px" }}>Confirmar pago</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em" }}>
              {liq.guideName} · {liq.liquidationNumber}
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, color: TOKEN.green, marginTop: "10px" }}>
              Bs. {fmt(liq.total)}
            </p>
          </div>
          <button onClick={onCancel} style={{ width: "30px", height: "30px", borderRadius: "6px", border: "1px solid #ef444433", background: "#ef44440d", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Fecha de pago</label>
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "13px", outline: "none", width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={loading}
            style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(payDate)} disabled={loading || !payDate}
            style={{ height: "36px", padding: "0 20px", borderRadius: "8px", border: "none", background: TOKEN.green, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            Confirmar pago
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ liq }: { liq: GuideLiquidation }) {
  const isPagado = !!liq.paymentDate;
  const label    = isPagado ? "PAGADO" : "SOLICITADO";
  const color    = isPagado ? "#16a34a" : "#f59e0b";

  if (isPagado) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "3px 8px", borderRadius: "4px",
        border: "1px solid #16a34a44", background: "#16a34a0f",
        whiteSpace: "nowrap" as const, flexShrink: 0,
      }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#16a34a", display: "inline-block", flexShrink: 0 }} />
        <span className="nd-shimmer-badge" style={{
          fontFamily: "'Space Mono', monospace", fontSize: "9px",
          fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
        }}>
          PAGADO
        </span>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 8px", borderRadius: "4px", border: `1px solid ${color}55`, background: `${color}12`, fontFamily: "'Space Mono', monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0, animation: "nd-pulse 2s ease-in-out infinite" }} />
      {label}
    </span>
  );
}

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type StatusFilter = "PAGADO" | "SOLICITADO" | null;

function DeleteModal({ liq, onConfirm, onCancel, loading }: {
  liq: GuideLiquidation; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "12px", padding: "28px 32px", width: "380px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: CSS.fg, marginBottom: "6px" }}>Eliminar liquidación</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em" }}>
              {liq.guideName} · {liq.liquidationNumber}
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, color: "#ef4444", marginTop: "10px" }}>
              Bs. {fmt(liq.total)}
            </p>
          </div>
          <button onClick={onCancel} style={{ width: "30px", height: "30px", borderRadius: "6px", border: "1px solid #ef444433", background: "#ef44440d", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}>
            <X size={14} />
          </button>
        </div>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: CSS.mutedFg, lineHeight: 1.5 }}>
          ¿Estás seguro de que deseas eliminar esta liquidación? Esta acción no se puede deshacer.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={loading}
            style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: `1px solid ${CSS.border}`, background: "transparent", color: CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = CSS.border; (e.currentTarget as HTMLButtonElement).style.color = CSS.fg; }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ height: "36px", padding: "0 20px", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiquidationHistoryPage() {
  const router = useRouter();
  const { isCurrentUserAdmin } = useAuth();
  const [all, setAll] = useState<GuideLiquidation[]>([]);
  const [filtered, setFiltered] = useState<GuideLiquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<GuideLiquidation | null>(null);
  const [paying, setPaying] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GuideLiquidation | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAllLiquidations().then((data) => { setAll(data); setFiltered(data); }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.trim().toUpperCase();
    let result = all;

    // Status chip filter
    if (statusFilter === "PAGADO") result = result.filter(l => !!l.paymentDate);
    if (statusFilter === "SOLICITADO") result = result.filter(l => !l.paymentDate);

    // Text search — matches name, file, number, pax, month name, year
    if (q) {
      result = result.filter((l) => {
        const d = new Date(l.createdAt);
        const monthName = MONTHS_ES[d.getMonth()].toUpperCase();
        const year = d.getFullYear().toString();
        return (
          l.guideName.toUpperCase().includes(q) ||
          l.fileNumber.toUpperCase().includes(q) ||
          l.liquidationNumber.toUpperCase().includes(q) ||
          (l.paxName ?? "").toUpperCase().includes(q) ||
          monthName.includes(q) ||
          year.includes(q) ||
          fmtServiceMonth(l).includes(q)
        );
      });
    }

    setFiltered(result);
  }, [search, statusFilter, all]);

  const handlePrint = async (liq: GuideLiquidation) => {
    setPrintingId(liq.id);
    try {
      const url = await buildLiquidationPDFUrl(liq);
      const fileName = `Liquidacion-${liq.liquidationNumber}-${liq.fileNumber}-${liq.guideName.replace(/\s+/g, "_")}.pdf`;
      setPdfPreview({ url, fileName });
    } catch (e) {
      console.error(e);
    } finally {
      setPrintingId(null);
    }
  };

  const handlePay = async (date: string) => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await payLiquidation(payTarget.id, date);
      const update = (list: GuideLiquidation[]) =>
        list.map(l => l.id === payTarget.id ? { ...l, paymentDate: date } : l);
      setAll(prev => update(prev));
      setFiltered(prev => update(prev));
      setPayTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLiquidation(deleteTarget);
      const update = (list: GuideLiquidation[]) =>
        list.filter(l => l.id !== deleteTarget.id);
      setAll(prev => update(prev));
      setFiltered(prev => update(prev));
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: Date) => {
    try { return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
    catch { return "—"; }
  };
  const fmtPaymentDate = (s: string) => {
    // s is "YYYY-MM-DD" — parse directly to avoid UTC offset shifting the day
    const [y, m, d] = s.split("-");
    if (!y || !m || !d) return "—";
    return `${d}/${m}/${y}`;
  };
  const fmtServiceMonth = (liq: GuideLiquidation): string => {
    const first = liq.items?.[0]?.fecha;
    if (!first) return "—";
    const parts = first.split("/").map(Number);
    let [, m, y] = parts;
    if (y < 100) y += 2000;
    return `${MONTHS_ES[m - 1].slice(0, 3).toUpperCase()} ${y}`;
  };

  const GRID = "80px 1fr 90px 130px 76px 76px 110px 120px 140px";

  return (
    <div style={{ minHeight: "100vh", background: CSS.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{`
        @keyframes nd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
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
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "28px 28px 48px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button onClick={() => router.push("/guide-liquidation")} style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${CSS.border}`, background: CSS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: CSS.mutedFg }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", color: CSS.fg }}>Historial de Liquidaciones</h1>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: CSS.mutedFg, marginTop: "2px" }}>
                {loading ? "Cargando..." : `${filtered.length} de ${all.length} registros`}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" as const }}>
            {/* Status chips */}
            {(["PAGADO", "SOLICITADO"] as StatusFilter[]).map(s => {
              const active = statusFilter === s;
              const color = s === "PAGADO" ? TOKEN.green : TOKEN.amber;
              return (
                <button key={s} onClick={() => setStatusFilter(active ? null : s)}
                  style={{ height: "32px", padding: "0 12px", borderRadius: "999px", border: `1px solid ${active ? color : CSS.border}`, background: active ? `${color}14` : "transparent", fontFamily: "'Space Mono', monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", color: active ? color : CSS.mutedFg, cursor: "pointer", transition: "all 150ms", display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: active ? color : CSS.mutedFg, display: "inline-block", flexShrink: 0 }} />
                  {s}
                </button>
              );
            })}
            {/* Search input */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", border: `1px solid ${CSS.border}`, borderRadius: "8px", padding: "0 12px", background: CSS.card, height: "36px", minWidth: "220px" }}>
              <Search size={13} color={CSS.mutedFg} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Guía, file, mes, año..."
                style={{ border: "none", outline: "none", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.04em", color: CSS.fg, background: "transparent", width: "100%" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: CSS.mutedFg, display: "flex", padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "10px 20px", borderBottom: `1px solid ${CSS.border}`, background: CSS.subtleBg }}>
            {[
              { l1: "N°" },
              { l1: "Guía" },
              { l1: "Mes" },
              { l1: "File" },
              { l1: "Fecha", l2: "Solicitud" },
              { l1: "Fecha", l2: "Pago" },
              { l1: "Total" },
              { l1: "Estado" },
              { l1: "" },
            ].map(({ l1, l2 }, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>{l1}</span>
                {l2 && <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg, opacity: 0.6 }}>{l2}</span>}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>Cargando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>
                {(search || statusFilter) ? "Sin resultados para los filtros aplicados" : "No hay liquidaciones registradas"}
              </span>
            </div>
          ) : (
            filtered.map((liq, i) => (
              <div key={liq.id} style={{ display: "grid", gridTemplateColumns: GRID, padding: "13px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${CSS.border}` : "none", alignItems: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: TOKEN.blue, letterSpacing: "0.04em" }}>{liq.liquidationNumber}</span>
                <div>
                  <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 600, color: CSS.fg }}>{liq.guideName}</p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg, marginTop: "2px" }}>{liq.paxName || "—"}</p>
                </div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 400, color: "#3b82f6" }}>{fmtServiceMonth(liq)}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.fg }}>{liq.fileNumber}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg }}>{fmtDate(liq.createdAt)}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: liq.paymentDate ? TOKEN.green : CSS.mutedFg }}>
                  {liq.paymentDate ? fmtPaymentDate(liq.paymentDate) : "—"}
                </span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: CSS.fg }}>Bs. {fmt(liq.total)}</span>
                <div style={{ display: "flex", alignItems: "center" }}><StatusBadge liq={liq} /></div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                  {!liq.paymentDate && (
                    <button
                      onClick={() => router.push(`/guide-liquidation/edit/${liq.id}`)}
                      title="Editar liquidación"
                      style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${TOKEN.amber}28`, background: `${TOKEN.amber}0d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms", color: TOKEN.amber, flexShrink: 0 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.amber}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.amber}66`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.amber}0d`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.amber}28`; }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => handlePrint(liq)}
                    disabled={printingId === liq.id}
                    title="Imprimir PDF"
                    style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${TOKEN.blue}28`, background: printingId === liq.id ? CSS.muted : `${TOKEN.blue}0d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: printingId === liq.id ? "wait" : "pointer", transition: "all 150ms", color: printingId === liq.id ? CSS.mutedFg : TOKEN.blue, flexShrink: 0 }}
                    onMouseEnter={(e) => { if (printingId !== liq.id) { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.blue}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.blue}66`; } }}
                    onMouseLeave={(e) => { if (printingId !== liq.id) { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.blue}0d`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.blue}28`; } }}
                  >
                    <Printer size={13} />
                  </button>
                  {!liq.paymentDate && (
                    <button
                      onClick={() => setPayTarget(liq)}
                      title="Marcar como pagado"
                      style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${TOKEN.green}28`, background: `${TOKEN.green}0d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms", color: TOKEN.green, flexShrink: 0 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.green}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.green}66`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.green}0d`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.green}28`; }}
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  )}
                  {isCurrentUserAdmin && (
                    <button
                      onClick={() => setDeleteTarget(liq)}
                      title="Eliminar liquidación"
                      style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid #ef444428`, background: `#ef44440d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms", color: "#ef4444", flexShrink: 0 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `#ef444418`; (e.currentTarget as HTMLButtonElement).style.borderColor = `#ef444466`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `#ef44440d`; (e.currentTarget as HTMLButtonElement).style.borderColor = `#ef444428`; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <LiquidationPDFPreviewModal
        open={!!pdfPreview}
        onClose={() => { if (pdfPreview) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        blobUrl={pdfPreview?.url ?? null}
        fileName={pdfPreview?.fileName ?? ""}
      />

      {payTarget && (
        <PayModal liq={payTarget} onConfirm={handlePay} onCancel={() => setPayTarget(null)} loading={paying} />
      )}

      {deleteTarget && (
        <DeleteModal liq={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
      )}
    </div>
  );
}
