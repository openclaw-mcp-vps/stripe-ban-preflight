import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stripe-ban-preflight.com"),
  title: {
    default: "Stripe Ban Preflight",
    template: "%s | Stripe Ban Preflight",
  },
  description:
    "Predict Stripe suspension risk before it hits revenue. Connect Stripe read-only, score account risk, and fix the top 3 issues fast.",
  keywords: [
    "Stripe suspension",
    "chargeback risk",
    "Stripe compliance",
    "fintech risk monitoring",
    "SaaS revenue protection",
  ],
  openGraph: {
    title: "Stripe Ban Preflight",
    description:
      "AI preflight for Stripe accounts: suspension risk score, dispute signals, and actionable fixes.",
    type: "website",
    url: "https://stripe-ban-preflight.com",
    siteName: "Stripe Ban Preflight",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stripe Ban Preflight",
    description:
      "Know your Stripe suspension risk before payouts get frozen.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full bg-[#0d1117] text-[#e6edf3] antialiased">
        {children}
      </body>
    </html>
  );
}
