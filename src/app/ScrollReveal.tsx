"use client";

import { useEffect } from "react";

/** Content stays visible until the observer is ready; each entrance runs once. */
export default function ScrollReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.revealState = "visible";
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

    for (const node of nodes) {
      // Do not hide content already on screen when restoring a scroll position.
      if (node.getBoundingClientRect().top < window.innerHeight * 0.9) continue;
      node.dataset.revealState = "pending";
      observer.observe(node);
    }

    const showAll = () => {
      if (!motion.matches) return;
      observer.disconnect();
      nodes.forEach((node) => delete node.dataset.revealState);
    };
    motion.addEventListener("change", showAll);

    return () => {
      observer.disconnect();
      motion.removeEventListener("change", showAll);
      nodes.forEach((node) => delete node.dataset.revealState);
    };
  }, []);

  return null;
}
