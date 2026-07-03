"use client";

import dynamic from "next/dynamic";

const ProblemSection    = dynamic(() => import("@/components/ProblemSection"),    { ssr: false });
const HowItWorks        = dynamic(() => import("@/components/HowItWorks"),        { ssr: false });
const ExperienceSection = dynamic(() => import("@/components/ExperienceSection"), { ssr: false });
const FeaturesSection   = dynamic(() => import("@/components/FeaturesSection"),   { ssr: false });
const RoadAheadSection  = dynamic(() => import("@/components/RoadAheadSection"),  { ssr: false });
const PrivacySection    = dynamic(() => import("@/components/PrivacySection"),    { ssr: false });
const FAQSection        = dynamic(() => import("@/components/FAQSection"),        { ssr: false });
const FooterSection     = dynamic(() => import("@/components/FooterSection"),     { ssr: false });

export default function PageSections() {
  return (
    <>
      <ProblemSection />
      <div id="how-it-works" className="scroll-mt-24">
        <HowItWorks />
      </div>
      <ExperienceSection />
      <div id="features" className="scroll-mt-24">
        <FeaturesSection />
      </div>
      <RoadAheadSection />
      <div id="privacy" className="scroll-mt-24">
        <PrivacySection />
      </div>
      <div id="faq" className="scroll-mt-24">
        <FAQSection />
      </div>
      <FooterSection />
    </>
  );
}
