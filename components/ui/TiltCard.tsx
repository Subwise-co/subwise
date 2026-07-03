"use client";
import { useRef } from "react";

export default function TiltCard({
  children,
  accentColor,
  className = "",
}: {
  children: React.ReactNode;
  accentColor: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) translateZ(14px) scale(1.015)`;
    el.style.transition = "none";
  };

  const onMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.transition = "transform 0.6s cubic-bezier(0.22,1,0.36,1)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`relative group rounded-2xl overflow-hidden cursor-default ${className}`}
      style={{ willChange: "transform" }}
    >
      {/* Base */}
      <div
        className="absolute inset-0 rounded-2xl bg-white dark:bg-white/[0.04] border border-black/[0.07] dark:border-white/[0.08] transition-colors duration-300"
        style={{ boxShadow: "0 2px 14px rgba(0,0,0,0.04)" }}
      />
      {/* Accent top-glow on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% -10%, ${accentColor}28 0%, transparent 62%)`,
        }}
      />
      {/* Border + outer glow on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 0 1.5px ${accentColor}60, 0 16px 48px ${accentColor}14`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
