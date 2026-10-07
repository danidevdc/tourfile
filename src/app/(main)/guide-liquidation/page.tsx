"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, FileText, TrendingUp, Calendar, Users, Printer, History, Settings2, Pencil, UserCheck, CheckCircle2, Loader2, X, Trash2 } from "lucide-react";
import { getDashboardStats, payLiquidation, deleteLiquidation, getLiquidationDisplayStatus, type LiquidationDashboardStats, type GuideLiquidation } from "@/lib/guideLiquidationService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney } from "@/config/agency";

const TOKEN = {
  blue:   "#0991ea",
  cyan:   "#0891b2",
  green:  "#16a34a",
  amber:  "#f59e0b",
  purple: "#7c3aed",
};

// All surface/text colors use CSS variables so they respond to dark mode
const CSS = {
  bg:            "hsl(var(--background))",
  card:          "hsl(var(--card))",
  cardFg:        "hsl(var(--card-foreground))",
  border:        "hsl(var(--border))",
  muted:         "hsl(var(--muted))",
  mutedFg:       "hsl(var(--muted-foreground))",
  fg:            "hsl(var(--foreground))",
  subtleBg:      "hsl(var(--muted) / 0.4)",
};

function StatCard({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div style={{
      background: CSS.card,
      border: `1px solid ${CSS.border}`,
      borderRadius: "10px",
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      flex: "1 1 180px",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{
          width: "30px", height: "30px", borderRadius: "8px",
          background: `${accent}22`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={15} color={accent} />
        </div>
        <span style={{
          fontFamily: "'Space Mono', monospace", fontSize: "10px",
          letterSpacing: "0.08em", textTransform: "uppercase" as const,
          color: CSS.mutedFg,
        }}>{label}</span>
      </div>
      <div>
        <span style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px",
          fontWeight: 700, letterSpacing: "-0.02em", color: accent, lineHeight: 1,
        }}>{value}</span>
        {sub && <p style={{
          fontFamily: "'Space Mono', monospace", fontSize: "10px",
          letterSpacing: "0.04em", color: CSS.mutedFg, marginTop: "4px",
        }}>{sub}</p>}
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon, title, description, accent, onClick, primary,
}: {
  icon: React.ElementType; title: string; description: string;
  accent: string; onClick: () => void; primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        flex: primary ? "1.4 1 260px" : "1 1 220px",
        background: primary
          ? (hovered ? `${accent}22` : `${accent}14`)
          : (hovered ? `${accent}18` : `${accent}0e`),
        border: `${primary ? 2 : 1.5}px solid ${accent}${primary ? (hovered ? "aa" : "66") : (hovered ? "77" : "33")}`,
        borderRadius: "10px",
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        cursor: "pointer",
        transition: "all 150ms ease-out",
        textAlign: "left" as const,
        minWidth: 0,
        boxShadow: primary ? `0 1px 0 ${accent}18` : "none",
      }}
    >
      {primary && (
        <span style={{
          position: "absolute", top: "-9px", left: "20px",
          background: accent, color: "white",
          fontFamily: "'Space Mono', monospace", fontSize: "8.5px",
          fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
          padding: "2px 8px", borderRadius: "999px",
        }}>
          Más usado
        </span>
      )}
      <div style={{
        width: "44px", height: "44px", borderRadius: "10px",
        background: `${accent}28`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={20} color={accent} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif", fontSize: "15px",
          fontWeight: 700, color: accent, marginBottom: "3px",
        }}>{title}</p>
        <p style={{
          fontFamily: "'Space Mono', monospace", fontSize: "10px",
          letterSpacing: "0.04em", color: CSS.mutedFg,
          whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
        }}>{description}</p>
      </div>
    </button>
  );
}

function StatusBadge({ liq }: { liq: GuideLiquidation }) {
  const isPagado = getLiquidationDisplayStatus(liq) === "PAGADO";
  const label    = isPagado ? "PAGADO" : "SOLICITADO";
  // Border/dot use the brand amber; text uses a darker shade — #f59e0b fails
  // WCAG AA contrast (2.15:1) as small bold text on light backgrounds.
  const color     = isPagado ? "#16a34a" : "#f59e0b";
  const textColor = isPagado ? "#16a34a" : "#b45309";

  if (isPagado) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "3px 10px", borderRadius: "4px",
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
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "4px",
      border: `1px solid ${color}55`, background: `${color}14`,
      fontFamily: "'Space Mono', monospace", fontSize: "9px",
      fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: textColor, whiteSpace: "nowrap" as const,
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0, animation: "nd-pulse 2s ease-in-out infinite" }} />
      {label}
    </span>
  );
}

function DeleteModal({ liq, onConfirm, onCancel, loading }: {
  liq: GuideLiquidation; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
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
              {formatMoney(liq.total)}
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

function PayModal({ liq, onConfirm, onCancel, loading }: {
  liq: GuideLiquidation; onConfirm: (date: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

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
              {formatMoney(liq.total)}
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

function PrintButton({ liq, printingId, onPrint }: {
  liq: GuideLiquidation;
  printingId: string | null;
  onPrint: (liq: GuideLiquidation) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const busy = printingId === liq.id;

  return (
    <button
      onClick={() => onPrint(liq)}
      disabled={busy}
      title="Imprimir PDF"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "34px", height: "34px", borderRadius: "8px",
        border: `1px solid ${TOKEN.blue}${hovered ? "66" : "28"}`,
        background: busy
          ? CSS.muted
          : hovered
            ? `${TOKEN.blue}18`
            : `${TOKEN.blue}0d`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: busy ? "wait" : "pointer",
        transition: "all 150ms ease-out",
        color: busy ? CSS.mutedFg : TOKEN.blue,
        flexShrink: 0,
      }}
    >
      <Printer size={14} style={{ opacity: busy ? 0.4 : 1, transition: "opacity 150ms" }} />
    </button>
  );
}

export default function GuideLiquidationDashboardPage() {
  const router = useRouter();
  const { isCurrentUserAdmin } = useAuth();
  const [stats, setStats] = useState<LiquidationDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<GuideLiquidation | null>(null);
  const [paying, setPaying] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GuideLiquidation | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

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
      // Optimistic update: mark the row as paid in local state
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recientes: prev.recientes.map(l =>
            l.id === payTarget.id ? { ...l, paymentDate: date } : l
          ),
        };
      });
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
      // Optimistic update: remove from local state
      setStats(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recientes: prev.recientes.filter(l => l.id !== deleteTarget.id),
          total: Math.max(0, prev.total - 1),
          montoTotal: prev.montoTotal - deleteTarget.total,
        };
      });
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const fmtServiceMonth = (liq: GuideLiquidation): string => {
    const first = liq.items?.[0]?.fecha;
    if (!first) return "—";
    const parts = first.split("/").map(Number);
    const [, m] = parts;
    let [, , y] = parts;
    if (y < 100) y += 2000;
    return `${MONTHS_ES[m - 1].slice(0, 3).toUpperCase()} ${y}`;
  };

  const COL_HEADERS = ["N°", "Guía", "Mes", "File", "Total", "Estado", ""];
  const GRID = "90px 1fr 80px 120px 110px 130px 160px";

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

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              onClick={() => router.push("/home")}
              style={{
                width: "40px", height: "40px", borderRadius: "50%",
                border: `1px solid ${CSS.border}`,
                background: CSS.card,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                color: CSS.mutedFg, transition: "border-color 150ms",
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px",
                fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2,
                color: CSS.fg,
              }}>
                Liquidación de Guías
              </h1>
              <p style={{
                fontFamily: "'Space Mono', monospace", fontSize: "11px",
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: CSS.mutedFg, marginTop: "2px",
              }}>
                Dashboard · resumen y acciones
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/guide-liquidation/new")}
            style={{
              height: "36px", padding: "0 18px", borderRadius: "999px",
              fontFamily: "'Space Mono', monospace", fontSize: "11px",
              letterSpacing: "0.06em", textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: "6px",
              border: `1px solid ${TOKEN.blue}44`,
              background: `${TOKEN.blue}14`,
              color: TOKEN.blue, cursor: "pointer",
              transition: "all 150ms ease-out",
            }}
          >
            <Plus size={13} />
            Nueva Liquidación
          </button>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <StatCard icon={FileText} label="Total Liquidaciones" value={loading ? "—" : String(stats?.total ?? 0)} sub="todas las liquidaciones" accent={TOKEN.blue} />
          <StatCard icon={TrendingUp} label="Monto Total" value={loading ? "—" : formatMoney(stats?.montoTotal ?? 0)} sub="suma de liquidaciones" accent="#7c3aed" />
          <StatCard icon={Calendar} label="Este Mes" value={loading ? "—" : String(stats?.esteMes ?? 0)} sub="liquidaciones del mes" accent={TOKEN.amber} />
          <StatCard icon={Users} label="Guías Liquidados" value={loading ? "—" : String(stats?.guiasUnicas ?? 0)} sub="guías únicos" accent={TOKEN.green} />
        </div>

        {/* ── Action cards ── */}
        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
          <ActionCard icon={Plus} title="Generar Liquidación" description="Buscá por file y guía, ingresá montos y guardá" accent={TOKEN.green} primary onClick={() => router.push("/guide-liquidation/new")} />
          <ActionCard icon={UserCheck} title="Liquidaciones por Guía" description="Ver servicios del mes por guía · estado y pagos" accent={TOKEN.cyan} onClick={() => router.push("/guide-liquidation/by-guide")} />
          <ActionCard icon={History} title="Historial de Liquidaciones" description="Consultá y filtrá todas las liquidaciones guardadas" accent={TOKEN.amber} onClick={() => router.push("/guide-liquidation/history")} />
          <ActionCard icon={Settings2} title="Motor de Criterios" description="Configurá precios automáticos por servicio, hora e idioma" accent={TOKEN.blue} onClick={() => router.push("/guide-liquidation/criteria")} />
        </div>

        {/* ── Recent table ── */}
        <div style={{
          background: CSS.card,
          border: `1px solid ${CSS.border}`,
          borderRadius: "10px", overflow: "hidden",
        }}>
          {/* Table title bar */}
          <div style={{
            background: CSS.subtleBg,
            borderBottom: `1px solid ${CSS.border}`,
            padding: "14px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{
              fontFamily: "'Space Mono', monospace", fontSize: "11px",
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: TOKEN.blue, fontWeight: 700,
            }}>
              Liquidaciones Recientes
            </span>
            {stats && stats.total > 8 && (
              <button
                onClick={() => router.push("/guide-liquidation/history")}
                style={{
                  fontFamily: "'Space Mono', monospace", fontSize: "10px",
                  color: TOKEN.blue, letterSpacing: "0.04em",
                  background: "none", border: "none", cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Ver todas ({stats.total}) →
              </button>
            )}
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: GRID,
            padding: "10px 20px",
            borderBottom: `1px solid ${CSS.border}`,
            background: CSS.subtleBg,
          }}>
            {COL_HEADERS.map((col) => (
              <span key={col} style={{
                fontFamily: "'Space Mono', monospace", fontSize: "9px",
                letterSpacing: "0.1em", textTransform: "uppercase" as const,
                color: CSS.mutedFg,
              }}>{col}</span>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>Cargando...</span>
            </div>
          ) : !stats || stats.recientes.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>No hay liquidaciones registradas todavía</span>
            </div>
          ) : (
            stats.recientes.map((liq, i) => (
              <div
                key={liq.id}
                style={{
                  display: "grid", gridTemplateColumns: GRID,
                  padding: "13px 20px",
                  borderBottom: i < stats.recientes.length - 1 ? `1px solid ${CSS.border}` : "none",
                  alignItems: "center",
                  gap: "0px",
                }}
              >
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: TOKEN.blue, letterSpacing: "0.04em" }}>
                  {liq.liquidationNumber}
                </span>
                <div>
                  <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 600, color: CSS.fg }}>{liq.guideName}</p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg, letterSpacing: "0.04em", marginTop: "2px" }}>{liq.paxName || "—"}</p>
                </div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 400, color: "#3b82f6" }}>
                  {fmtServiceMonth(liq)}
                </span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.fg, letterSpacing: "0.04em" }}>
                  {liq.fileNumber}
                </span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: CSS.fg }}>
                  {formatMoney(liq.total)}
                </span>
                {/* Estado + gap visual antes del botón */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <StatusBadge liq={liq} />
                </div>
                {/* Acciones: pagar + editar + imprimir + eliminar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                  {!liq.paymentDate && (
                    <button
                      onClick={() => router.push(`/guide-liquidation/edit/${liq.id}`)}
                      title="Editar liquidación"
                      style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${TOKEN.amber}28`, background: `${TOKEN.amber}0d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms ease-out", color: TOKEN.amber, flexShrink: 0 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.amber}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.amber}66`; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.amber}0d`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.amber}28`; }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <PrintButton liq={liq} printingId={printingId} onPrint={handlePrint} />
                  {!liq.paymentDate && (
                    <button
                      onClick={() => setPayTarget(liq)}
                      title="Marcar como pagado"
                      style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${TOKEN.green}28`, background: `${TOKEN.green}0d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms ease-out", color: TOKEN.green, flexShrink: 0 }}
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
                      style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid #ef444428`, background: `#ef44440d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms ease-out", color: "#ef4444", flexShrink: 0 }}
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
