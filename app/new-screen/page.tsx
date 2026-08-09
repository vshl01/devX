import type { Metadata } from "next";

import { Workspace } from "@/components/workspace/workspace";

export const metadata: Metadata = {
  title: "Read a document | Lucid",
  description:
    "Upload a report, scan or handwritten prescription. Lucid extracts it with Sarvam and explains it in your language.",
};

export default function NewScreenPage() {
  return <Workspace />;
}
