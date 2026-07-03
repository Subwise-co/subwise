"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

const WORDS = [
  "a payment",
  "a subscription",
  "a renewal",
  "a bill",
  "an EMI",
  "a due date",
];

export default function TextRotate() {
  const [index, setIndex] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const gradient =
    theme === "dark"
      ? "bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400"
      : "bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600";

  return (
    <span
      className="inline-flex items-center justify-center relative pointer-events-none select-none"
      style={{ minWidth: "260px" }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ fontFamily: "var(--font-dm-serif)" }}
          className={`${gradient} bg-clip-text text-transparent`}
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
