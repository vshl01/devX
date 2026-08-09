import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";

import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lucid, your medical report explained in plain language",
  description:
    "Upload a lab result or scan report and ask what it means, by voice or by typing. Lucid explains every marker in plain language. It does not diagnose or prescribe.",
  applicationName: "Lucid",
  openGraph: {
    title: "Lucid, your medical report explained in plain language",
    description:
      "Upload a lab result or scan report and ask what it means, by voice or by typing.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1211" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
