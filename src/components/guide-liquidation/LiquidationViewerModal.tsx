"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, Printer, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { getLiquidationsByFile, deleteLiquidation, type GuideLiquidation } from "@/lib/guideLiquidationService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { LiquidationPDFPreviewModal } from "./LiquidationPDFPreviewModal";

interface LiquidationViewerModalProps {
  fileNumber: string;
  open: boolean;
  onClose: () => void;
  onLastDeleted?: () => void;
}

export function LiquidationViewerModal({ fileNumber, open, onClose, onLastDeleted }: LiquidationViewerModalProps) {
  const [liquidations, setLiquidations] = useState<GuideLiquidation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<GuideLiquidation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reload whenever the modal opens or the fileNumber changes
  useEffect(() => {
    if (!open) {
      setLiquidations([]);
      return;
    }
    setIsLoading(true);
    getLiquidationsByFile(fileNumber)
      .then(setLiquidations)
      .finally(() => setIsLoading(false));
  }, [open, fileNumber]);

  const handleOpenChange = (val: boolean) => {
    if (!val) onClose();
  };

  const handleDelete = async (liq: GuideLiquidation) => {
    setIsDeleting(true);
    try {
      await deleteLiquidation(liq);
      const remaining = liquidations.filter((l) => l.id !== liq.id);
      setLiquidations(remaining);
      if (remaining.length === 0) {
        onClose();
        onLastDeleted?.();
      }
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Liquidaciones — File {fileNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : liquidations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No hay liquidaciones guardadas para este file.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {liquidations.map((liq) => (
              <div
                key={liq.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {liq.liquidationNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">{liq.guideName}</span>
                  <span className="text-xs text-primary font-semibold">
                    Bs. {liq.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                      liq.status === "Liquidado"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {liq.status}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-primary border-primary/50 hover:bg-primary/10"
                    title="Vista previa PDF"
                    onClick={async () => {
                      const url = await buildLiquidationPDFUrl(liq);
                      const fileName = `Liquidacion-${liq.liquidationNumber}-${liq.fileNumber}-${liq.guideName.replace(/\s+/g, '_')}.pdf`;
                      setPdfPreview({ url, fileName });
                    }}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive border-destructive/50 hover:bg-destructive hover:text-destructive-foreground"
                    title="Eliminar liquidación"
                    onClick={() => setDeleteConfirm(liq)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      <LiquidationPDFPreviewModal
        open={!!pdfPreview}
        onClose={() => {
          if (pdfPreview) URL.revokeObjectURL(pdfPreview.url);
          setPdfPreview(null);
        }}
        blobUrl={pdfPreview?.url ?? null}
        fileName={pdfPreview?.fileName ?? ""}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente <strong>{deleteConfirm?.liquidationNumber}</strong> del guía{" "}
              <strong>{deleteConfirm?.guideName}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
