"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Secuencia de análisis. Es una SIMULACIÓN visual del trabajo de la IA para la
// presentación: la extracción real corre en paralelo. El recorrido
// "Nexus interpreta la obra" se muestra con estos pasos. Todo configurable aquí.
// ---------------------------------------------------------------------------
export type AnalysisStep = { id: string; label: string; detail: string; ms: number };

export const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "read", label: "Leyendo el documento", detail: "Extrayendo texto y estructura", ms: 950 },
  { id: "interpret", label: "Interpretando la obra", detail: "Detectando partidas, cantidades y especificaciones", ms: 1500 },
  { id: "requirements", label: "Consolidando requerimientos", detail: "Normalizando tipo y unidad", ms: 1000 },
  { id: "catalog", label: "Cruzando contra el catálogo Nexus", detail: "Productos, marcas y proveedores", ms: 1300 },
  { id: "match", label: "Calculando compatibilidad y cercanía", detail: "Puntaje técnico + distancia logística", ms: 1200 },
];

export const ANALYSIS_TOTAL_MS = ANALYSIS_STEPS.reduce((a, s) => a + s.ms, 0);

export function AnalysisOverlay({ open, docName }: { open: boolean; docName: string }) {
  const [active, setActive] = useState(0);
  const [counter, setCounter] = useState(0);
  const [lines, setLines] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!open) {
      setActive(0);
      setCounter(0);
      setLines(0);
      return;
    }
    let acc = 0;
    ANALYSIS_STEPS.forEach((s, i) => {
      acc += s.ms;
      timers.current.push(setTimeout(() => setActive(i + 1), acc));
    });
    const cTarget = 180 + Math.floor(Math.random() * 160);
    const lTarget = 90 + Math.floor(Math.random() * 240);
    const started = Date.now();
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / ANALYSIS_TOTAL_MS);
      setCounter(Math.floor(cTarget * p * p));
      setLines(Math.floor(lTarget * Math.min(1, p * 1.4)));
    }, 55);
    timers.current.push(tick as unknown as ReturnType<typeof setTimeout>);
    return () => {
      timers.current.forEach(clearTimeout);
      clearInterval(tick);
      timers.current = [];
    };
  }, [open]);

  if (!open) return null;
  const pct = Math.min(100, Math.round(((active + 0.4) / ANALYSIS_STEPS.length) * 100));

  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="box">
        <div className="hd">
          <div className="sp" aria-hidden />
          <div>
            <b>Nexus está interpretando la obra</b>
            <span>{docName || "Documento de consulta"}</span>
          </div>
        </div>
        <ul>
          {ANALYSIS_STEPS.map((s, i) => {
            const state = i < active ? "ok" : i === active ? "run" : "";
            return (
              <li key={s.id} className={state}>
                <span className="ic" aria-hidden>
                  {i < active ? "✓" : i === active ? <span className="mini" /> : i + 1}
                </span>
                <span>
                  {s.label}
                  {state === "run" && (
                    <span style={{ color: "var(--text-55)", fontWeight: 400 }}> — {s.detail}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="pr">
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="ft">
          <span>
            {lines} líneas leídas · <span className="n">{counter}</span> candidatos evaluados
          </span>
          <span>extracción real</span>
        </div>
      </div>
    </div>
  );
}
