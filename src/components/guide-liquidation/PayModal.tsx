import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { GuideLiquidation } from "@/lib/guideLiquidationService";

const CSS = {
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
  bg: "hsl(var(--background))",
};
const GREEN = "#16a34a";

export function PayModal({ liq, onConfirm, onCancel, loading }: {
  liq: GuideLiquidation; onConfirm: (date: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2 });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
      <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "12px", padding: "28px 32px", width: "360px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 700, color: CSS.fg, marginBottom: "6px" }}>Confirmar pago</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em" }}>
              {liq.guideName} · {liq.liquidationNumber}
            </p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, color: GREEN, marginTop: "10px" }}>
              Bs. {fmt(liq.total)}
            </p>
          </div>
          <button onClick={onCancel} style={{ width: "30px", height: "30px", borderRadius: "6px", border: "1px solid #ef444433", background: "#ef44440d", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Fecha de pago</label>
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, fontFamily: "'Space Mono', monospace", fontSize: "13px", outline: "none", width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={loading}
            style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(payDate)} disabled={loading || !payDate}
            style={{ height: "36px", padding: "0 20px", borderRadius: "8px", border: "none", background: GREEN, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
            Confirmar pago
          </button>
        </div>
      </div>
    </div>
  );
}
