'use client'

import dynamic from 'next/dynamic'
import { useSiteConfig } from '@/components/SiteDataProvider'

const Live2D = dynamic(() => import('@/components/Live2D'), {
  ssr: false,
  loading: () => <div className="h-40 w-40" />,
})

export default function BlogHero() {
  const siteConfig = useSiteConfig()

  return (
    <div className="relative border-b border-border bg-background overflow-hidden">
      {/* Blob Ornaments */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-blob-1 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob dark:mix-blend-screen pointer-events-none"></div>
      <div className="absolute -top-10 right-1/4 w-72 h-72 bg-blob-2 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 dark:mix-blend-screen pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 lg:pt-20 lg:pb-16 z-10">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase mb-5">
          {siteConfig.site_subtitle || "Arthur & Grace · Journal"}
        </p>
        <h1 className="text-[2rem] lg:text-[2.5rem] font-semibold tracking-tight leading-[1.2] text-foreground max-w-lg">
          <span className="block sm:inline text-gradient-primary">{siteConfig.site_title_highlight || "技术、生活与创意"}</span>
          {siteConfig.site_title_highlight_2 && (
            <>
              <br className="hidden sm:block" />
              <span className="block sm:inline text-gradient-primary">{siteConfig.site_title_highlight_2}</span>
            </>
          )}
          <br className="hidden sm:block" />
          <span className="block sm:inline">{siteConfig.site_title_rest || "的记录与分享"}</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-sm">
          {siteConfig.site_description || "探索编程、设计、Life Lens 真实评价等领域的见解与思考。记录成长，分享知识，连接彼此。"}
        </p>

        <Live2D />
      </div>
    </div>
  )
}
