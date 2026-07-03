"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import GmailMockup from "./mockups/GmailMockup";
import RemindersMockup from "./mockups/RemindersMockup";
import WhatsAppMockup from "./mockups/WhatsAppMockup";

const PATH =
  "M 50 -2 C 5 10, 95 28, 50 38 C 5 48, 95 66, 50 74 C 5 84, 95 96, 50 103";

function StepLabel({ num }: { num: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span
        style={{ fontFamily: "var(--font-dm-sans)" }}
        className="text-xs font-bold tracking-widest text-violet-600 dark:text-violet-400 uppercase transition-colors duration-300"
      >
        {num}
      </span>
    </div>
  );
}

export default function HowItWorks() {
  const outerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 1 });

  useEffect(() => {
    const measure = () => {
      if (!outerRef.current) return;
      const top = outerRef.current.offsetTop;
      const height = outerRef.current.offsetHeight;
      const vh = window.innerHeight;
      setRange({ start: top, end: top + height - vh });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const { scrollY } = useScroll();

  const rawProgress = useTransform(scrollY, [range.start, range.end], [0, 1], {
    clamp: true,
  });

  const smoothProgress = useSpring(rawProgress, {
    stiffness: 300,
    damping: 40,
    restDelta: 0.0005,
  });

  const pathLength = smoothProgress;
  const p = rawProgress;

  const introOpacity = useTransform(p, [0, 0.02, 0.15, 0.23], [1, 1, 1, 0]);
  const introY       = useTransform(p, [0, 0.05], [24, 0]);

  const step1Opacity = useTransform(p, [0.20, 0.30, 0.40, 0.48], [0, 1, 1, 0]);
  const step1Y       = useTransform(p, [0.20, 0.30], [28, 0]);

  const step2Opacity = useTransform(p, [0.46, 0.56, 0.66, 0.74], [0, 1, 1, 0]);
  const step2Y       = useTransform(p, [0.46, 0.56], [28, 0]);

  const step3Opacity = useTransform(p, [0.72, 0.82, 1, 1], [0, 1, 1, 1]);
  const step3Y       = useTransform(p, [0.72, 0.82], [28, 0]);

  const hintOpacity  = useTransform(p, [0, 0.04], [1, 0]);

  return (
    <div ref={outerRef} style={{ height: "380vh" }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#f7f7fc] dark:bg-[#04040c] transition-colors duration-300">

        {/* SVG S-curve path — two versions, one per theme */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ zIndex: 0 }}
        >
          {/* ── Light ghost + animated ── */}
          <path
            d={PATH} fill="none" stroke="#6366f1"
            strokeWidth="0.4" strokeOpacity="0.15" strokeLinecap="round"
            className="block dark:hidden"
          />
          <motion.path
            d={PATH} fill="none" stroke="#6366f1"
            strokeWidth="0.4" strokeLinecap="round"
            className="block dark:hidden"
            style={{ pathLength, strokeOpacity: 0.6 }}
          />

          {/* ── Dark ghost + animated (gradient) ── */}
          <path
            d={PATH} fill="none" stroke="#a78bfa"
            strokeWidth="0.4" strokeOpacity="0.14" strokeLinecap="round"
            className="hidden dark:block"
          />
          <motion.path
            d={PATH} fill="none" stroke="url(#pathGrad)"
            strokeWidth="0.4" strokeLinecap="round"
            className="hidden dark:block"
            style={{ pathLength, strokeOpacity: 0.9 }}
          />

          <defs>
            <linearGradient id="pathGrad" x1="50" y1="-2" x2="50" y2="103" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>
        </svg>

        {/* ── Intro Text ── */}
        <motion.div
          style={{ opacity: introOpacity, y: introY }}
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none"
        >
          <h2
            style={{ fontFamily: "var(--font-dm-serif)" }}
            className="text-4xl sm:text-5xl lg:text-6xl text-slate-900 dark:text-white leading-[1.1] tracking-[-0.01em] max-w-2xl transition-colors duration-300"
          >
            Subwise brings all your reminders in one place.
          </h2>
          <p
            style={{ fontFamily: "var(--font-dm-sans)" }}
            className="mt-5 text-lg text-slate-500 dark:text-slate-400 max-w-md leading-relaxed transition-colors duration-300"
          >
            Peace of mind — delivered straight to WhatsApp.
          </p>
        </motion.div>

        {/* ── Step 1: Connect Gmail ── */}
        <motion.div
          style={{ opacity: step1Opacity, y: step1Y }}
          className="absolute inset-0 flex items-center justify-center px-8 pointer-events-none"
        >
          <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="flex-1 text-left lg:max-w-xs">
              <StepLabel num="01" />
              <h3
                style={{ fontFamily: "var(--font-dm-serif)" }}
                className="text-3xl sm:text-4xl text-slate-900 dark:text-white leading-tight mb-4 transition-colors duration-300"
              >
                Connect Gmail
              </h3>
              <p
                style={{ fontFamily: "var(--font-dm-sans)" }}
                className="text-base text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300"
              >
                We scan read-only for recurring subscriptions — Netflix, Spotify,
                your gym, ChatGPT — and turn them into reminders automatically.
                No passwords stored. No banking access.
              </p>
            </div>
            <div className="flex-1 flex justify-center lg:justify-end">
              <GmailMockup />
            </div>
          </div>
        </motion.div>

        {/* ── Step 2: Add manual reminders ── */}
        <motion.div
          style={{ opacity: step2Opacity, y: step2Y }}
          className="absolute inset-0 flex items-center justify-center px-8 pointer-events-none"
        >
          <div className="w-full max-w-5xl flex flex-col-reverse lg:flex-row items-center gap-10 lg:gap-16">
            <div className="flex-1 flex justify-center lg:justify-start">
              <RemindersMockup />
            </div>
            <div className="flex-1 text-left lg:max-w-xs">
              <StepLabel num="02" />
              <h3
                style={{ fontFamily: "var(--font-dm-serif)" }}
                className="text-3xl sm:text-4xl text-slate-900 dark:text-white leading-tight mb-4 transition-colors duration-300"
              >
                Add what Gmail misses
              </h3>
              <p
                style={{ fontFamily: "var(--font-dm-sans)" }}
                className="text-base text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300"
              >
                Rent, EMI, insurance, school fees, investments — anything that
                repeats. Add it in seconds. Beautifully organised so nothing
                falls through the cracks.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Step 3: WhatsApp reminders ── */}
        <motion.div
          style={{ opacity: step3Opacity, y: step3Y }}
          className="absolute inset-0 flex items-center justify-center px-8 pointer-events-none"
        >
          <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="flex-1 text-left lg:max-w-xs">
              <StepLabel num="03" />
              <h3
                style={{ fontFamily: "var(--font-dm-serif)" }}
                className="text-3xl sm:text-4xl text-slate-900 dark:text-white leading-tight mb-4 transition-colors duration-300"
              >
                Get reminded on WhatsApp
              </h3>
              <p
                style={{ fontFamily: "var(--font-dm-sans)" }}
                className="text-base text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300"
              >
                No new app to install. Reminders land in the conversation you
                already open every day. Reply{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">&apos;pause&apos;</span>{" "}
                to snooze — Subwise keeps you on track.
              </p>
            </div>
            <div className="flex-1 flex justify-center lg:justify-end">
              <WhatsAppMockup />
            </div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none"
        >
          <span
            style={{ fontFamily: "var(--font-dm-sans)" }}
            className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wide uppercase transition-colors duration-300"
          >
            Scroll to see how it works
          </span>
          <motion.div
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-slate-300 dark:text-slate-600 transition-colors duration-300">
              <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </motion.div>

      </div>
    </div>
  );
}
