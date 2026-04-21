"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Search, Pencil } from "lucide-react";
import { getAllLiquidations, type GuideLiquidation } from "@/lib/guideLiquidationService";
import { buildLiquidationPDFUrl } from "@/lib/guideLiquidationPDF";
import { LiquidationPDFPreviewModal } from "@/components/guide-liquidation/LiquidationPDFPreviewModal";

const TOKEN = { blue: "#0991ea", amber: "#f59e0b", green: "#16a34a" };
const CSS = {
  bg: "hsl(var(--background))",
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  muted: "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
  subtleBg: "hsl(var(--muted) / 0.4)",
};

function StatusBadge({ status }: { status: GuideLiquidation["status"] }) {
  const ok = status === "Liquidado";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 8px", borderRadius: "4px", border: ok ? "1px solid #16a34a55" : "1px solid #ef444455", background: ok ? "#16a34a12" : "#ef444412", fontFamily: "'Space Mono', monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: ok ? "#16a34a" : "#ef4444", whiteSpace: "nowrap" as const }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: ok ? "#16a34a" : "#ef4444", display: "inline-block", flexShrink: 0, animation: ok ? "nd-pulse 2.4s ease-in-out infinite" : "none" }} />
      {status}
    </span>
  );
}

export default function LiquidationHistoryPage() {
  const router = useRouter();
  const [all, setAll] = useState<GuideLiquidation[]>([]);
  const [filtered, setFiltered] = useState<GuideLiquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pdfPreview, setPdfPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  useEffect(() => {
    getAllLiquidations().then((data) => { setAll(data); setFiltered(data); }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.trim().toUpperCase();
    if (!q) { setFiltered(all); return; }
    setFiltered(all.filter((l) =>
      l.guideName.toUpperCase().includes(q) ||
      l.fileNumber.toUpperCase().includes(q) ||
      l.liquidationNumber.toUpperCase().includes(q) ||
      l.paxName.toUpperCase().includes(q)
    ));
  }, [search, all]);

  const handlePrint = async (liq: GuideLiquidation) => {
    setPrintingId(liq.id);
    try {
      const url = await buildLiquidationPDFUrl(liq);
      const fileName = `Liquidacion-${liq.liquidationNumber}-${liq.fileNumber}-${liq.guideName.replace(/\s+/g, "_")}.pdf`;
      setPdfPreview({ url, fileName });
    } catch (e) {
      console.error(e);
    } finally {
      setPrintingId(null);
    }
  };

  const fmt = (n: number) => n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: Date) => {
    try { return new Date(d).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
    catch { return "—"; }
  };

  const GRID = "90px 1fr 120px 80px 110px 110px 84px";

  return (
    <div style={{ minHeight: "100vh", background: CSS.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{`@keyframes nd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "28px 28px 48px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button onClick={() => router.push("/guide-liquidation")} style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${CSS.border}`, background: CSS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: CSS.mutedFg }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", color: CSS.fg }}>Historial de Liquidaciones</h1>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: CSS.mutedFg, marginTop: "2px" }}>
                {loading ? "Cargando..." : `${filtered.length} de ${all.length} registros`}
              </p>
            </div>
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", border: `1px solid ${CSS.border}`, borderRadius: "8px", padding: "0 12px", background: CSS.card, height: "36px", minWidth: "220px" }}>
            <Search size={13} color={CSS.mutedFg} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar guía, file, N°..."
              style={{ border: "none", outline: "none", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.04em", color: CSS.fg, background: "transparent", width: "100%" }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "10px 20px", borderBottom: `1px solid ${CSS.border}`, background: CSS.subtleBg }}>
            {["N°", "Guía", "File", "Fecha", "Total", "Estado", ""].map((col) => (
              <span key={col} style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>{col}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>Cargando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>
                {search ? "Sin resultados para la búsqueda" : "No hay liquidaciones registradas"}
              </span>
            </div>
          ) : (
            filtered.map((liq, i) => (
              <div key={liq.id} style={{ display: "grid", gridTemplateColumns: GRID, padding: "13px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${CSS.border}` : "none", alignItems: "center" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: TOKEN.blue, letterSpacing: "0.04em" }}>{liq.liquidationNumber}</span>
                <div>
                  <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 600, color: CSS.fg }}>{liq.guideName}</p>
                  <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg, marginTop: "2px" }}>{liq.paxName || "—"}</p>
                </div>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.fg }}>{liq.fileNumber}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg }}>{fmtDate(liq.createdAt)}</span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 700, color: CSS.fg }}>Bs. {fmt(liq.total)}</span>
                <StatusBadge status={liq.status} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                  <button
                    onClick={() => router.push(`/guide-liquidation/edit/${liq.id}`)}
                    title="Editar liquidación"
                    style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${TOKEN.amber}28`, background: `${TOKEN.amber}0d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 150ms", color: TOKEN.amber, flexShrink: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.amber}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.amber}66`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.amber}0d`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.amber}28`; }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handlePrint(liq)}
                    disabled={printingId === liq.id}
                    title="Imprimir PDF"
                    style={{ width: "32px", height: "32px", borderRadius: "8px", border: `1px solid ${TOKEN.blue}28`, background: printingId === liq.id ? CSS.muted : `${TOKEN.blue}0d`, display: "flex", alignItems: "center", justifyContent: "center", cursor: printingId === liq.id ? "wait" : "pointer", transition: "all 150ms", color: printingId === liq.id ? CSS.mutedFg : TOKEN.blue, flexShrink: 0 }}
                    onMouseEnter={(e) => { if (printingId !== liq.id) { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.blue}18`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.blue}66`; } }}
                    onMouseLeave={(e) => { if (printingId !== liq.id) { (e.currentTarget as HTMLButtonElement).style.background = `${TOKEN.blue}0d`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${TOKEN.blue}28`; } }}
                  >
                    <Printer size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <LiquidationPDFPreviewModal
        open={!!pdfPreview}
        onClose={() => { if (pdfPreview) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }}
        blobUrl={pdfPreview?.url ?? null}
        fileName={pdfPreview?.fileName ?? ""}
      />
    </div>
  );
}
