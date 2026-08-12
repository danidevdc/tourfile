"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Save, RefreshCw, Brain, ChevronDown, ChevronUp,
  FlaskConical, Info, Check, Plus, Sun, Moon, Users, User, Search,
} from "lucide-react";
import {
  getLiquidationCriteria,
  saveAllCriteriaRules,
  applyBestCriteriaRule,
  getTurno, getGrupo,
  type LiquidationCriteriaRule,
  IDIOMAS, TURNOS, GRUPOS,
  type Idioma, type Turno, type Grupo,
  IDIOMA_LABELS, IDIOMA_COLORS, IDIOMA_TARIFF_ORDER,
} from "@/lib/guideLiquidationCriteriaService";
import { getAllServiceOrders } from "@/lib/serviceOrderStorage";
import { useToast } from "@/hooks/use-toast";

// ── Design tokens ────────────────────────────────────────────────────────────
const CSS = {
  bg: "hsl(var(--background))",
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  muted: "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  fg: "hsl(var(--foreground))",
  subtleBg: "hsl(var(--muted) / 0.4)",
};
const BLUE   = "#0991ea";
const GREEN  = "#16a34a";
const AMBER  = "#f59e0b";
const RED    = "#ef4444";
const PURPLE = "#7c3aed";

// ── Price suggestion logic ───────────────────────────────────────────────────
// Relative multipliers: Japonés(1.15) > Alemán(1.0) > Italiano(0.9) > Inglés(0.8) > Español(0.65)
const BASE_ANCHORS: Record<string, number> = {
  default: 120,
};
const IDIOMA_MULT: Record<Idioma, number> = {
  JAPONES:  1.15,
  ALEMAN:   1.00,
  ITALIANO: 0.90,
  INGLES:   0.80,
  ESPAÑOL:  0.65,
};
const TURNO_MULT: Record<Turno, number>  = { NOCTURNO: 1.35, DIURNO: 1.00 };
const GRUPO_MULT: Record<Grupo, number>  = { INDIVIDUAL: 1.00, GRUPO: 0.85 };

const ANALYSIS_CACHE_KEY = "criteria_activity_stats_v1";

function suggestMonto(baseAnchor: number, idioma: Idioma, turno: Turno, grupo: Grupo): number {
  return Math.round(
    baseAnchor * IDIOMA_MULT[idioma] * TURNO_MULT[turno] * GRUPO_MULT[grupo] / 5
  ) * 5; // round to nearest 5
}

// ── Types ────────────────────────────────────────────────────────────────────
interface ActivityStats {
  name: string;
  count: number;
  diurnoPct: number;  // 0–100
  grupoPct: number;   // 0–100 (% of occurrences with 5+ pax)
  sample: string[];
}

// Matrix key: `${actividad}|${idioma}|${turno}|${grupo}`
type PriceMatrix = Map<string, number>;

function matrixKey(a: string, i: Idioma, t: Turno, g: Grupo) {
  return `${a}|${i}|${t}|${g}`;
}

// ── Small components ─────────────────────────────────────────────────────────
function IdiomaTag({ idioma }: { idioma: Idioma }) {
  const c = IDIOMA_COLORS[idioma];
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "999px",
      border: `1px solid ${c}44`, background: `${c}12`,
      fontFamily: "'Space Mono', monospace", fontSize: "9px",
      fontWeight: 700, letterSpacing: "0.06em", color: c,
      whiteSpace: "nowrap" as const,
    }}>
      {IDIOMA_LABELS[idioma]}
    </span>
  );
}

function TurnoTag({ turno }: { turno: Turno }) {
  const c = turno === "NOCTURNO" ? PURPLE : AMBER;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "4px",
      border: `1px solid ${c}44`, background: `${c}10`,
      fontFamily: "'Space Mono', monospace", fontSize: "9px",
      fontWeight: 600, color: c, whiteSpace: "nowrap" as const,
    }}>
      {turno === "NOCTURNO" ? <Moon size={10} strokeWidth={1.5} /> : <Sun size={10} strokeWidth={1.5} />}
      {turno === "NOCTURNO" ? "Nocturno" : "Diurno"}
    </span>
  );
}

function GrupoTag({ grupo }: { grupo: Grupo }) {
  const c = grupo === "GRUPO" ? GREEN : BLUE;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "4px",
      border: `1px solid ${c}44`, background: `${c}10`,
      fontFamily: "'Space Mono', monospace", fontSize: "9px",
      fontWeight: 600, color: c, whiteSpace: "nowrap" as const,
    }}>
      {grupo === "GRUPO" ? <Users size={10} strokeWidth={1.5} /> : <User size={10} strokeWidth={1.5} />}
      {grupo === "GRUPO" ? "Grupo (5+)" : "Individual"}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LiquidationCriteriaPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [analyzing, setAnalyzing]       = useState(false);
  const [analyzed, setAnalyzed]          = useState(false);
  const [activityStats, setActivityStats] = useState<ActivityStats[]>([]);
  // All activities found in orders with full stats (for "add more" selector)
  const [allActivities, setAllActivities] = useState<ActivityStats[]>([]);
  const [priceMatrix, setPriceMatrix]    = useState<PriceMatrix>(new Map());
  const [saving, setSaving]              = useState(false);
  const [saved, setSaved]                = useState(false);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  // Add activity dropdown
  const [addDropdownOpen, setAddDropdownOpen]   = useState(false);
  const [addActivitySearch, setAddActivitySearch] = useState("");
  const [addActivityValue, setAddActivityValue]   = useState("");

  // Test panel
  const [testOpen, setTestOpen]          = useState(false);
  const [testSvc, setTestSvc]            = useState("");
  const [testHora, setTestHora]          = useState("08:00");
  const [testIdioma, setTestIdioma]      = useState<Idioma>("ESPAÑOL");
  const [testPax, setTestPax]            = useState(2);
  const [testResult, setTestResult]      = useState<number | null | undefined>(undefined);

  // Load existing rules + cached analysis on mount
  useEffect(() => {
    getLiquidationCriteria().then((existing) => {
      if (existing.length === 0) return;
      const m = new Map<string, number>();
      existing.forEach((r) => {
        if (r.actividad && r.idioma && r.turno && r.grupo) {
          m.set(matrixKey(r.actividad, r.idioma as Idioma, r.turno as Turno, r.grupo as Grupo), r.monto);
        }
      });
      if (m.size > 0) {
        setPriceMatrix(m);
        setAnalyzed(true);
        // Restore cached activity stats from localStorage
        try {
          const cached = localStorage.getItem(ANALYSIS_CACHE_KEY);
          if (cached) {
            const { stats, allActs } = JSON.parse(cached) as { stats: ActivityStats[]; allActs: ActivityStats[] };
            setActivityStats(stats);
            setAllActivities(allActs);
          }
        } catch { /* ignore */ }
      }
    }).catch(console.error);
  }, []);

  // ── Analysis ──────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const orders = await getAllServiceOrders();
      const map = new Map<string, { count: number; diurnoCount: number; grupoCount: number; samples: Set<string> }>();

      for (const order of orders) {
        if (order.status === "eliminado") continue;
        const pax = parseInt(order.data?.nPax ?? "1", 10) || 1;
        for (const svc of (order.data?.services ?? [])) {
          if (!svc.servicio) continue;
          const name = svc.servicio.trim().toUpperCase();
          if (!map.has(name)) map.set(name, { count: 0, diurnoCount: 0, grupoCount: 0, samples: new Set() });
          const entry = map.get(name)!;
          entry.count++;
          if (getTurno(svc.hora) === "DIURNO") entry.diurnoCount++;
          if (getGrupo(pax) === "GRUPO") entry.grupoCount++;
          entry.samples.add(svc.servicio.trim());
        }
      }

      // All activities sorted by frequency — full stats
      const allSorted = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
      const allActs: ActivityStats[] = allSorted.map(([name, d]) => ({
        name,
        count: d.count,
        diurnoPct: Math.round((d.diurnoCount / d.count) * 100),
        grupoPct:  Math.round((d.grupoCount  / d.count) * 100),
        sample: Array.from(d.samples).slice(0, 3),
      }));
      setAllActivities(allActs);

      // Top 30 for the main table
      const stats = allActs.slice(0, 30);
      setActivityStats(stats);

      // Build initial price matrix — keep existing prices, only fill missing
      const m = new Map<string, number>(priceMatrix);
      for (const stat of stats) {
        const anchor = BASE_ANCHORS[stat.name] ?? BASE_ANCHORS.default;
        for (const idioma of IDIOMAS) {
          for (const turno of TURNOS) {
            for (const grupo of GRUPOS) {
              const key = matrixKey(stat.name, idioma, turno, grupo);
              if (!m.has(key)) {
                // 0% nocturno → all NOCTURNO prices = 0; 0% diurno → all DIURNO prices = 0
                const neverNocturno = stat.diurnoPct === 100;
                const neverDiurno   = stat.diurnoPct === 0;
                const neverGrupo    = stat.grupoPct  === 0;
                const neverIndiv    = stat.grupoPct  === 100;
                if (turno === "NOCTURNO" && neverNocturno) { m.set(key, 0); continue; }
                if (turno === "DIURNO"   && neverDiurno)   { m.set(key, 0); continue; }
                if (grupo === "GRUPO"    && neverGrupo)     { m.set(key, 0); continue; }
                if (grupo === "INDIVIDUAL" && neverIndiv)   { m.set(key, 0); continue; }
                m.set(key, suggestMonto(anchor, idioma, turno, grupo));
              }
            }
          }
        }
      }
      setPriceMatrix(m);
      setAnalyzed(true);
      setSaved(false);

      try {
        localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify({ stats, allActs }));
      } catch { /* ignore quota errors */ }
    } catch (e) {
      console.error(e);
      toast({ title: "Error al analizar órdenes", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [priceMatrix, toast]);

  // ── Save all ──────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const rules: Omit<LiquidationCriteriaRule, "id">[] = [];
      priceMatrix.forEach((monto, key) => {
        const [actividad, idioma, turno, grupo] = key.split("|") as [string, Idioma, Turno, Grupo];
        rules.push({ actividad, idioma, turno, grupo, monto, isActive: true, notes: "" });
      });
      await saveAllCriteriaRules(rules);
      setSaved(true);
      toast({ title: `✓ ${rules.length} reglas guardadas` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Test ──────────────────────────────────────────────────────────────────
  const runTest = () => {
    const rules: LiquidationCriteriaRule[] = [];
    priceMatrix.forEach((monto, key) => {
      const [actividad, idioma, turno, grupo] = key.split("|") as [string, Idioma, Turno, Grupo];
      rules.push({ id: key, actividad, idioma, turno, grupo, monto, isActive: true, notes: "" });
    });
    const result = applyBestCriteriaRule(rules, { servicio: testSvc, hora: testHora, paxCount: testPax }, testIdioma);
    setTestResult(result);
  };

  // ── Add extra activity ────────────────────────────────────────────────────
  const addExtraActivity = (name: string) => {
    if (!name || activityStats.some((s) => s.name === name)) return;
    // Use real stats from allActivities if available, otherwise empty stats
    const realStat = allActivities.find((a) => a.name === name);
    const newStat: ActivityStats = realStat ?? { name, count: 0, diurnoPct: 50, grupoPct: 50, sample: [] };
    // Always append at the end of the table
    setActivityStats((prev) => [...prev, newStat]);
    const anchor = BASE_ANCHORS[name] ?? BASE_ANCHORS.default;
    const neverNocturno = newStat.diurnoPct === 100;
    const neverDiurno   = newStat.diurnoPct === 0;
    const neverGrupo    = newStat.grupoPct  === 0;
    const neverIndiv    = newStat.grupoPct  === 100;
    const m = new Map<string, number>(priceMatrix);
    for (const idioma of IDIOMAS) {
      for (const turno of TURNOS) {
        for (const grupo of GRUPOS) {
          const key = matrixKey(name, idioma, turno, grupo);
          if (!m.has(key)) {
            if (turno === "NOCTURNO" && neverNocturno) { m.set(key, 0); continue; }
            if (turno === "DIURNO"   && neverDiurno)   { m.set(key, 0); continue; }
            if (grupo === "GRUPO"    && neverGrupo)     { m.set(key, 0); continue; }
            if (grupo === "INDIVIDUAL" && neverIndiv)   { m.set(key, 0); continue; }
            m.set(key, suggestMonto(anchor, idioma, turno, grupo));
          }
        }
      }
    }
    setPriceMatrix(m);
    setExpandedActivity(name);
    setAddActivityValue("");
    setAddActivitySearch("");
    setAddDropdownOpen(false);
    setSaved(false);
    // Scroll to bottom so the user sees the new row
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 100);
  };

  // ── Price cell editor ─────────────────────────────────────────────────────
  const setPrice = (activity: string, idioma: Idioma, turno: Turno, grupo: Grupo, val: number) => {
    const key = matrixKey(activity, idioma, turno, grupo);
    setPriceMatrix((prev) => new Map(prev).set(key, val));
    setSaved(false);
  };

  const getPrice = (activity: string, idioma: Idioma, turno: Turno, grupo: Grupo): number => {
    return priceMatrix.get(matrixKey(activity, idioma, turno, grupo)) ?? 0;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: CSS.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px 28px 60px", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button onClick={() => router.push("/guide-liquidation")} style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${CSS.border}`, background: CSS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: CSS.mutedFg }}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.01em", color: CSS.fg }}>
                Motor de Criterios
              </h1>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: CSS.mutedFg, marginTop: "2px" }}>
                Tabla de precios por actividad · idioma · turno · grupo
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              style={{ height: "36px", padding: "0 16px", borderRadius: "8px", border: `1px solid ${BLUE}44`, background: `${BLUE}10`, color: BLUE, fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: analyzing ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 150ms" }}
            >
              <RefreshCw size={13} style={{ animation: analyzing ? "spin 1s linear infinite" : "none" }} />
              {analyzing ? "Analizando..." : analyzed ? "Re-analizar órdenes" : "Analizar órdenes"}
            </button>
            {analyzed && (
              <button
                onClick={handleSaveAll}
                disabled={saving || saved}
                style={{ height: "36px", padding: "0 18px", borderRadius: "8px", border: "none", background: saved ? GREEN : saving ? CSS.muted : GREEN, color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: saving || saved ? "default" : "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: saved ? 0.7 : 1 }}
              >
                {saved ? <Check size={13} /> : <Save size={13} />}
                {saving ? "Guardando..." : saved ? "Guardado" : "Guardar Todo"}
              </button>
            )}
          </div>
        </div>

        {/* Info banner */}
        <div style={{ border: `1px solid ${BLUE}28`, borderRadius: "10px", padding: "16px 20px", background: `${BLUE}07`, display: "flex", gap: "12px" }}>
          <Info size={16} color={BLUE} style={{ flexShrink: 0, marginTop: "1px" }} />
          <div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 600, color: BLUE, marginBottom: "6px" }}>¿Cómo funciona?</p>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg, lineHeight: 1.8, letterSpacing: "0.03em" }}>
              1. <strong>Analizá</strong> tus órdenes existentes — el sistema detecta las actividades reales con su frecuencia.<br />
              2. Se generan <strong>precios sugeridos</strong> en Bs. para cada combinación de actividad × idioma × turno × grupo.<br />
              3. <strong>Editá</strong> los precios que quieras directamente en la tabla.<br />
              4. <strong>Guardá Todo</strong> — desde ese momento el generador de liquidaciones aplica los precios automáticamente.<br />
              <br />
              <strong>Turno:</strong> Diurno = 07:00–20:59 · Nocturno = 21:00–06:59 &nbsp;|&nbsp;
              <strong>Grupo:</strong> Individual = 1–4 pax · Grupo = 5+ pax &nbsp;|&nbsp;
              <strong>Tarifa:</strong> Japonés &gt; Alemán &gt; Italiano &gt; Inglés &gt; Español
            </p>
          </div>
        </div>

        {/* Not analyzed yet */}
        {!analyzed && !analyzing && (
          <div style={{ border: `2px dashed ${CSS.border}`, borderRadius: "12px", padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <Brain size={40} color={CSS.mutedFg} />
            <div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "16px", fontWeight: 600, color: CSS.fg, marginBottom: "6px" }}>
                No hay precios configurados todavía
              </p>
              <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.04em" }}>
                Presioná &quot;Analizar órdenes&quot; para que el sistema detecte tus actividades reales<br />y genere una tabla de precios sugeridos que podés editar.
              </p>
            </div>
            <button onClick={runAnalysis} style={{ height: "40px", padding: "0 24px", borderRadius: "8px", background: BLUE, border: "none", color: "white", fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              <RefreshCw size={14} />
              Analizar mis órdenes ahora
            </button>
          </div>
        )}

        {/* Analyzing spinner */}
        {analyzing && (
          <div style={{ border: `1px solid ${CSS.border}`, borderRadius: "12px", padding: "40px", textAlign: "center" }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <RefreshCw size={28} color={BLUE} style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }} />
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, letterSpacing: "0.06em" }}>
              Analizando órdenes de servicio...
            </p>
          </div>
        )}

        {/* Activity stats + price matrix */}
        {analyzed && !analyzing && activityStats.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activityStats.map((stat) => {
              const isExpanded = expandedActivity === stat.name;
              const nocturnoPct = 100 - stat.diurnoPct;
              return (
                <div key={stat.name} style={{ background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", overflow: "hidden" }}>
                  {/* Activity header row */}
                  <button
                    onClick={() => setExpandedActivity(isExpanded ? null : stat.name)}
                    style={{ width: "100%", padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", background: CSS.subtleBg, border: "none", cursor: "pointer", borderBottom: isExpanded ? `1px solid ${CSS.border}` : "none", textAlign: "left" as const }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" as const }}>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: CSS.fg }}>{stat.name}</span>
                        {stat.count > 0 && (
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, background: CSS.muted, borderRadius: "6px", padding: "3px 10px", letterSpacing: "0.03em", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ color: CSS.fg }}>{stat.count}</strong> usos
                            <span style={{ color: CSS.border }}>·</span>
                            <Sun size={11} strokeWidth={1.5} color={AMBER} /><strong style={{ color: CSS.fg }}>{stat.diurnoPct}%</strong>
                            <span style={{ color: CSS.border }}>·</span>
                            <Moon size={11} strokeWidth={1.5} color={PURPLE} /><strong style={{ color: CSS.fg }}>{nocturnoPct}%</strong>
                            <span style={{ color: CSS.border }}>·</span>
                            <Users size={11} strokeWidth={1.5} color={GREEN} /><strong style={{ color: CSS.fg }}>{stat.grupoPct}%</strong>
                            <span style={{ color: CSS.border }}>·</span>
                            <User size={11} strokeWidth={1.5} color={BLUE} /><strong style={{ color: CSS.fg }}>{100 - stat.grupoPct}%</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg }}>desde</span>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", fontWeight: 700, color: CSS.fg }}>
                        Bs. {(() => {
                          const vals: number[] = [];
                          for (const i of IDIOMA_TARIFF_ORDER) for (const t of TURNOS) for (const g of GRUPOS) {
                            const v = priceMatrix.get(matrixKey(stat.name, i, t, g));
                            if (v !== undefined && v > 0) vals.push(v);
                          }
                          return vals.length > 0 ? Math.min(...vals) : "—";
                        })()}

                      </span>
                      {isExpanded ? <ChevronUp size={14} color={CSS.mutedFg} /> : <ChevronDown size={14} color={CSS.mutedFg} />}
                    </div>
                  </button>

                  {/* Expanded price table */}
                  {isExpanded && (
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>

                      {/* Price grid: rows = turno+grupo combos, cols = idiomas */}
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "680px" }}>
                          <thead>
                            <tr>
                              <th style={{ padding: "8px 12px", textAlign: "left" as const, fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg, borderBottom: `1px solid ${CSS.border}`, whiteSpace: "nowrap" as const }}>
                                Turno / Grupo
                              </th>
                              {IDIOMA_TARIFF_ORDER.map((idioma) => (
                                <th key={idioma} style={{ padding: "8px 12px", textAlign: "center" as const, borderBottom: `1px solid ${CSS.border}` }}>
                                  <IdiomaTag idioma={idioma} />
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {TURNOS.map((turno) =>
                              GRUPOS.map((grupo, gi) => {
                                const isLast = turno === "NOCTURNO" && gi === GRUPOS.length - 1;
                                return (
                                  <tr key={`${turno}-${grupo}`} style={{ borderBottom: isLast ? "none" : `1px solid ${CSS.border}` }}>
                                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" as const }}>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                        <TurnoTag turno={turno} />
                                        <GrupoTag grupo={grupo} />
                                      </div>
                                    </td>
                                    {IDIOMA_TARIFF_ORDER.map((idioma) => {
                                      const val = getPrice(stat.name, idioma, turno, grupo);
                                      const color = IDIOMA_COLORS[idioma];
                                      return (
                                        <td key={idioma} style={{ padding: "8px 12px", textAlign: "center" as const }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg }}>Bs.</span>
                                            <input
                                              type="number"
                                              min={0}
                                              step={5}
                                              value={val}
                                              onChange={(e) => setPrice(stat.name, idioma, turno, grupo, parseFloat(e.target.value) || 0)}
                                              style={{
                                                width: "70px",
                                                fontFamily: "'Space Grotesk', sans-serif",
                                                fontSize: "14px",
                                                fontWeight: 700,
                                                color: color,
                                                background: `${color}0a`,
                                                border: `1px solid ${color}33`,
                                                borderRadius: "6px",
                                                padding: "4px 8px",
                                                textAlign: "center" as const,
                                                outline: "none",
                                              }}
                                            />
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Analyzed but no activity stats (loaded from existing rules) */}
        {analyzed && !analyzing && activityStats.length === 0 && priceMatrix.size > 0 && (
          <div style={{ border: `1px solid ${CSS.border}`, borderRadius: "10px", padding: "24px", background: CSS.card }}>
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, textAlign: "center" }}>
              Hay {priceMatrix.size} precios guardados. Presioná &quot;Re-analizar órdenes&quot; para ver la tabla completa.
            </p>
          </div>
        )}

        {/* Add extra activity — compact button with dropdown */}
        {analyzed && !analyzing && (
          <div style={{ position: "relative" as const, display: "flex", justifyContent: "flex-end" as const }}>
            <button
              onClick={() => { setAddActivitySearch(""); setAddActivityValue(""); setAddDropdownOpen((o) => !o); }}
              style={{ height: "36px", padding: "0 16px", borderRadius: "8px", border: `1px solid ${BLUE}44`, background: `${BLUE}10`, color: BLUE, fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 150ms" }}
            >
              <Plus size={13} />
              Agregar actividad
              {addDropdownOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {addDropdownOpen && (() => {
              const available = allActivities.filter((a) => !activityStats.some((s) => s.name === a.name));
              const filtered = addActivitySearch
                ? available.filter((a) => a.name.toLowerCase().includes(addActivitySearch.toLowerCase()))
                : available;
              return (
                <div style={{ position: "absolute" as const, top: "calc(100% + 6px)", right: 0, left: 0, zIndex: 50, background: CSS.card, border: `1px solid ${CSS.border}`, borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                  {/* Search */}
                  <div style={{ padding: "10px 12px", borderBottom: `1px solid ${CSS.border}`, position: "relative" as const }}>
                    <Search size={13} color={CSS.mutedFg} style={{ position: "absolute", left: "22px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      autoFocus
                      placeholder="Buscar actividad..."
                      value={addActivitySearch}
                      onChange={(e) => { setAddActivitySearch(e.target.value); setAddActivityValue(""); }}
                      style={{ width: "100%", paddingLeft: "28px", paddingRight: "8px", paddingTop: "6px", paddingBottom: "6px", fontFamily: "'Space Mono', monospace", fontSize: "12px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.bg, color: CSS.fg, outline: "none", boxSizing: "border-box" as const }}
                    />
                  </div>

                  {/* List */}
                  <div style={{ maxHeight: "260px", overflowY: "auto", padding: "6px" }}>
                    {available.length === 0 ? (
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, textAlign: "center" as const, padding: "16px 0" }}>
                        Todas las actividades ya tienen precios.
                      </p>
                    ) : filtered.length === 0 ? (
                      <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg, padding: "12px 8px" }}>
                        Sin resultados para &quot;{addActivitySearch}&quot;
                      </p>
                    ) : filtered.map((a) => {
                      const isSelected = addActivityValue === a.name;
                      const noctPct = 100 - a.diurnoPct;
                      return (
                        <button
                          key={a.name}
                          onClick={() => addExtraActivity(a.name)}
                          style={{ width: "100%", textAlign: "left" as const, padding: "8px 10px", borderRadius: "6px", border: "none", background: isSelected ? `${BLUE}10` : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", transition: "background 100ms" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${BLUE}0a`; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isSelected ? `${BLUE}10` : "transparent"; }}
                        >
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "13px", fontWeight: 600, color: CSS.fg, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {a.name}
                          </span>
                          {a.count > 0 && (
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "10px", color: CSS.mutedFg, background: CSS.muted, borderRadius: "4px", padding: "2px 7px", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <strong style={{ color: CSS.fg }}>{a.count}</strong> usos
                              <span style={{ opacity: 0.4 }}>·</span>
                              <Sun size={10} strokeWidth={1.5} color={AMBER} /><strong style={{ color: CSS.fg }}>{a.diurnoPct}%</strong>
                              <span style={{ opacity: 0.4 }}>·</span>
                              <Moon size={10} strokeWidth={1.5} color={PURPLE} /><strong style={{ color: CSS.fg }}>{noctPct}%</strong>
                              <span style={{ opacity: 0.4 }}>·</span>
                              <Users size={10} strokeWidth={1.5} color={GREEN} /><strong style={{ color: CSS.fg }}>{a.grupoPct}%</strong>
                              <span style={{ opacity: 0.4 }}>·</span>
                              <User size={10} strokeWidth={1.5} color={BLUE} /><strong style={{ color: CSS.fg }}>{100 - a.grupoPct}%</strong>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Test panel */}
        <div style={{ border: `1px solid ${CSS.border}`, borderRadius: "10px", overflow: "hidden", background: CSS.card }}>
          <button onClick={() => setTestOpen((o) => !o)} style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: CSS.subtleBg, border: "none", cursor: "pointer", borderBottom: testOpen ? `1px solid ${CSS.border}` : "none" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FlaskConical size={14} color={AMBER} />
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase" as const, color: AMBER, fontWeight: 700 }}>
                Probar Motor
              </span>
            </span>
            {testOpen ? <ChevronUp size={14} color={CSS.mutedFg} /> : <ChevronDown size={14} color={CSS.mutedFg} />}
          </button>
          {testOpen && (
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 80px", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Servicio</label>
                  <input value={testSvc} onChange={(e) => setTestSvc(e.target.value.toUpperCase())} placeholder="Ej: CITY TOUR LA PAZ" style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", padding: "7px 10px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.card, color: CSS.fg, outline: "none" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Hora</label>
                  <input type="time" value={testHora} onChange={(e) => setTestHora(e.target.value)} style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", padding: "7px 10px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.card, color: CSS.fg, outline: "none" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Idioma</label>
                  <select value={testIdioma} onChange={(e) => setTestIdioma(e.target.value as Idioma)} style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", padding: "7px 10px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.card, color: CSS.fg, outline: "none", cursor: "pointer" }}>
                    {IDIOMAS.map((i) => <option key={i} value={i}>{IDIOMA_LABELS[i]}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" as const, color: CSS.mutedFg }}>Nro Pax</label>
                  <input type="number" min={1} value={testPax} onChange={(e) => setTestPax(parseInt(e.target.value) || 1)} style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", padding: "7px 10px", borderRadius: "6px", border: `1px solid ${CSS.border}`, background: CSS.card, color: CSS.fg, outline: "none" }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button onClick={runTest} style={{ height: "32px", padding: "0 16px", borderRadius: "6px", background: AMBER, border: "none", color: "white", fontFamily: "'Space Mono', monospace", fontSize: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FlaskConical size={12} /> Probar
                </button>
                {testResult !== undefined && (
                  testResult === null
                    ? <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "15px", fontWeight: 700, color: RED }}>Sin regla aplicable → Bs. 0</span>
                    : (
                      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "11px", color: CSS.mutedFg }}>
                          {getTurno(testHora)} · {getGrupo(testPax)} →
                        </span>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "20px", fontWeight: 700, color: GREEN }}>
                          Bs. {testResult.toFixed(2)}
                        </span>
                      </div>
                    )
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
