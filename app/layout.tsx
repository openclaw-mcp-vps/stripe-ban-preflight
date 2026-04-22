import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const fallbackMetadataBase = new URL("https://stripe-ban-preflight.com");

const metadataBase = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    return fallbackMetadataBase;
  }

  try {
    return new URL(configuredUrl);
  } catch {
    return fallbackMetadataBase;
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Stripe Ban Preflight",
    template: "%s | Stripe Ban Preflight",
  },
  description:
    "Predict Stripe suspension risk before it happens. Connect Stripe read-only, get an AI risk score, and fix the top suspension triggers fast.",
  keywords: [
    "Stripe suspension risk",
    "chargeback prevention",
    "Stripe dispute monitoring",
    "SaaS risk analytics",
    "fintech risk tool",
  ],
  openGraph: {
    type: "website",
    url: metadataBase,
    title: "Stripe Ban Preflight",
    description:
      "AI-powered Stripe risk intelligence for SaaS founders. Detect suspension signals early and ship the top 3 fixes before revenue is impacted.",
    siteName: "Stripe Ban Preflight",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stripe Ban Preflight",
    description:
      "Predict Stripe suspension risk early with chargeback, dispute, and compliance signal analysis.",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
