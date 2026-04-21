"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, Loader2, Printer } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { GuideLiquidationTable } from "@/components/guide-liquidation/GuideLiquidationTable";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";
import {
  getLiquidationById,
  updateLiquidation,
  type LiquidationItem,
  type GuideLiquidation,
} from "@/lib/guideLiquidationService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";

const CSS = {
  bg:      "hsl(var(--background))",
  card:    "hsl(var(--card))",
  border:  "hsl(var(--border))",
  muted:   "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg:      "hsl(var(--foreground))",
};
const BLUE  = "#0991ea";
const GREEN = "#16a34a";

export default function EditLiquidationPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [liq, setLiq]             = useState<GuideLiquidation | null>(null);
  const [items, setItems]         = useState<LiquidationItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pdfPreview, setPdfPreview]   = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    getLiquidationById(id).then((data) => {
      if (!data) { toast({ title: "Liquidación no encontrada", variant: "destructive" }); router.push("/guide-liquidation"); return; }
      setLiq(data);
      setItems(data.items.map((i) => ({ ...i, checked: true })));
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleItemChange = useCallback((index: number, field: "monto" | "checked", value: number | boolean) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  const total = items.reduce((s, i) => s + (i.checked ? (i.monto || 0) : 0), 0);
  const paxName  = liq?.paxName  ?? items[0]?.paxName  ?? "";
  const paxCount = liq?.paxCount ?? items[0]?.paxCount ?? 0;

  const doSave = async () => {
    if (!liq) return;
    setSaving(true);
    try {
      await updateLiquidation(id, { items, paxName, paxCount });
      toast({ title: "Liquidación actualizada", description: `${liq.liquidationNumber} — Total: Bs. ${total.toFixed(2)}` });
      router.push("/guide-liquidation");
    } catch (e) {
      console.error(e);
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!liq) return;
    const url = await buildLiquidationPDFUrl({ ...liq, items, total });
    const fileName = `Liquidacion-${liq.liquidationNumber}-${liq.fileNumber}-${liq.guideName.replace(/\s+/g, "_")}.pdf`;
    setPdfPreview({ url, fileName });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: CSS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} color={BLUE} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!liq) return null;

  return (
    <div style={{ minHeight: "100vh", background: CSS.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{`@keyframes nd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              onClick={() => router.push("/guide-liquidation")}
              style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${CSS.border}`, background: CSS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: CSS.mutedFg }}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", color: CSS.fg }}>
                Editar Liquidación
              </h1>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const, color: CSS.mutedFg, marginTop: "2px" }}>
                Modificando {liq.liquidationNumber}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handlePrint}
              style={{ height: "36px", padding: "0 16px", borderRadius: "8px", border: `1px solid ${BLUE}44`, background: `${BLUE}10`, color: BLUE, fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Printer size={13} />
              Imprimir
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={saving}
              style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: "none", background: GREEN, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
              Guardar cambios
            </button>
          </div>
        </div>

        {/* Info card — datos de la liquidación */}
        <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", padding: "16px 20px", display: "flex", gap: "32px", flexWrap: "wrap" as const }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>N° Liquidación</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", fontWeight: 700, color: BLUE }}>{liq.liquidationNumber}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Guía</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 600, color: CSS.fg }}>{liq.guideName}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>File</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", color: CSS.fg }}>{liq.fileNumber}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Pasajero</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: CSS.fg }}>{liq.paxName || "—"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Total actual</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: GREEN }}>Bs. {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Tabla de servicios editable */}
        <GuideLiquidationTable
          items={items}
          onItemChange={handleItemChange}
          readOnly={false}
        />

        {/* Footer total */}
        <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", color: CSS.mutedFg, textTransform: "uppercase" as const }}>
            Total a pagar
          </span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "24px", fontWeight: 700, color: GREEN }}>
            Bs. {total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizarán los montos de <strong>{liq.liquidationNumber}</strong> — guía <strong>{liq.guideName}</strong>.
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

      <LiquidationPDFPreviewModal
        open={!!pdfPreview}
        onClose={() => { if (pdfPreview) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        blobUrl={pdfPreview?.url ?? null}
        fileName={pdfPreview?.fileName ?? ""}
      />
    </div>
  );
}
