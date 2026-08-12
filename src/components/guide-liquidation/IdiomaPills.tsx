import { Sparkles } from "lucide-react";
import { IDIOMAS, IDIOMA_LABELS, IDIOMA_COLORS, type Idioma } from "@/lib/guideLiquidationCriteriaService";

const CSS = {
  border: "hsl(var(--border))",
  mutedFg: "hsl(var(--muted-foreground))",
};

export function IdiomaPills({ value, onChange, suggested }: {
  value: Idioma | ""; onChange: (v: Idioma) => void; suggested: Idioma | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>
          Idioma del guía
        </span>
        {suggested && !value && (
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", color: IDIOMA_COLORS[suggested], display: "flex", alignItems: "center", gap: "3px" }}>
            <Sparkles size={9} /> sugerido: {IDIOMA_LABELS[suggested]}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
        {IDIOMAS.map(idioma => {
          const color = IDIOMA_COLORS[idioma];
          const sel = value === idioma;
          const sug = suggested === idioma && !value;
          return (
            <button key={idioma} onClick={() => onChange(idioma)} style={{
              padding: "6px 14px", borderRadius: "999px",
              border: `1.5px solid ${sel ? color : sug ? `${color}88` : CSS.border}`,
              background: sel ? `${color}18` : sug ? `${color}08` : "transparent",
              color: sel ? color : sug ? color : CSS.mutedFg,
              fontFamily: "'Space Mono', monospace", fontSize: "10px",
              fontWeight: sel ? 700 : 400, letterSpacing: "0.06em",
              cursor: "pointer", transition: "all 150ms",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              {sug && <Sparkles size={9} />}
              {IDIOMA_LABELS[idioma]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
