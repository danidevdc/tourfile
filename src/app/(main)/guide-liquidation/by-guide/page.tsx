"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Pencil, CheckCircle2, Loader2, Search, Receipt, X, Save } from "lucide-react";
import { Sparkles } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getAllGuideNames,
  getOrdersByGuideAndMonth,
  getLiquidationsByGuide,
  getLiquidationById,
  getServiceOrdersByFileAndGuide,
  getAvailableMonthsForGuide,
  payLiquidation,
  saveLiquidation,
  updateLiquidation,
  type GuideLiquidation,
  type GuideFileRow,
  type LiquidationItem,
  type GuideAvailableMonths,
} from "@/lib/guideLiquidationService";
import {
  getLiquidationCriteria,
  getSuggestedIdioma,
  applyBestCriteriaRule,
  IDIOMAS, IDIOMA_LABELS, IDIOMA_COLORS,
  type Idioma, type LiquidationCriteriaRule,
} from "@/lib/guideLiquidationCriteriaService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { GuideLiquidationTable } from "@/components/guide-liquidation/GuideLiquidationTable";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
const YEARS = [2025, 2026];

type LiqStatus = 'SIN LIQUIDAR' | 'SOLICITADO' | 'PAGADO';
type EnrichedFileRow = GuideFileRow & { liqStatus: LiqStatus; liq?: GuideLiquidation };

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LiqStatus }) {
  if (status === 'SIN LIQUIDAR') {
    return (
      <span className="nd-halo-badge" style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "3px 10px", borderRadius: "4px",
        border: `1px solid ${RED}55`, background: `${RED}14`,
        fontFamily: "'Space Mono', monospace", fontSize: "9px",
        fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
        color: RED, whiteSpace: "nowrap" as const,
      }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: RED, display: "inline-block", flexShrink: 0 }} />
        SIN LIQUIDAR
      </span>
    );
  }

  if (status === 'PAGADO') {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "3px 10px", borderRadius: "4px",
        border: "1px solid #16a34a44", background: "#16a34a0f",
        whiteSpace: "nowrap" as const, flexShrink: 0,
      }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: GREEN, display: "inline-block", flexShrink: 0 }} />
        <span className="nd-shimmer-badge" style={{
          fontFamily: "'Space Mono', monospace", fontSize: "9px",
          fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
        }}>
          PAGADO
        </span>
      </span>
    );
  }

  // SOLICITADO — punto ámbar parpadeando
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "4px",
      border: `1px solid ${AMBER}55`, background: `${AMBER}14`,
      fontFamily: "'Space Mono', monospace", fontSize: "9px",
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
      color: AMBER, whiteSpace: "nowrap" as const,
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: AMBER, display: "inline-block", flexShrink: 0, animation: "nd-pulse 2s ease-in-out infinite" }} />
      SOLICITADO
    </span>
  );
}

// ── Icon button helper ────────────────────────────────────────────────────────
function IconBtn({ onClick, title, color, disabled, children }: {
  onClick: () => void; title: string; color: string; disabled?: boolean; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "32px", height: "32px", borderRadius: "6px", border: `1px solid ${color}${hov ? "66" : "33"}`, background: hov ? `${color}1a` : `${color}0d`, color, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", transition: "all 150ms", opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      {children}
    </button>
  );
}

// ── Idioma pill selector ──────────────────────────────────────────────────────
function IdiomaPills({ value, onChange, suggested }: {
  value: Idioma | ""; onChange: (v: Idioma) => void; suggested: Idioma | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>
          Idioma del guía
        </span>
        {suggested && !value && (
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: IDIOMA_COLORS[suggested], display: "flex", alignItems: "center", gap: "3px" }}>
            <Sparkles size={9} /> sugerido: {IDIOMA_LABELS[suggested]}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
        {IDIOMAS.map(idioma => {
          const color = IDIOMA_COLORS[idioma];
          const sel = value === idioma;
          const sug = suggested === idioma && !value;
          return (
            <button key={idioma} onClick={() => onChange(idioma)} style={{
              padding: "6px 14px", borderRadius: "999px",
              border: `1.5px solid ${sel ? color : sug ? `${color}88` : CSS.border}`,
              background: sel ? `${color}18` : sug ? `${color}08` : "transparent",
              color: sel ? color : sug ? color : CSS.mutedFg,
              fontFamily: "'Space Mono', monospace", fontSize: "10px",
              fontWeight: sel ? 700 : 400, letterSpacing: "0.06em",
              cursor: "pointer", transition: "all 150ms",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              {sug && <Sparkles size={9} />}
              {IDIOMA_LABELS[idioma]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Info card (shared between both modals) ────────────────────────────────────
function InfoCard({ fields }: { fields: { label: string; value: React.ReactNode; accent?: string }[] }) {
  return (
    <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", padding: "16px 20px", display: "flex", gap: "32px", flexWrap: "wrap" as const }}>
      {fields.map(({ label, value, accent }) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>{label}</span>
          <span style={{ fontFamily: accent ? "'Space Grotesk', sans-serif" : "'Space Mono', monospace", fontSize: accent ? "14px" : "13px", fontWeight: accent ? 700 : 400, color: accent ?? CSS.fg }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Generate liquidation modal ────────────────────────────────────────────────
function GenerateLiqModal({ fileRow, guideName, suggested, criteriaRules, onSave, onCancel, saving }: {
  fileRow: EnrichedFileRow; guideName: string;
  suggested: Idioma | null; criteriaRules: LiquidationCriteriaRule[];
  onSave: (items: LiquidationItem[], idioma: Idioma) => void;
  onCancel: () => void; saving: boolean;
}) {
  const [idioma, setIdioma] = useState<Idioma | "">(suggested ?? "");
  const [items, setItems] = useState<LiquidationItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!idioma) { setItems([]); return; }
    setLoadingItems(true);
    getServiceOrdersByFileAndGuide(fileRow.fileNumber, guideName)
      .then(raw => {
        setItems(raw.map(item => ({
          ...item,
          monto: applyBestCriteriaRule(criteriaRules, { servicio: item.servicio, hora: item.hora, paxCount: item.paxCount }, idioma as Idioma) ?? 0,
          checked: true,
        })));
      })
      .catch(() => toast({ title: "Error al cargar servicios", variant: "destructive" }))
      .finally(() => setLoadingItems(false));
  }, [idioma]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((i: number, field: "monto" | "checked", val: number | boolean) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }, []);

  const total = items.reduce((s, it) => s + (it.checked ? (it.monto || 0) : 0), 0);
  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: "20px" }}>
      <div style={{ background: CSS.bg, border: `1px solid ${CSS.border}`, borderRadius: "14px", width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Modal header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${CSS.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, background: CSS.card }}>
          <div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px", fontWeight: 700, color: CSS.fg, marginBottom: "3px" }}>
              Generar liquidación
            </p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
              nueva liquidación · {guideName}
            </p>
          </div>
          <button onClick={onCancel} style={{ width: "32px", height: "32px", borderRadius: "6px", border: "1px solid #ef444433", background: "#ef44440d", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}>
            <X size={15} />
          </button>
        </div>

        {/* Static body — no scroll here, table scrolls internally */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Info card */}
          <InfoCard fields={[
            { label: "Guía", value: guideName, accent: CSS.fg },
            { label: "File", value: fileRow.fileNumber },
            { label: "Pasajero", value: fileRow.paxName || "—" },
            { label: "N° Pax", value: fileRow.paxCount || "—" },
            { label: "Total", value: `Bs. ${fmt(total)}`, accent: GREEN },
          ]} />

          {/* Idioma selector */}
          <IdiomaPills value={idioma} onChange={setIdioma} suggested={suggested} />

          {criteriaRules.length === 0 && (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: AMBER, letterSpacing: "0.04em" }}>
              ⚠ Sin reglas de criterios configuradas — los montos quedarán en 0.
            </p>
          )}

          {/* Items table — scrollable, fills remaining viewport */}
          {loadingItems ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", gap: "10px" }}>
              <Loader2 size={18} color={BLUE} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>Cargando servicios...</span>
            </div>
          ) : idioma && items.length > 0 ? (
            <GuideLiquidationTable items={items} onItemChange={handleChange} readOnly={false} hideColumns={["file", "paxName"]} maxHeight="calc(100vh - 420px)" />
          ) : idioma && items.length === 0 && !loadingItems ? (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, textAlign: "center", padding: "24px 0" }}>
              Sin servicios encontrados para este file y guía.
            </p>
          ) : (
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, textAlign: "center", padding: "24px 0" }}>
              Seleccioná el idioma del guía para ver los servicios y precios.
            </p>
          )}
        </div>

        {/* Footer total + actions */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${CSS.border}`, background: CSS.card, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", color: CSS.mutedFg, textTransform: "uppercase" as const }}>Total a pagar</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, color: GREEN }}>
              Bs. {fmt(total)}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onCancel} disabled={saving}
              style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: `1px solid ${CSS.border}`, background: "transparent", color: CSS.mutedFg, fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>
              Cancelar
            </button>
            <button
              onClick={() => idioma && items.length > 0 && onSave(items, idioma as Idioma)}
              disabled={saving || !idioma || items.length === 0}
              style={{ height: "36px", padding: "0 22px", borderRadius: "8px", border: "none", background: (!idioma || items.length === 0) ? CSS.muted : GREEN, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: (saving || !idioma || items.length === 0) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "7px", transition: "all 150ms" }}>
              {saving && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
              Guardar liquidación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit liquidation modal ────────────────────────────────────────────────────
function EditLiqModal({ liqId, onSaved, onCancel }: {
  liqId: string; onSaved: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const [liq, setLiq]           = useState<GuideLiquidation | null>(null);
  const [items, setItems]       = useState<LiquidationItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    getLiquidationById(liqId)
      .then(data => {
        if (!data) { toast({ title: "Liquidación no encontrada", variant: "destructive" }); onCancel(); return; }
        setLiq(data);
        setItems(data.items.map(i => ({ ...i, checked: true })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [liqId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((i: number, field: "monto" | "checked", val: number | boolean) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }, []);

  const total = items.reduce((s, i) => s + (i.checked ? (i.monto || 0) : 0), 0);
  const fmt   = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

  const doSave = async () => {
    if (!liq) return;
    setSaving(true);
    try {
      await updateLiquidation(liq.id, { items, paxName: liq.paxName, paxCount: liq.paxCount });
      toast({ title: "Liquidación actualizada", description: `${liq.liquidationNumber} — Total: Bs. ${total.toFixed(2)}` });
      onSaved();
    } catch (e) {
      console.error(e);
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: "20px" }}>
        <div style={{ background: CSS.bg, border: `1px solid ${CSS.border}`, borderRadius: "14px", width: "100%", maxWidth: "960px", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${CSS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: CSS.card }}>
            <div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "18px", fontWeight: 700, color: CSS.fg, marginBottom: "3px" }}>
                Editar liquidación
              </p>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
                {liq ? `Modificando ${liq.liquidationNumber}` : "Cargando..."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button onClick={() => setShowConfirm(true)} disabled={saving || loading || !liq}
                style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: "none", background: GREEN, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: (saving || loading) ? 0.7 : 1 }}>
                {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
                Guardar cambios
              </button>
              <button onClick={onCancel} style={{ width: "32px", height: "32px", borderRadius: "6px", border: "1px solid #ef444433", background: "#ef44440d", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Body — static, no scroll; table scrolls internally */}
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px", gap: "10px" }}>
                <Loader2 size={22} color={BLUE} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: CSS.mutedFg }}>Cargando liquidación...</span>
              </div>
            ) : liq ? (
              <>
                <InfoCard fields={[
                  { label: "N° Liquidación", value: liq.liquidationNumber, accent: BLUE },
                  { label: "Guía", value: liq.guideName, accent: CSS.fg },
                  { label: "File", value: liq.fileNumber },
                  { label: "Pasajero", value: liq.paxName || "—" },
                  { label: "Total actual", value: `Bs. ${fmt(total)}`, accent: GREEN },
                ]} />
                <GuideLiquidationTable items={items} onItemChange={handleChange} readOnly={false} hideColumns={["file", "paxName"]} maxHeight="calc(100vh - 380px)" />
              </>
            ) : null}
          </div>

          {/* Footer */}
          {liq && (
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${CSS.border}`, background: CSS.card, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", color: CSS.mutedFg, textTransform: "uppercase" as const }}>Total a pagar</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "24px", fontWeight: 700, color: GREEN }}>
                Bs. {fmt(total)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizarán los montos de <strong>{liq?.liquidationNumber}</strong> — guía <strong>{liq?.guideName}</strong>.
              <br />Nuevo total: <strong>Bs. {total.toFixed(2)}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm(false); doSave(); }}>
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

// ── Pay modal ─────────────────────────────────────────────────────────────────
function PayModal({ liq, onConfirm, onCancel, loading }: {
  liq: GuideLiquidation; onConfirm: (date: string) => void; onCancel: () => void; loading: boolean;
}) {
  const today = new Date();
  const [dd, setDd] = useState(String(today.getDate()).padStart(2, "0"));
  const [mm, setMm] = useState(String(today.getMonth() + 1).padStart(2, "0"));
  const [yyyy, setYyyy] = useState(String(today.getFullYear()));

  const isoDate = `${yyyy}-${mm}-${dd}`;
  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && !isNaN(new Date(isoDate).getTime());

  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

  const inputStyle = {
    padding: "8px 6px", borderRadius: "6px",
    border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg,
    fontFamily: "'Space Mono', monospace", fontSize: "13px", outline: "none",
    textAlign: "center" as const, width: "100%",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "12px", padding: "28px 32px", width: "380px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: CSS.fg, marginBottom: "6px" }}>Confirmar pago</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em" }}>
              {liq.guideName} · {liq.liquidationNumber}
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, color: GREEN, marginTop: "10px" }}>
              Bs. {fmt(liq.total)}
            </p>
          </div>
          <button onClick={onCancel} style={{ width: "30px", height: "30px", borderRadius: "6px", border: "1px solid #ef444433", background: "#ef44440d", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Fecha de pago</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 10px 1fr 10px 1.6fr", alignItems: "center", gap: "4px" }}>
            <input value={dd} onChange={e => setDd(e.target.value.slice(0, 2))} placeholder="DD" maxLength={2} style={inputStyle} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: CSS.mutedFg, textAlign: "center" as const }}>/</span>
            <input value={mm} onChange={e => setMm(e.target.value.slice(0, 2))} placeholder="MM" maxLength={2} style={inputStyle} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: CSS.mutedFg, textAlign: "center" as const }}>/</span>
            <input value={yyyy} onChange={e => setYyyy(e.target.value.slice(0, 4))} placeholder="AAAA" maxLength={4} style={inputStyle} />
          </div>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: CSS.mutedFg, letterSpacing: "0.06em" }}>
            {isValid ? `→ ${dd}/${mm}/${yyyy}` : "Ingresá la fecha en formato DD/MM/AAAA"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={loading}
            style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: `1px solid ${CSS.border}`, background: "transparent", color: CSS.mutedFg, fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={() => isValid && onConfirm(isoDate)} disabled={loading || !isValid}
            style={{ height: "36px", padding: "0 20px", borderRadius: "8px", border: "none", background: isValid ? GREEN : CSS.muted, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: (loading || !isValid) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            Confirmar pago
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
      toast({ title: "Pago registrado", description: `${payTarget.guideName} · ${payTarget.liquidationNumber}`, variant: "success" as any });
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
        guideId: selectedGuide,
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
      toast({ title: "Liquidación guardada", description: `File ${savedFileNumber} · ${IDIOMA_LABELS[idioma]}`, variant: "success" as any });
      setLiqTarget(null);
      silentRefresh();
    } catch (e) {
      console.error(e);
      toast({ title: "Error al guardar liquidación", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

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
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
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
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
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
                    {liq ? `Bs. ${fmt(liq.total)}` : "—"}
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
