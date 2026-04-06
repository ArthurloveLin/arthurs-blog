import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "next-themes";
import { getSiteConfig, getPostsCount, getCategories, getAllTags, getYearArchive, getRecentPostsMetadata } from "@/lib/blog";
import { SiteDataProvider } from "@/components/SiteDataProvider";
import { ViewTransitions } from 'next-view-transitions';

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
    <ViewTransitions>
      <html lang="zh-CN" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          <link rel="preconnect" href="https://images.arthurlovegrace.top" />
          <link rel="dns-prefetch" href="https://obsidian.arthurlovegrace.top" />
        </head>
        <body className="bg-background antialiased pb-24 md:pb-0">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            themes={["light", "dark", "ocean", "sunset", "forest"]}
            disableTransitionOnChange={false}
          >
            <AuthProvider>
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
            </AuthProvider>
          </ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
