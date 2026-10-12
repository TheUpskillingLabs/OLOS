"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

const W = 1920;
const H = 1080;

/** A letterboxed viewport that scales its 1920x1080 child to fit. */
export function Stage({ children, className = "", ...rest }: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const vp = useRef<HTMLDivElement>(null);
  const scaler = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = vp.current;
    const inner = scaler.current;
    if (!el || !inner) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const k = Math.min(r.width / W, r.height / H);
      inner.style.transform = `translate(${(r.width - W * k) / 2}px, ${(r.height - H * k) / 2}px) scale(${k})`;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <div ref={vp} className={`deck-viewport ${className}`} {...rest}>
      <div ref={scaler} className="deck-scaler">{children}</div>
    </div>
  );
}
