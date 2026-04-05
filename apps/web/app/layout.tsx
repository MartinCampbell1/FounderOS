import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import type { CSSProperties } from "react";

import { ThemeProvider } from "@founderos/ui/components/theme-provider";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-shell-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
        className={`${sans.variable} ${mono.variable}`}
        style={
          {
            "--font-sans": "var(--font-shell-sans)",
            "--font-mono": "var(--font-shell-mono)",
          } as CSSProperties
        }
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
