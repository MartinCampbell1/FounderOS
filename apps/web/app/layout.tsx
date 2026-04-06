import type { Metadata } from "next";
import { DM_Sans, Geist, Geist_Mono } from "next/font/google";
import type { CSSProperties } from "react";

import { ThemeProvider } from "@founderos/ui/components/theme-provider";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-shell-sans",
});

const heading = DM_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-shell-heading",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-shell-mono",
});

export const metadata: Metadata = {
  title: "FounderOS Unified Shell",
  description: "Route-driven shell for Quorum discovery and Autopilot execution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${heading.variable} ${mono.variable}`}
        style={
          {
            "--font-sans": "var(--font-shell-sans)",
            "--font-heading": "var(--font-shell-heading), 'DM Sans', var(--font-shell-sans)",
            "--font-mono": "var(--font-shell-mono)",
          } as CSSProperties
        }
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
