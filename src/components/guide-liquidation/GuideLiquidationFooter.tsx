"use client";

import { Trash2, Save, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuideLiquidationFooterProps {
  total: number;
  isSaving: boolean;
  hasItems: boolean;
  isSaved: boolean;
  onClear: () => void;
  onSave: () => void;
  onPrint: () => void;
}

export function GuideLiquidationFooter({
  total,
  isSaving,
  hasItems,
  isSaved,
  onClear,
  onSave,
  onPrint,
}: GuideLiquidationFooterProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-6 h-16">
      {/* Limpiar */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={onClear}
      >
        <Trash2 className="h-4 w-4" />
        Limpiar
      </Button>

      {/* Total + acciones */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Total a Liquidar
          </span>
          <span className="text-2xl font-bold text-primary">
            Bs. {total.toFixed(2)}
          </span>
        </div>

        <div className="w-px h-7 bg-border" />

        <Button
          size="sm"
          className="gap-2"
          onClick={onSave}
          disabled={!hasItems || isSaving || isSaved}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? "Guardando..." : "Guardar"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          onClick={onPrint}
          disabled={!isSaved}
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>
    </div>
  );
}
