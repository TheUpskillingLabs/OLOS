"use client";

import { useEffect, useRef } from "react";

/* The landing hero copy fades — and drifts up a touch — as the hero scrolls
   out of view: a scroll-linked opacity ramp over the hero's own height. Runs
   on a passive listener, batched into one rAF per frame, and writes styles
   imperatively so it never triggers a React re-render. Honours
   prefers-reduced-motion (no effect at all — the copy stays put, fully
   visible). Wraps the server-rendered hero copy; the .hero-inner class it
   carries is what the layout CSS targets, unchanged from before. */
export default function HeroFade({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hero = el.closest(".hero-band") as HTMLElement | null;
    let raf = 0;

    const apply = () => {
      raf = 0;
      // Fade to nothing over ~two-thirds of the hero's height, so the copy is
      // gone well before the hero's bottom clears the viewport.
      const span = (hero?.offsetHeight ?? window.innerHeight) * 0.68;
      const p = span > 0 ? Math.min(Math.max(window.scrollY / span, 0), 1) : 0;
      el.style.opacity = String(1 - p);
      el.style.transform = `translate3d(0, ${(-p * 44).toFixed(1)}px, 0)`;
      // Once invisible, don't let the faded buttons swallow clicks.
      el.style.pointerEvents = p >= 1 ? "none" : "";
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    el.style.willChange = "opacity, transform";
    apply(); // seed the state — covers a reload at a non-zero scroll offset
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hero-inner" ref={ref}>
      {children}
    </div>
  );
}
