import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Arthur & Grace",
  description: "Arthur & Grace 的个人博客与工具合集",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#F5F5F7] antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
