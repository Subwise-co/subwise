"use client";

import { motion } from "framer-motion";

// ─── Brand SVG Icons ──────────────────────────────────────────────────────────

const NetflixIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#000000" />
    <path d="M14 8h6.5l9.5 22.5V8H36v32h-6.3L20 17.5V40H14V8Z" fill="#E50914" />
  </svg>
);

const SpotifyIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#1DB954" />
    <circle cx="24" cy="24" r="14" fill="#1DB954" />
    <path d="M15 19.5c5.2-1.6 10.8-1.4 15.8 0.8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16.5 23.5c4.4-1.3 9.1-1.1 13.3 0.7" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M18 27.5c3.4-1 7-0.9 10.2 0.5" stroke="white" strokeWidth="1.9" strokeLinecap="round"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#FF0000" />
    <path d="M38.5 17.5s-.4-2.6-1.6-3.7c-1.5-1.6-3.2-1.6-4-.7C29.4 13 24 13 24 13s-5.4 0-8.9.1c-.8-.9-2.5-.9-4 .7-1.2 1.1-1.6 3.7-1.6 3.7S9 20.3 9 23.1v2.6c0 2.8.5 5.6.5 5.6s.4 2.6 1.6 3.7c1.5 1.6 3.6 1.5 4.5 1.7C18.1 37 24 37 24 37s5.4 0 8.9-.3c.8.9 2.5.9 4-.7 1.2-1.1 1.6-3.7 1.6-3.7s.5-2.8.5-5.6v-2.6c0-2.8-.5-5.6-.5-5.6zM21 29v-10l9 5-9 5z" fill="white"/>
  </svg>
);

const AmazonPrimeIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#00A8E1" />
    <path d="M12 17h6c2.2 0 4 1.8 4 4s-1.8 4-4 4h-3v5H12V17zm3 6h3c.6 0 1-.4 1-1s-.4-1-1-1h-3v2z" fill="white"/>
    <path d="M24 17h6c2.2 0 4 1.8 4 4v5c0 2.2-1.8 4-4 4h-6V17zm3 10h3c.6 0 1-.4 1-1v-5c0-.6-.4-1-1-1h-3v7z" fill="white"/>
    <path d="M8 36c5 3 14 4 22 1.5" stroke="#FF9900" strokeWidth="2" strokeLinecap="round"/>
    <path d="M32 34l3 1.5-2 2" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AppleTVIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#000000" />
    <path d="M24 10c-1.4 0-2.6.5-3.5 1.5-.8.9-1.2 2-1.1 3.2 1.1-.1 2.2-.6 3-1.5.9-.9 1.4-2 1.6-3.2zm3.5 4.2c-1.8 0-3.3.9-4.2.9-.9 0-2.3-.9-3.8-.8-1.9 0-3.7 1.1-4.7 2.8-2 3.5-.5 8.6 1.4 11.4.9 1.4 2 2.9 3.5 2.8 1.4-.1 1.9-.9 3.6-.9 1.7 0 2.2.9 3.7.9 1.5 0 2.4-1.4 3.4-2.7 1-1.5 1.4-3 1.4-3.1-.1 0-2.7-1-2.7-4 0-2.5 2-3.6 2.1-3.7-1.2-1.7-3-2.6-3.7-2.6z" fill="white"/>
    <text x="24" y="42" textAnchor="middle" fontSize="7" fill="white" fontFamily="Arial" fontWeight="bold">TV+</text>
  </svg>
);

const RentIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#6366F1" />
    <path d="M24 10L8 22h4v16h28V22h4L24 10z" fill="white" />
    <rect x="19" y="30" width="5" height="8" rx="1" fill="#6366F1" />
    <rect x="25" y="30" width="5" height="8" rx="1" fill="#6366F1" />
    <rect x="28" y="22" width="5" height="5" rx="1" fill="#6366F1" />
  </svg>
);

const ElectricityIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#F59E0B" />
    <path d="M27 8L13 26h12l-2 14L39 22H27l0-14z" fill="white" />
  </svg>
);

const InsuranceIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#10B981" />
    <path d="M24 9C18 11.5 12 13 12 13v12c0 7 6 11 12 14 6-3 12-7 12-14V13S30 11.5 24 9z" fill="white" />
    <path d="M18 24l4.5 4.5 8-8" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CreditCardIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#8B5CF6" />
    <rect x="7" y="14" width="34" height="22" rx="3" fill="white" />
    <rect x="7" y="20" width="34" height="7" fill="#8B5CF6" opacity="0.25" />
    <rect x="11" y="29" width="8" height="3" rx="1.5" fill="#8B5CF6" />
    <circle cx="34" cy="30.5" r="3" fill="#8B5CF6" opacity="0.4" />
    <circle cx="38" cy="30.5" r="3" fill="#8B5CF6" opacity="0.7" />
  </svg>
);

const WifiIcon = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-8 h-8">
    <rect width="48" height="48" rx="10" fill="#3B82F6" />
    <path d="M8 20c8.8-9 23.2-9 32 0" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <path d="M13 25.5c5.5-6 16.5-6 22 0" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <path d="M18.5 31c2.8-3 9.2-3 12 0" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <circle cx="24" cy="37" r="2.5" fill="white" />
  </svg>
);

// ─── Floating Card ────────────────────────────────────────────────────────────

interface FloatingIconProps {
  icon: React.ReactNode;
  label: string;
  amount: string;
  position: string;
  delay: number;
  floatY?: number;
}

function FloatingIconCard({ icon, label, amount, position, delay, floatY = 8 }: FloatingIconProps) {
  return (
    <motion.div
      // Decorative only. Percentage positions have room on desktop but collide with the hero text on
      // phones/tablets, so show them only on large screens — the mobile hero stays clean and centered.
      className={`absolute ${position} z-20 hidden lg:block`}
      initial={{ opacity: 0, scale: 0.75, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        animate={{ y: [0, -floatY, 0] }}
        transition={{
          duration: 3.5 + delay * 0.4,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
          delay: delay * 0.2,
        }}
        className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
        style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div className="rounded-xl overflow-hidden flex-shrink-0 w-10 h-10 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex flex-col min-w-0 pr-1">
          <span className="text-[11px] font-bold text-slate-800 leading-tight whitespace-nowrap tracking-tight">{label}</span>
          <span className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5 whitespace-nowrap">{amount}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Icon Layout ──────────────────────────────────────────────────────────────

const ICONS: FloatingIconProps[] = [
  { icon: <NetflixIcon />,      label: "Netflix",          amount: "₹649/mo",       position: "top-[10%] left-[5%]",     delay: 0.15, floatY: 10 },
  { icon: <SpotifyIcon />,      label: "Spotify",          amount: "₹119/mo",       position: "top-[34%] left-[3%]",     delay: 0.40, floatY: 7  },
  { icon: <RentIcon />,         label: "Rent",             amount: "₹22,000/mo",    position: "bottom-[30%] left-[5%]",  delay: 0.65, floatY: 9  },
  { icon: <ElectricityIcon />,  label: "Electricity",      amount: "~₹1,200/mo",    position: "bottom-[12%] left-[9%]",  delay: 0.25, floatY: 6  },
  { icon: <YouTubeIcon />,      label: "YouTube Premium",  amount: "₹189/mo",       position: "top-[10%] right-[5%]",    delay: 0.55, floatY: 11 },
  { icon: <InsuranceIcon />,    label: "Health Insurance", amount: "₹8,500/yr",     position: "top-[34%] right-[3%]",    delay: 0.30, floatY: 8  },
  { icon: <CreditCardIcon />,   label: "Credit Card Bill", amount: "Due in 3 days", position: "bottom-[30%] right-[5%]", delay: 0.80, floatY: 7  },
  { icon: <WifiIcon />,         label: "Broadband",        amount: "₹999/mo",       position: "bottom-[12%] right-[9%]", delay: 0.10, floatY: 9  },
];

export default function FloatingIcons() {
  return (
    <>
      {ICONS.map((icon, i) => (
        <FloatingIconCard key={i} {...icon} />
      ))}
    </>
  );
}
