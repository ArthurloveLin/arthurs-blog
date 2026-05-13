// app/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Root layout — loads fonts, sets <html> attributes, wraps children.
// This is a Server Component (no "use client").

import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-noto-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memo",
  description: "Personal memo workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh"
      // data-theme="dark" — controlled at runtime by a theme hook / context
    >
      <body
        className={`${geist.variable} ${geistMono.variable} ${notoSansSC.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
