import type { Metadata } from "next";

import { LandingHero } from "@/components/landing/hero";
import {
  AskPreviewSection,
  CallPreviewSection,
  FeaturesSection,
  FinalCtaSection,
  JourneySection,
  LanguagesSection,
  PrescriptionPreviewSection,
  ProblemSection,
  SarvamSection,
  TrustSection,
} from "@/components/landing/sections";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
  title: "Doctor AI Front Desk — Book appointments. Understand prescriptions.",
  description:
    "Multilingual AI front desk for clinics: book appointments by voice and understand handwritten prescriptions with Sarvam AI.",
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <LandingHero />
        <ProblemSection />
        <FeaturesSection />
        <JourneySection />
        <PrescriptionPreviewSection />
        <AskPreviewSection />
        <LanguagesSection />
        <SarvamSection />
        <TrustSection />
        <CallPreviewSection />
        <FinalCtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
