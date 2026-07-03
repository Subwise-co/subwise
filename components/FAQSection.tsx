"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    q: "How does Subwise find my subscriptions?",
    a: "We connect to your Gmail with read-only access and scan for recurring payment receipts — Netflix, Spotify, Amazon Prime, and hundreds more. We never read personal emails, access your password, or view anything outside of receipts.",
  },
  {
    q: "Do I need to install another app?",
    a: "No. Subwise sends reminders directly to WhatsApp — the app you already open every day. Connect your accounts once and you're done. No new app to download, no new habit to build.",
  },
  {
    q: "Can Subwise access my bank account?",
    a: "Never. Subwise only reads Gmail receipts. We have zero connection to your bank account, debit or credit cards, or any financial institution. We cannot move money or initiate any transactions.",
  },
  {
    q: "What can Subwise actually do with my Gmail?",
    a: "Read only — and only receipts. We cannot send emails, delete emails, reply, or access any folder other than subscription-related receipts. Our Gmail access is the narrowest scope Google allows.",
  },
  {
    q: "Can I add reminders that aren't in my email?",
    a: "Absolutely. Rent, EMI, insurance, school fees, SIPs — anything recurring can be added manually in seconds. Subwise organises everything in one place alongside your auto-detected subscriptions.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes, anytime. Delete your account and all data disappears permanently with a single tap. We hold nothing beyond your active session. Your data is yours — always.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="relative w-full bg-[#f7f7fc] dark:bg-[#04040c] py-24 px-6 transition-colors duration-300">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontFamily: "var(--font-dm-sans)" }}
            className="text-xs font-bold tracking-widest uppercase text-violet-600 dark:text-violet-400 mb-4"
          >
            FAQ
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            style={{ fontFamily: "var(--font-dm-serif)" }}
            className="text-4xl sm:text-5xl text-slate-900 dark:text-white leading-[1.1] tracking-[-0.01em]"
          >
            Questions, answered.
          </motion.h2>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-3">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className={`rounded-2xl border overflow-hidden transition-colors duration-200 ${
                    isOpen
                      ? "bg-white dark:bg-white/[0.05] border-violet-200 dark:border-violet-500/30"
                      : "bg-white dark:bg-white/[0.03] border-black/[0.07] dark:border-white/[0.08]"
                  }`}
                  style={{ boxShadow: isOpen ? "0 4px 24px rgba(124,58,237,0.07)" : "0 2px 8px rgba(0,0,0,0.03)" }}
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left group"
                  >
                    <span
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                      className={`text-[15px] font-medium transition-colors duration-200 ${
                        isOpen ? "text-violet-600 dark:text-violet-400" : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {faq.q}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className={`w-5 h-5 flex-shrink-0 ml-4 transition-colors duration-200 ${
                        isOpen ? "text-violet-500 dark:text-violet-400" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <line x1="10" y1="4" x2="10" y2="16" />
                        <line x1="4"  y1="10" x2="16" y2="10" />
                      </svg>
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <p
                          style={{ fontFamily: "var(--font-dm-sans)" }}
                          className="px-5 pb-5 text-[14px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-black/[0.05] dark:border-white/[0.06] pt-4"
                        >
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
