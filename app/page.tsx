import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { ClosingCta } from "@/components/sections/closing-cta";
import { ExampleReading } from "@/components/sections/example-reading";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Limits } from "@/components/sections/limits";
import { SupportedReports } from "@/components/sections/supported-reports";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <SupportedReports />
        <HowItWorks />
        <ExampleReading />
        <Limits />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
