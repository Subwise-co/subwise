"use client";

import { motion } from "framer-motion";

const NAV = {
  product: [
    { label: "Features",    href: "/#features" },
    { label: "How it Works", href: "/#how-it-works" },
    { label: "Privacy",     href: "/#privacy" },
    { label: "FAQ",         href: "/#faq" },
  ],
  legal: [
    { label: "Privacy Policy",   href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

export default function FooterSection() {
  return (
    <footer className="relative w-full bg-white dark:bg-[#04040c] border-t border-black/[0.07] dark:border-white/[0.07] transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8"
        >
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontFamily: "var(--font-dm-serif)" }} className="text-xl font-bold text-slate-900 dark:text-white">
                Subwise
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[200px]">
              The personal financial reminder assistant that makes sure you never miss another recurring payment.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500 mb-4">
              Product
            </h4>
            <ul className="flex flex-col gap-3">
              {NAV.product.map(link => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                    className="text-[14px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500 mb-4">
              Legal
            </h4>
            <ul className="flex flex-col gap-3">
              {NAV.legal.map(link => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                    className="text-[14px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500 mb-4">
              Contact
            </h4>
            <a
              href="mailto:hello@subwise.co.in"
              style={{ fontFamily: "var(--font-dm-sans)" }}
              className="text-[14px] text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors duration-200"
            >
              hello@subwise.co.in
            </a>
          </div>
        </motion.div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[12px] text-slate-400 dark:text-slate-600">
            © 2026 Subwise. All rights reserved.
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[12px] text-slate-400 dark:text-slate-600">
            Made with care in India 🇮🇳
          </p>
        </div>
      </div>
    </footer>
  );
}
