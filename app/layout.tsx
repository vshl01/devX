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
  title: {
    default: "Doctor AI Front Desk",
    template: "%s · Doctor AI",
  },
  description:
    "Book appointments with a multilingual AI receptionist and understand handwritten prescriptions — powered by Sarvam AI.",
  applicationName: "Doctor AI Front Desk",
  openGraph: {
    title: "Doctor AI Front Desk",
    description:
      "Book appointments by voice and understand prescriptions in your language.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafbfb",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
