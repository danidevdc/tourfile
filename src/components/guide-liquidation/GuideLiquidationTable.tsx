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
      <div className="rounded-xl border border-border bg-card flex items-center justify-center h-48">
        <p className="text-sm text-muted-foreground">
          Ingresá un File y seleccioná un Guía para buscar los servicios.
        </p>
      </div>
    );
  }

  const handleMontoChange = (i: number, raw: string) => {
    const value = parseFloat(raw) || 0;
    onItemChange(i, "monto", value);
    onItemChange(i, "checked", value > 0);
  };

  const borderClass = readOnly
    ? "border-green-400/60 dark:border-green-600/50"
    : "border-border";

  const headerClass = readOnly
    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400"
    : "bg-muted border-border text-primary";

  return (
    <div className={`rounded-xl border ${borderClass} bg-card overflow-hidden`}>
      {readOnly && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800/50">
          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">
            Liquidación registrada — solo lectura
          </span>
        </div>
      )}
      <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
        <table className="w-full table-fixed text-sm min-w-[700px]">
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
            <tr className={`${headerClass} border-b h-11 text-[11px] font-bold tracking-wide uppercase divide-x divide-border`}>
              <th className="text-left pl-4 pr-2 font-bold">Fecha</th>
              <th className="text-left px-2 font-bold">Hora</th>
              <th className="text-left px-2 font-bold">File</th>
              <th className="text-left px-2 font-bold">Servicio</th>
              <th className="text-left px-2 font-bold">Nombre Pax</th>
              <th className="text-center px-2 font-bold">Nro Pax</th>
              <th className="text-right pr-3 pl-2 font-bold">Monto (Bs.)</th>
              <th className="px-2">
                <div className="flex justify-center">
                  <Checkbox disabled className="opacity-40" />
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {items.map((item, i) => (
              <tr
                key={`${item.serviceOrderId}-${i}`}
                className={`h-12 divide-x divide-dashed divide-border ${
                  readOnly
                    ? item.checked
                      ? i % 2 === 1 ? "bg-green-50/60 dark:bg-green-950/20" : "bg-green-50/30 dark:bg-green-950/10"
                      : "bg-muted/30 opacity-50"
                    : i % 2 === 1 ? "bg-muted/20" : "bg-card"
                }`}
              >
                <td className="pl-4 pr-2 text-foreground overflow-hidden"><span className="block truncate">{item.fecha}</span></td>
                <td className="px-2 text-muted-foreground overflow-hidden"><span className="block truncate">{item.hora}</span></td>
                <td className="px-2 text-primary font-semibold uppercase overflow-hidden"><span className="block truncate">{item.fileNumber}</span></td>
                <td className="px-2 text-foreground overflow-hidden">
                  <span className="block truncate">{item.servicio}</span>
                </td>
                <td className="px-2 text-muted-foreground overflow-hidden">
                  <span className="block truncate">{item.paxName}</span>
                </td>
                <td className="px-2 text-center font-semibold text-foreground overflow-hidden">{item.paxCount}</td>
                <td className="pl-2 pr-2">
                  {readOnly ? (
                    <span className={`block text-right pr-2 text-sm font-semibold ${item.checked ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                      {item.monto > 0 ? item.monto.toFixed(2) : "—"}
                    </span>
                  ) : (
                    <div className="flex items-center h-8 rounded-md border border-input bg-background overflow-hidden">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.monto === 0 ? "" : item.monto}
                        onChange={(e) => handleMontoChange(i, e.target.value)}
                        className="flex-1 min-w-0 h-full text-right text-sm font-semibold text-primary bg-transparent px-2 outline-none"
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
                <td className="px-2">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={item.checked}
                      disabled={readOnly}
                      onCheckedChange={readOnly ? undefined : (checked) => onItemChange(i, "checked", !!checked)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
