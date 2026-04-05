import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "next-themes";
import { getSiteConfig, getPostsCount, getCategories, getAllTags } from "@/lib/blog";
import { getCurrentUser, getUserRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Arthur & Grace",
  description: "Arthur & Grace 的个人博客与工具合集",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [config, user, role, totalPostsCount, categories, tags] = await Promise.all([
    getSiteConfig().catch(() => ({} as Record<string, string>)),
    getCurrentUser(),
    getUserRole(),
    getPostsCount().catch(() => 0),
    getCategories().catch(() => []),
    getAllTags().catch(() => []),
  ]);

  const initialAuthData = user ? {
    role,
    email: user.email ?? null,
    display_name: user.user_metadata?.display_name ?? null,
  } : undefined;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-background antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          themes={["light", "dark", "ocean", "sunset", "forest"]}
          disableTransitionOnChange={false}
        >
          <AuthProvider initialData={initialAuthData}>
            <Navbar 
              logoUrl={config?.author_avatar_url} 
              siteConfig={config}
              stats={{
                postsCount: totalPostsCount,
                categoriesCount: categories.length,
                tagsCount: tags.length
              }}
            />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
