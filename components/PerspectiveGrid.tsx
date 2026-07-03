"use client";

import { useCallback, useRef } from "react";

// One calm, on-brand indigo/violet family (soft, low-opacity, gentle glow) — matches the hero CTA
// gradient instead of the old rainbow of neon colors, which read as distracting.
const HOVER_COLORS = [
  { bg: "rgba(99, 102, 241, 0.30)",  shadow: "0 0 16px 3px rgba(99, 102, 241, 0.35)"  },  // indigo-500
  { bg: "rgba(124, 58, 237, 0.26)",  shadow: "0 0 16px 3px rgba(124, 58, 237, 0.32)"  },  // violet-600
  { bg: "rgba(129, 140, 248, 0.30)", shadow: "0 0 16px 3px rgba(129, 140, 248, 0.32)" },  // indigo-400
];

interface CellProps {
  onMouseEnter: (el: HTMLDivElement) => void;
}

function Cell({ onMouseEnter }: CellProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (!ref.current) return;
    onMouseEnter(ref.current);
  }, [onMouseEnter]);

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      className="border-[0.5px] border-black/[0.055] dark:border-white/[0.07] transition-all duration-500 ease-out"
      style={{ backgroundColor: "transparent" }}
    />
  );
}

export default function PerspectiveGrid({
  rows = 28,
  cols = 40,
}: {
  rows?: number;
  cols?: number;
}) {
  const handleCellEnter = useCallback((el: HTMLDivElement) => {
    const color = HOVER_COLORS[Math.floor(Math.random() * HOVER_COLORS.length)];
    el.style.backgroundColor = color.bg;
    el.style.boxShadow = color.shadow;
    el.style.transition = "background-color 0.1s ease, box-shadow 0.1s ease";
    el.style.zIndex = "2";
    setTimeout(() => {
      el.style.backgroundColor = "transparent";
      el.style.boxShadow = "none";
      el.style.transition = "background-color 0.7s ease, box-shadow 0.7s ease";
      el.style.zIndex = "0";
    }, 500);
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        perspective: "800px",
      }}
    >
      <div
        className="absolute inset-[-20%] grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          transform: "rotateX(0deg)",
        }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => (
          <Cell key={i} onMouseEnter={handleCellEnter} />
        ))}
      </div>
    </div>
  );
}
