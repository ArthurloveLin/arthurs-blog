import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";

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
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
