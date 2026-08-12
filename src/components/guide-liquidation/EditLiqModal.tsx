import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getLiquidationById,
  updateLiquidation,
  type GuideLiquidation,
  type LiquidationItem,
} from "@/lib/guideLiquidationService";
import { GuideLiquidationTable } from "@/components/guide-liquidation/GuideLiquidationTable";
import { useToast } from "@/hooks/use-toast";
import { InfoCard } from "./InfoCard";

const CSS = {
  bg: "hsl(var(--background))",
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
};
const BLUE = "#0991ea";
const GREEN = "#16a34a";

export function EditLiqModal({ liqId, onSaved, onCancel }: {
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
