import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "next-themes";
import { getSiteConfig, getPostsCount, getCategories, getAllTags, getYearArchive, getRecentPostsMetadata } from "@/lib/blog";
import { SiteDataProvider } from "@/components/SiteDataProvider"
import { SpotifyProvider } from "@/components/SpotifyProvider"
import Script from 'next/script';

export const metadata: Metadata = {
  title: "Arthur & Grace",
  description: "Arthur & Grace 的个人博客与工具合集",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [config, totalPostsCount, categories, tags, yearArchive, recentPosts] = await Promise.all([
    getSiteConfig().catch(() => ({} as Record<string, string>)),
    getPostsCount().catch(() => 0),
    getCategories().catch(() => []),
    getAllTags().catch(() => []),
    getYearArchive().catch(() => []),
    getRecentPostsMetadata(10).catch(() => []),
  ]);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          <link rel="preconnect" href="https://images.arthurlovegrace.top" />
          <link rel="dns-prefetch" href="https://obsidian.arthurlovegrace.top" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC&display=swap" rel="stylesheet" />
        </head>
        <body className="bg-background antialiased pb-24 md:pb-0">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            themes={["light", "dark", "ocean", "sunset", "forest"]}
            disableTransitionOnChange
          >
            <AuthProvider>
              <SpotifyProvider>
                <SiteDataProvider
                  initialState={{
                    config: config || {},
                    stats: {
                      postsCount: totalPostsCount,
                      categoriesCount: categories.length,
                      tagsCount: tags.length
                    },
                    sidebarData: {
                      categories,
                      tags,
                      yearArchive,
                      recentPosts
                    }
                  }}
                >
                  <Navbar />
                  {children}
                </SiteDataProvider>
              </SpotifyProvider>
            </AuthProvider>
          </ThemeProvider>
          <Script
             src="https://analytics.arthurlovegrace.top/script.js"
             data-website-id="ec4e0366-0b25-4529-a142-2fea5492cf32"
             strategy="afterInteractive"
          />
        </body>
    </html>
  );
}
