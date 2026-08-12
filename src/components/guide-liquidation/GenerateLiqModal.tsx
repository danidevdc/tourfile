import { useState, useEffect, useCallback } from "react";
import { Loader2, X } from "lucide-react";
import {
  getServiceOrdersByFileAndGuide,
  type GuideFileRow,
  type LiquidationItem,
} from "@/lib/guideLiquidationService";
import {
  applyBestCriteriaRule,
  type Idioma, type LiquidationCriteriaRule,
} from "@/lib/guideLiquidationCriteriaService";
import { GuideLiquidationTable } from "@/components/guide-liquidation/GuideLiquidationTable";
import { useToast } from "@/hooks/use-toast";
import { InfoCard } from "./InfoCard";
import { IdiomaPills } from "./IdiomaPills";
import type { LiqStatus } from "./StatusBadge";

const CSS = {
  bg: "hsl(var(--background))",
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  muted: "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
};
const BLUE = "#0991ea";
const GREEN = "#16a34a";
const AMBER = "#f59e0b";

type EnrichedFileRow = GuideFileRow & { liqStatus: LiqStatus };

export function GenerateLiqModal({ fileRow, guideName, suggested, criteriaRules, onSave, onCancel, saving }: {
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
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${CSS.border}`, background: CSS.card, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "20px" }}>
          {/* Botones */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={onCancel} disabled={saving}
              style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer", transition: "all 150ms" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}>
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
          {/* Divisor */}
          <div style={{ width: "1px", height: "36px", background: CSS.border, flexShrink: 0 }} />
          {/* Total — extremo derecho */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: CSS.mutedFg, textTransform: "uppercase" as const }}>Total a pagar</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, color: GREEN, lineHeight: 1 }}>
              Bs. {fmt(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
