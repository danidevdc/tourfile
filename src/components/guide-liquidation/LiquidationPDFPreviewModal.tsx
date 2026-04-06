"use client";

import { useEffect, useRef } from "react";
import { Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LiquidationPDFPreviewModalProps {
  open: boolean;
  onClose: () => void;
  blobUrl: string | null;
  fileName: string;
}

export function LiquidationPDFPreviewModal({
  open,
  onClose,
  blobUrl,
  fileName,
}: LiquidationPDFPreviewModalProps) {
  const urlRef = useRef<string | null>(null);

  // Revoke previous blob URL when a new one arrives or modal closes
  useEffect(() => {
    if (blobUrl) {
      urlRef.current = blobUrl;
    }
    return () => {
      if (!open && urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [blobUrl, open]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 [&>button:last-child]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b shrink-0">
          <DialogTitle className="text-sm font-semibold truncate pr-4">
            {fileName}
          </DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted">
          {blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title="Vista previa PDF"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Generando PDF...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
