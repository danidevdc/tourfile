import { useState } from "react";

export function IconBtn({ onClick, title, color, disabled, children }: {
  onClick: () => void; title: string; color: string; disabled?: boolean; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "32px", height: "32px", borderRadius: "6px", border: `1px solid ${color}${hov ? "66" : "33"}`, background: hov ? `${color}1a` : `${color}0d`, color, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", transition: "all 150ms", opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      {children}
    </button>
  );
}
