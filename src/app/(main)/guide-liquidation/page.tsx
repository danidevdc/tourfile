"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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

type PageStatus = "idle" | "searched" | "saved";

export default function GuideLiquidationPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [liquidationNumber, setLiquidationNumber] = useState("LIQ-01");
  const [items, setItems] = useState<LiquidationItem[]>([]);
  const [savedLiquidation, setSavedLiquidation] = useState<GuideLiquidation | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [currentFile, setCurrentFile] = useState("");
  const [currentGuideName, setCurrentGuideName] = useState("");
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [showNewConfirm, setShowNewConfirm] = useState(false);

  useEffect(() => {
    fetchNextNumber().then(setLiquidationNumber);
  }, []);

  async function fetchNextNumber(): Promise<string> {
    // TODO: remove this when going live — fixed number for testing on develop
    return "LIQ-000";
  }

  const handleSearch = useCallback(
    async (fileNumber: string, _guideId: string, guideName: string) => {
      setIsSearching(true);
      setCurrentFile(fileNumber);
      setCurrentGuideName(guideName);
      try {
        // Check for existing liquidation for this file+guide combo
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

        // Find existing liquidation for this specific guide
        const normalizedGuide = guideName.trim().toUpperCase();
        const existingLiq = existing.find(
          (l) => l.guideName.trim().toUpperCase() === normalizedGuide
        ) ?? null;

        setItems(results);
        setSavedLiquidation(existingLiq);
        setPageStatus(existingLiq ? "saved" : "searched");

        if (existingLiq) {
          toast({
            title: "Ya existe una liquidación",
            description: `${existingLiq.liquidationNumber} — Bs. ${existingLiq.total.toFixed(2)}. Podés imprimir o crear una nueva.`,
          });
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Error al buscar servicios", variant: "destructive" });
      } finally {
        setIsSearching(false);
      }
    },
    [toast]
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
      const nextNum = await fetchNextNumber();
      setLiquidationNumber(nextNum);
      toast({
        title: "Liquidación guardada",
        description: `${saved.liquidationNumber} — Total: Bs. ${saved.total.toFixed(2)}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
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
    const url = buildLiquidationPDFUrl(liq);
    const fileName = `Liquidacion-${liq.liquidationNumber}-${liq.guideName.replace(/\s+/g, '_')}.pdf`;
    setPdfPreview({ url, fileName });
  };

  const handleClear = () => {
    setItems([]);
    setCurrentFile("");
    setCurrentGuideName("");
    setSavedLiquidation(null);
    setPageStatus("idle");
    setFormKey((k) => k + 1);
  };

  const statusColor =
    pageStatus === "saved"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";

  const statusLabel = pageStatus === "saved" ? "Liquidado" : "Sin Liquidar";
  const currentLiqNumber = savedLiquidation?.liquidationNumber ?? liquidationNumber;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex flex-col gap-4 p-7 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Liquidación de Guías
              </h1>
              <p className="text-sm text-muted-foreground">
                Generá y gestioná liquidaciones por guía y file
              </p>
            </div>
          </div>
          <Button className="gap-2" onClick={() => pageStatus === "searched" && items.length > 0 ? setShowNewConfirm(true) : handleClear()}>
            <Plus className="h-4 w-4" />
            Nueva Liquidación
          </Button>
        </div>

        {/* Form */}
        <GuideLiquidationForm
          key={formKey}
          isSearching={isSearching}
          hasResults={pageStatus !== "idle"}
          onSearch={handleSearch}
        />

        {/* Status row — solo visible cuando hay resultados */}
        {pageStatus !== "idle" && <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {statusLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground">
            <Hash className="h-3 w-3 text-primary shrink-0" />
            {currentLiqNumber}
          </span>
        </div>}

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

      {/* Confirm save dialog */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se guardará la liquidación <strong>{currentLiqNumber}</strong> para el guía{" "}
              <strong>{currentGuideName}</strong>, file <strong>{currentFile}</strong>.
              <br />
              Total a liquidar: <strong>Bs. {total.toFixed(2)}</strong>.
              <br />
              El estado cambiará a <strong>Liquidado</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSaveConfirm(false);
                doSave();
              }}
            >
              Sí, guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm nueva liquidación sobre una existente */}
      <AlertDialog open={showNewConfirm} onOpenChange={setShowNewConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tenés servicios cargados para <strong>{currentGuideName}</strong> — file{" "}
              <strong>{currentFile}</strong> que todavía no fueron guardados.
              <br /><br />
              Si continuás se perderán los montos ingresados.
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

      {/* PDF Preview Modal */}
      <LiquidationPDFPreviewModal
        open={!!pdfPreview}
        onClose={() => {
          if (pdfPreview) URL.revokeObjectURL(pdfPreview.url);
          setPdfPreview(null);
        }}
        blobUrl={pdfPreview?.url ?? null}
        fileName={pdfPreview?.fileName ?? ""}
      />
    </div>
  );
}
