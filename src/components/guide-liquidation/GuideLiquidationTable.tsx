"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { LiquidationItem } from "@/lib/guideLiquidationService";

interface GuideLiquidationTableProps {
  items: LiquidationItem[];
  onItemChange: (index: number, field: "monto" | "checked", value: number | boolean) => void;
  readOnly?: boolean;
}

export function GuideLiquidationTable({ items, onItemChange, readOnly = false }: GuideLiquidationTableProps) {
  if (items.length === 0) {
    return (
      <div
        className="border border-border bg-card flex flex-col items-center justify-center"
        style={{ borderRadius: "8px", minHeight: "192px", gap: "8px" }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
          className="text-muted-foreground/60"
        >
          [ Sin servicios ]
        </span>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "14px",
          }}
          className="text-muted-foreground/50"
        >
          Ingresá un File y seleccioná un Guía para buscar los servicios.
        </span>
      </div>
    );
  }

  const handleMontoChange = (i: number, raw: string) => {
    const value = parseFloat(raw) || 0;
    onItemChange(i, "monto", value);
    onItemChange(i, "checked", value > 0);
  };

  return (
    <div
      className="border bg-card overflow-hidden"
      style={{
        borderRadius: "8px",
        borderColor: readOnly ? "#16a34a55" : "hsl(var(--border))",
      }}
    >
      {/* Banner read-only */}
      {readOnly && (
        <div
          className="flex items-center gap-2 border-b"
          style={{
            padding: "8px 16px",
            borderColor: "#16a34a33",
            backgroundColor: "#16a34a08",
          }}
        >
          <span
            className="shrink-0"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#16a34a",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#16a34a",
            }}
          >
            Liquidación registrada — solo lectura
          </span>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "420px" }}>
        <table className="w-full table-fixed text-sm" style={{ minWidth: "700px" }}>
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "27%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr
              className="border-b border-border"
              style={{ height: "40px", backgroundColor: "hsl(var(--muted))" }}
            >
              {["Fecha", "Hora", "File", "Servicio", "Nombre Pax", "Nro Pax", "Monto (Bs.)", ""].map((col, i) => (
                <th
                  key={i}
                  className={`border-r border-border last:border-r-0 ${
                    i === 6 ? "text-right pr-3 pl-2" :
                    i === 5 ? "text-center px-2" :
                    i === 7 ? "px-2" :
                    i === 0 ? "text-left pl-4 pr-2" :
                    "text-left px-2"
                  }`}
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  {i === 7 ? (
                    <div className="flex justify-center">
                      <Checkbox disabled className="opacity-20 border-[#16a34a]/40" />
                    </div>
                  ) : col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.map((item, i) => {
              const isChecked = item.checked;
              const rowBg = readOnly
                ? isChecked
                  ? i % 2 === 1 ? "hsl(var(--muted) / 0.4)" : "transparent"
                  : "hsl(var(--muted) / 0.15)"
                : i % 2 === 1 ? "hsl(var(--muted) / 0.2)" : "transparent";

              return (
                <tr
                  key={`${item.serviceOrderId}-${i}`}
                  style={{
                    height: "48px",
                    backgroundColor: rowBg,
                    opacity: readOnly && !isChecked ? 0.4 : 1,
                    transition: "opacity 150ms ease-out",
                    borderBottom: "1px solid hsl(var(--border))",
                  }}
                >
                  {/* Fecha */}
                  <td className="pl-4 pr-2 border-r border-dashed border-border overflow-hidden">
                    <span
                      className="block truncate"
                      style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "hsl(var(--foreground))" }}
                    >
                      {item.fecha}
                    </span>
                  </td>

                  {/* Hora */}
                  <td className="px-2 border-r border-dashed border-border overflow-hidden">
                    <span
                      className="block truncate"
                      style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "hsl(var(--muted-foreground))" }}
                    >
                      {item.hora}
                    </span>
                  </td>

                  {/* File */}
                  <td className="px-2 border-r border-dashed border-border overflow-hidden">
                    <span
                      className="block truncate"
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: "13px",
                        fontWeight: 700,
                        letterSpacing: "0.01em",
                        textTransform: "uppercase",
                        color: "hsl(var(--primary))",
                      }}
                    >
                      {item.fileNumber}
                    </span>
                  </td>

                  {/* Servicio */}
                  <td className="px-2 border-r border-dashed border-border overflow-hidden">
                    <span
                      className="block truncate"
                      style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: "hsl(var(--foreground))" }}
                    >
                      {item.servicio}
                    </span>
                  </td>

                  {/* Nombre Pax */}
                  <td className="px-2 border-r border-dashed border-border overflow-hidden">
                    <span
                      className="block truncate"
                      style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", color: "hsl(var(--muted-foreground))" }}
                    >
                      {item.paxName}
                    </span>
                  </td>

                  {/* Nro Pax */}
                  <td className="px-2 text-center border-r border-dashed border-border">
                    <span
                      style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", fontWeight: 700, color: "hsl(var(--foreground))" }}
                    >
                      {item.paxCount}
                    </span>
                  </td>

                  {/* Monto */}
                  <td className="pl-2 pr-2 border-r border-dashed border-border">
                    {readOnly ? (
                      <span
                        className="block text-right pr-1"
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: "13px",
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                          color: isChecked ? "#16a34a" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {item.monto > 0 ? item.monto.toFixed(2) : "—"}
                      </span>
                    ) : (
                      <div
                        className="flex items-center border border-input bg-background overflow-hidden"
                        style={{ height: "32px", borderRadius: "4px" }}
                      >
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.monto === 0 ? "" : item.monto}
                          onChange={(e) => handleMontoChange(i, e.target.value)}
                          className="flex-1 min-w-0 h-full bg-transparent outline-none text-right px-2"
                          style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontSize: "13px",
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                            color: "hsl(var(--foreground))",
                          }}
                        />
                        <div className="flex flex-col border-l border-input shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMontoChange(i, String(Math.round(((item.monto || 0) + 0.01) * 100) / 100))}
                            className="flex items-center justify-center w-5 h-4 text-muted-foreground hover:bg-muted hover:text-foreground leading-none text-[10px]"
                          >▲</button>
                          <button
                            type="button"
                            onClick={() => handleMontoChange(i, String(Math.max(0, Math.round(((item.monto || 0) - 0.01) * 100) / 100)))}
                            className="flex items-center justify-center w-5 h-4 text-muted-foreground hover:bg-muted hover:text-foreground border-t border-input leading-none text-[10px]"
                          >▼</button>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Checkbox */}
                  <td className="px-2">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={item.checked}
                        disabled={readOnly}
                        onCheckedChange={readOnly ? undefined : (checked) => onItemChange(i, "checked", !!checked)}
                        className="border-[#16a34a]/60 data-[state=checked]:bg-[#16a34a] data-[state=checked]:border-[#16a34a] data-[state=checked]:text-white"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
