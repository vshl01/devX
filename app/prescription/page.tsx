import type { Metadata } from "next";

import { PrescriptionCompanion } from "@/components/prescription/PrescriptionCompanion";

export const metadata: Metadata = {
  title: "Prescription Companion · Doctor AI Front Desk",
  description:
    "Upload a doctor's prescription, understand medicines and vitals, translate, and ask grounded questions.",
};

export default function PrescriptionPage() {
  return <PrescriptionCompanion />;
}
