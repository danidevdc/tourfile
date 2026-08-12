const GREEN = "#16a34a";
const AMBER = "#f59e0b";
const RED = "#ef4444";

export type LiqStatus = 'SIN LIQUIDAR' | 'SOLICITADO' | 'PAGADO';

export function StatusBadge({ status }: { status: LiqStatus }) {
  if (status === 'SIN LIQUIDAR') {
    return (
      <span className="nd-halo-badge" style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "3px 10px", borderRadius: "4px",
        border: `1px solid ${RED}55`, background: `${RED}14`,
        fontFamily: "'Space Mono', monospace", fontSize: "9px",
        fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
        color: RED, whiteSpace: "nowrap" as const,
      }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: RED, display: "inline-block", flexShrink: 0 }} />
        SIN LIQUIDAR
      </span>
    );
  }

  if (status === 'PAGADO') {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "3px 10px", borderRadius: "4px",
        border: "1px solid #16a34a44", background: "#16a34a0f",
        whiteSpace: "nowrap" as const, flexShrink: 0,
      }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: GREEN, display: "inline-block", flexShrink: 0 }} />
        <span className="nd-shimmer-badge" style={{
          fontFamily: "'Space Mono', monospace", fontSize: "9px",
          fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
        }}>
          PAGADO
        </span>
      </span>
    );
  }

  // SOLICITADO — punto ámbar parpadeando
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 10px", borderRadius: "4px",
      border: `1px solid ${AMBER}55`, background: `${AMBER}14`,
      fontFamily: "'Space Mono', monospace", fontSize: "9px",
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
      color: AMBER, whiteSpace: "nowrap" as const,
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: AMBER, display: "inline-block", flexShrink: 0, animation: "nd-pulse 2s ease-in-out infinite" }} />
      SOLICITADO
    </span>
  );
}
