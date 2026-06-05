import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/auth/", "/session/", "/wardrobe"],
    },
    sitemap: "https://arthurlovegrace.top/sitemap.xml",
  };
}
