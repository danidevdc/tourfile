"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { GuideLiquidationForm } from "@/components/guide-liquidation/GuideLiquidationForm";
import { GuideLiquidationTable } from "@/components/guide-liquidation/GuideLiquidationTable";
import { GuideLiquidationFooter } from "@/components/guide-liquidation/GuideLiquidationFooter";
import {
  getServiceOrdersByFileAndGuide,
  getLiquidationsByFile,
  saveLiquidation,
  type LiquidationItem,
  type GuideLiquidation,
} from "@/lib/guideLiquidationService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";
import {
  getLiquidationCriteria,
  getSuggestedIdioma,
  recordGuideIdioma,
  applyBestCriteriaRule,
  IDIOMAS, IDIOMA_LABELS, IDIOMA_COLORS,
  type Idioma, type LiquidationCriteriaRule,
} from "@/lib/guideLiquidationCriteriaService";

type PageStatus = "idle" | "searched" | "saved";

// ── Idioma selector ──────────────────────────────────────────────────────────
function IdiomaSelector({
  value, onChange, suggested, disabled,
}: {
  value: Idioma | "";
  onChange: (v: Idioma) => void;
  suggested: Idioma | null;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "hsl(var(--muted-foreground))" }}>
          Idioma del guía
        </span>
        {suggested && !value && (
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: IDIOMA_COLORS[suggested], letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "4px" }}>
            <Sparkles size={10} />
            sugerido: {IDIOMA_LABELS[suggested]}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
        {IDIOMAS.map((idioma) => {
          const color = IDIOMA_COLORS[idioma];
          const isSelected = value === idioma;
          const isSuggested = suggested === idioma && !value;
          return (
            <button
              key={idioma}
              type="button"
              disabled={disabled}
              onClick={() => onChange(idioma)}
              style={{
                padding: "6px 14px",
                borderRadius: "999px",
                border: `1.5px solid ${isSelected ? color : isSuggested ? `${color}88` : "hsl(var(--border))"}`,
                background: isSelected ? `${color}18` : isSuggested ? `${color}08` : "transparent",
                color: isSelected ? color : isSuggested ? color : "hsl(var(--muted-foreground))",
                fontFamily: "'Space Mono', monospace",
                fontSize: "10px",
                fontWeight: isSelected ? 700 : 400,
                letterSpacing: "0.06em",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 150ms ease-out",
                opacity: disabled ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: "5px",
              }}
            >
              {isSuggested && <Sparkles size={9} />}
              {IDIOMA_LABELS[idioma]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GuideLiquidationNewPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [liquidationNumber, setLiquidationNumber] = useState("LIQ-000");
  const [items, setItems] = useState<LiquidationItem[]>([]);
  const [savedLiquidation, setSavedLiquidation] = useState<GuideLiquidation | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [currentFile, setCurrentFile] = useState("");
  const [currentGuideName, setCurrentGuideName] = useState("");
  const [currentGuideId, setCurrentGuideId] = useState("");
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);

  // Idioma state
  const [idioma, setIdioma] = useState<Idioma | "">("");
  const [suggestedIdioma, setSuggestedIdioma] = useState<Idioma | null>(null);
  const [criteriaRules, setCriteriaRules] = useState<LiquidationCriteriaRule[]>([]);

  // Load criteria rules once
  useEffect(() => {
    getLiquidationCriteria().catch(console.error).then((r) => { if (r) setCriteriaRules(r); });
  }, []);

  useEffect(() => {
    fetchNextNumber().then(setLiquidationNumber);
  }, []);

async function fetchNextNumber(): Promise<string> {
    // TODO: remove this when going live — fixed number for testing on develop
    return "LIQ-000";
  }

  // When guide changes, load suggested idioma
  useEffect(() => {
    if (!currentGuideId) { setSuggestedIdioma(null); return; }
    getSuggestedIdioma(currentGuideId).then(setSuggestedIdioma).catch(console.error);
  }, [currentGuideId]);

  // Apply criteria rules to items whenever idioma or items change
  const applyPrices = useCallback((rawItems: LiquidationItem[], lang: Idioma | "") => {
    if (!lang || criteriaRules.length === 0) return rawItems;
    return rawItems.map((item) => {
      const monto = applyBestCriteriaRule(criteriaRules, {
        servicio: item.servicio,
        hora: item.hora,
        paxCount: item.paxCount,
      }, lang);
      return { ...item, monto: monto ?? 0, checked: monto !== null && monto > 0 };
    });
  }, [criteriaRules]);

  const handleIdiomaChange = (newIdioma: Idioma) => {
    setIdioma(newIdioma);
    // Re-apply prices to current items with new idioma
    if (pageStatus === "searched" && items.length > 0) {
      setItems(applyPrices(items.map((i) => ({ ...i, monto: 0, checked: false })), newIdioma));
    }
  };

  const handleSearch = useCallback(
    async (fileNumber: string, guideId: string, guideName: string) => {
      setIsSearching(true);
      setCurrentFile(fileNumber);
      setCurrentGuideName(guideName);
      setCurrentGuideId(guideId);

      // Get suggested idioma for this guide
      const suggested = await getSuggestedIdioma(guideId).catch(() => null);
      setSuggestedIdioma(suggested);
      const effectiveIdioma = idioma || suggested || "";

      try {
        const [results, existing] = await Promise.all([
          getServiceOrdersByFileAndGuide(fileNumber, guideName),
          getLiquidationsByFile(fileNumber),
        ]);

        if (results.length === 0) {
          toast({
            title: "Sin resultados",
            description: `No se encontraron servicios para "${guideName}" en el file "${fileNumber}".`,
            variant: "destructive",
          });
          setPageStatus("idle");
          return;
        }

        const normalizedGuide = guideName.trim().toUpperCase();
        const existingLiq = existing.find(
          (l) => l.guideName.trim().toUpperCase() === normalizedGuide
        ) ?? null;

        // Apply auto-prices if idioma is known
        const priced = effectiveIdioma
          ? applyPrices(results, effectiveIdioma as Idioma)
          : results;

        if (effectiveIdioma) setIdioma(effectiveIdioma as Idioma);

        setItems(priced);
        setSavedLiquidation(existingLiq);
        setPageStatus(existingLiq ? "saved" : "searched");

        if (existingLiq) {
          toast({
            title: "Ya existe una liquidación",
            description: `${existingLiq.liquidationNumber} — Bs. ${existingLiq.total.toFixed(2)}.`,
          });
        } else if (effectiveIdioma && criteriaRules.length > 0) {
          const filled = priced.filter((i) => i.monto > 0).length;
          if (filled > 0) {
            toast({
              title: `✓ Precios aplicados automáticamente`,
              description: `${filled} de ${priced.length} servicios con monto — idioma: ${IDIOMA_LABELS[effectiveIdioma as Idioma]}`,
            });
          }
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Error al buscar servicios", variant: "destructive" });
      } finally {
        setIsSearching(false);
      }
    },
    [toast, idioma, applyPrices, criteriaRules]
  );

  const handleItemChange = useCallback(
    (index: number, field: "monto" | "checked", value: number | boolean) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const total = savedLiquidation
    ? savedLiquidation.total
    : items.reduce((sum, item) => sum + (item.checked ? (item.monto || 0) : 0), 0);
  const paxName = items[0]?.paxName ?? "";
  const paxCount = items[0]?.paxCount ?? 0;

  const doSave = async () => {
    if (!currentUser || items.length === 0) return;
    setIsSaving(true);
    try {
      const saved = await saveLiquidation({
        fileNumber: currentFile,
        guideId: currentGuideName,
        guideName: currentGuideName,
        paxName,
        paxCount,
        items,
        createdBy: currentUser.email ?? currentUser.uid,
      });
      setSavedLiquidation(saved);
      setPageStatus("saved");

      if (idioma && currentGuideId) {
        recordGuideIdioma(currentGuideId, currentGuideName, idioma).catch(console.error);
      }
      const nextNum = await fetchNextNumber();
      setLiquidationNumber(nextNum);
      toast({ title: "Liquidación guardada", description: `${saved.liquidationNumber} — Total: Bs. ${saved.total.toFixed(2)}` });
    } catch (err) {
      console.error(err);
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = async () => {
    if (items.length === 0) return;
    const liq: GuideLiquidation = savedLiquidation ?? {
      id: "",
      liquidationNumber,
      fileNumber: currentFile,
      guideId: currentGuideName,
      guideName: currentGuideName,
      paxName,
      paxCount,
      status: "Sin Liquidar",
      total,
      createdBy: currentUser?.email ?? "",
      createdAt: new Date(),
      items,
    };
    const url = await buildLiquidationPDFUrl(liq);
    const fileName = `Liquidacion-${liq.liquidationNumber}-${liq.fileNumber}-${liq.guideName.replace(/\s+/g, '_')}.pdf`;
    setPdfPreview({ url, fileName });
  };

  const handleClear = () => {
    setItems([]);
    setCurrentFile("");
    setCurrentGuideName("");
    setCurrentGuideId("");
    setSavedLiquidation(null);
    setPageStatus("idle");
    setIdioma("");
    setSuggestedIdioma(null);
    setFormKey((k) => k + 1);
  };

  const statusLabel = pageStatus === "saved" ? "Liquidado" : "Sin Liquidar";
  const currentLiqNumber = savedLiquidation?.liquidationNumber ?? liquidationNumber;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <style>{`
        @keyframes nd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
      <div className="flex flex-col gap-5 p-7 max-w-7xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/guide-liquidation")}
              style={{ width: "40px", height: "40px", borderRadius: "50%", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }} className="text-foreground">
                Nueva Liquidación
              </h1>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" }} className="text-muted-foreground">
                Generá liquidaciones con precios automáticos
              </p>
            </div>
          </div>

          <button
            onClick={() => pageStatus === "searched" && items.length > 0 ? setShowNewConfirm(true) : handleClear()}
            style={{ height: "36px", padding: "0 18px", borderRadius: "999px", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px", border: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", background: "transparent", cursor: "pointer" }}
            className="hover:border-foreground/40 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva Liquidación
          </button>
        </div>

        {/* Form */}
        <GuideLiquidationForm
          key={formKey}
          isSearching={isSearching}
          hasResults={pageStatus !== "idle"}
          onSearch={handleSearch}
        />

        {/* Idioma selector — siempre visible después de que se elige guía */}
        {(currentGuideName || pageStatus !== "idle") && (
          <div style={{
            padding: "14px 18px",
            borderRadius: "10px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
          }}>
            <IdiomaSelector
              value={idioma}
              onChange={handleIdiomaChange}
              suggested={suggestedIdioma}
              disabled={pageStatus === "saved"}
            />
            {idioma && pageStatus === "searched" && criteriaRules.length > 0 && (
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "hsl(var(--muted-foreground))", marginTop: "8px", letterSpacing: "0.04em" }}>
                ✓ Motor activo — los montos se calculan según actividad · {IDIOMA_LABELS[idioma]} · turno · grupo
              </p>
            )}
            {idioma && criteriaRules.length === 0 && (
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: "#f59e0b", marginTop: "8px", letterSpacing: "0.04em" }}>
                ⚠ No hay reglas configuradas — configurá el Motor de Criterios primero
              </p>
            )}
          </div>
        )}

        {/* Status row */}
        {pageStatus !== "idle" && (
          <div className="flex items-center gap-3">
            <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "6px 14px", borderRadius: "6px", border: pageStatus === "saved" ? "1px solid #16a34a88" : "1px solid hsl(var(--destructive) / 0.5)", backgroundColor: pageStatus === "saved" ? "#16a34a14" : "hsl(var(--destructive) / 0.08)" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: pageStatus === "saved" ? "#16a34a" : "hsl(var(--destructive))", display: "inline-block", flexShrink: 0, animation: pageStatus === "saved" ? "nd-pulse 2.4s ease-in-out infinite" : "none" }} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: pageStatus === "saved" ? "#16a34a" : "hsl(var(--destructive))" }}>
                {statusLabel}
              </span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "4px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--muted) / 0.4)" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", color: "hsl(var(--muted-foreground))" }}>
                {currentLiqNumber}
              </span>
            </div>
            {idioma && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "4px", border: `1px solid ${IDIOMA_COLORS[idioma]}44`, backgroundColor: `${IDIOMA_COLORS[idioma]}0e` }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", color: IDIOMA_COLORS[idioma] }}>
                  {IDIOMA_LABELS[idioma]}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <GuideLiquidationTable
          items={savedLiquidation ? savedLiquidation.items : items}
          onItemChange={handleItemChange}
          readOnly={pageStatus === "saved"}
        />

        {/* Footer */}
        <GuideLiquidationFooter
          total={total}
          isSaving={isSaving}
          hasItems={items.length > 0}
          isSaved={pageStatus === "saved"}
          onClear={handleClear}
          onSave={() => setShowSaveConfirm(true)}
          onPrint={handlePrint}
        />
      </div>

      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Liquidación <strong>{currentLiqNumber}</strong> · guía <strong>{currentGuideName}</strong> · file <strong>{currentFile}</strong>
              {idioma && <> · idioma <strong>{IDIOMA_LABELS[idioma]}</strong></>}.
              <br />Total: <strong>Bs. {total.toFixed(2)}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSaveConfirm(false); doSave(); }}>
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Hay servicios cargados para <strong>{currentGuideName}</strong> — file <strong>{currentFile}</strong> sin guardar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowNewConfirm(false); handleClear(); }}>
              Sí, nueva liquidación
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
