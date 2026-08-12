const CSS = {
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
};

export function InfoCard({ fields }: { fields: { label: string; value: React.ReactNode; accent?: string }[] }) {
  return (
    <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", padding: "16px 20px", display: "flex", gap: "32px", flexWrap: "wrap" as const }}>
      {fields.map(({ label, value, accent }) => (
        <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>{label}</span>
          <span style={{ fontFamily: accent ? "'Space Grotesk', sans-serif" : "'Space Mono', monospace", fontSize: accent ? "14px" : "13px", fontWeight: accent ? 700 : 400, color: accent ?? CSS.fg }}>{value}</span>
        </div>
      ))}
    </div>
  );
}
