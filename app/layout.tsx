import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans, Geist } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const dmSerif = DM_Serif_Display({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-dm-serif" });
const dmSans = DM_Sans({ weight: ["300", "400", "500", "600"], subsets: ["latin"], display: "swap", variable: "--font-dm-sans" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://subwise.co.in";
const DESC =
  "Subwise organizes every recurring payment — subscriptions, rent, EMIs, insurance, SIPs — and reminds you on WhatsApp before money leaves your account. Connect Gmail once. India-first, free.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Subwise",
  title: {
    default: "Subwise — Never miss another payment",
    template: "%s · Subwise",
  },
  description: DESC,
  keywords: [
    "subscription tracker India", "recurring payments", "WhatsApp bill reminders", "UPI autopay mandate",
    "cancel subscription India", "EMI reminder", "insurance renewal reminder", "SIP reminder",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Subwise",
    url: SITE_URL,
    title: "Subwise — Never miss another payment",
    description: DESC,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subwise — Never miss another payment",
    description: DESC,
  },
  robots: { index: true, follow: true },
};

// Apply the saved theme before paint (default light; only an explicit 'dark' choice flips it).
const themeScript = `(function(){try{if(localStorage.getItem('subwise-theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

// Structured data (AEO/GEO).
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: "Subwise", url: SITE_URL },
    { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: "Subwise", url: SITE_URL, publisher: { "@id": `${SITE_URL}/#org` } },
    {
      "@type": "SoftwareApplication",
      name: "Subwise",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: DESC,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      audience: { "@type": "Audience", geographicArea: { "@type": "Country", name: "India" } },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(dmSerif.variable, dmSans.variable, geist.variable, "font-sans")}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-[#04040c] transition-colors duration-300">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
