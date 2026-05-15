import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_SC, Caveat } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  weight: ["400", "600", "700"],
  preload: false,
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
import AuthProvider from "@/components/AuthProvider";
import type { AuthState } from "@/components/AuthProvider";
import { ThemeProvider } from "next-themes";
import { getSiteConfig, getPostsCount, getCategories, getAllTags, getYearArchive, getRecentPostsMetadata } from "@/lib/blog";
import { SiteDataProvider } from "@/components/SiteDataProvider"
import { getCurrentUser, getUserRole } from "@/lib/auth";
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
  const [config, totalPostsCount, categories, tags, yearArchive, recentPosts, authUser, authRole] = await Promise.all([
    getSiteConfig().catch(() => ({} as Record<string, string>)),
    getPostsCount().catch(() => 0),
    getCategories().catch(() => []),
    getAllTags().catch(() => []),
    getYearArchive().catch(() => []),
    getRecentPostsMetadata(10).catch(() => []),
    getCurrentUser().catch(() => null),
    getUserRole().catch(() => 'guest' as const),
  ]);

  const initialAuth: AuthState = {
    role: authRole,
    email: authUser?.email ?? null,
    display_name: authUser?.user_metadata?.display_name ?? null,
  };

  return (
    <html lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} ${caveat.variable}`}
      suppressHydrationWarning>
        <head>
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          <link rel="preconnect" href="https://images.arthurlovegrace.top" />
          <link rel="dns-prefetch" href="https://obsidian.arthurlovegrace.top" />
          {/* LXGW WenKai Screen: 仅用于便签组件的手写风格（简体中文优化版），不纳入全局字体系统 */}
          {/* precedence="optional" 使浏览器以非阻塞方式加载此字体 CSS，不阻断首屏渲染 */}
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.1.0/style.css" precedence="optional" />
          {/* Inline script: set data-md-theme before first paint to prevent flash */}
          <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('md-theme');document.documentElement.setAttribute('data-md-theme',t||'mono');}catch(e){}` }} />
        </head>
        <body className="bg-background antialiased pb-24 md:pb-0">
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            themes={["light", "dark", "ocean", "sunset", "forest"]}
            disableTransitionOnChange
          >
            <AuthProvider initialData={initialAuth}>
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
          <Script
             src="https://analytics.arthurlovegrace.top/script.js"
             data-website-id="ec4e0366-0b25-4529-a142-2fea5492cf32"
             data-performance="true"
             strategy="afterInteractive"
          />
          <Script
             src="https://analytics.arthurlovegrace.top/recorder.js"
             data-website-id="ec4e0366-0b25-4529-a142-2fea5492cf32"
             data-sample-rate="0.15"
             data-mask-level="moderate"
             data-max-duration="300000"
             strategy="afterInteractive"
          />
        </body>
    </html>
  );
}
