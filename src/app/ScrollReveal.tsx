"use client";

import { useEffect, useRef } from "react";

/**
 * Animación de entrada al hacer scroll, estilo producto Apple.
 *
 * Marca los elementos con `data-reveal` (y opcionalmente `data-reveal-delay`)
 * como visibles cuando entran en el viewport. Es progresivo: si JavaScript no
 * corre, el CSS de `@media (prefers-reduced-motion: no-preference)` deja todo
 * visible, así que el contenido nunca queda escondido.
 *
 * IntersectionObserver en vez de listener de scroll: no bloquea el hilo
 * principal y no necesita recalcular posiciones en cada frame.
 */
export default function ScrollReveal() {
  // guarda los elementos observados para poder dejar de observarlos
  const seen = useRef<WeakSet<Element>>(new WeakSet());

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // si el usuario pidió menos movimiento, mostramos todo y listo
    if (reduced) {
      nodes.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    if (!("IntersectionObserver" in window)) {
      nodes.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          seen.current.add(entry.target);
          observer.unobserve(entry.target);
        }
      },
      {
        // empieza a animar un poco antes de que el elemento llegue al borde
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.08,
      }
    );

    nodes.forEach((el) => observer.observe(el));

    // si la ventana pierde el foco y vuelve, los elementos ya visibles
    // deben aparecer aunque el observer no haya disparado (pestaña en background)
    const onVisible = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (!seen.current.has(el)) return;
        el.classList.add("is-revealed");
      });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}