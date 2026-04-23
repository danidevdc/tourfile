"use client";

import { Save, Printer, Loader2 } from "lucide-react";

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
    <div
      className="border border-border bg-card flex items-center justify-between"
      style={{ borderRadius: "8px", padding: "0 24px", minHeight: "80px" }}
    >
      {/* IZQ — Cancelar */}
      <button
        onClick={onClear}
        style={{
          height: "36px",
          padding: "0 20px",
          borderRadius: "999px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "11px",
          fontWeight: 400,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          transition: "all 150ms ease-out",
          border: "1px solid #ef4444",
          color: "#ef4444",
          background: "transparent",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#ef4444";
          (e.currentTarget as HTMLButtonElement).style.color = "white";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
        }}
      >
        Cancelar
      </button>

      {/* DER — Guardar + Imprimir | Total */}
      <div className="flex items-center gap-6">
        {/* Guardar + Imprimir */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={!hasItems || isSaving || isSaved}
            style={{
              height: "36px",
              padding: "0 20px",
              borderRadius: "999px",
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              fontWeight: 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 150ms ease-out",
              background: isSaved ? "hsl(var(--muted))" : "hsl(var(--foreground))",
              color: isSaved ? "hsl(var(--muted-foreground))" : "hsl(var(--background))",
              border: "none",
              cursor: !hasItems || isSaving || isSaved ? "not-allowed" : "pointer",
              opacity: !hasItems || isSaved ? 0.4 : 1,
            }}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isSaving ? "Guardando..." : "Guardar"}
          </button>

          <button
            onClick={onPrint}
            disabled={!isSaved}
            style={{
              height: "36px",
              padding: "0 20px",
              borderRadius: "999px",
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              fontWeight: 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 200ms ease-out",
              border: "none",
              background: isSaved
                ? "linear-gradient(135deg, #0991ea 0%, #78e3f0 100%)"
                : "linear-gradient(135deg, #0991ea44 0%, #78e3f044 100%)",
              color: isSaved ? "#fff" : "hsl(var(--muted-foreground))",
              cursor: !isSaved ? "not-allowed" : "pointer",
              opacity: !isSaved ? 0.4 : 1,
              boxShadow: isSaved ? "0 2px 12px #0991ea33" : "none",
            }}
            onMouseEnter={(e) => {
              if (!isSaved) return;
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px #0991ea55";
              (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 12px #0991ea33";
              (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)";
            }}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
        </div>

        {/* Divisor */}
        <div className="bg-border" style={{ width: "1px", height: "48px" }} />

        {/* Total hero */}
        <div className="flex flex-col items-end">
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Total a Liquidar
        </span>
        <div className="flex items-baseline gap-1.5">
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              fontWeight: 400,
              letterSpacing: "0.04em",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Bs.
          </span>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "36px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: total > 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)",
              transition: "color 200ms ease-out",
            }}
          >
            {total.toFixed(2)}
          </span>
        </div>
        </div>
      </div>
    </div>
  );
}
