import type { Metadata } from 'next'
import DirectionalTransition from '@/components/DirectionalTransition'
import LifeGallerySlider from '@/components/life-gallery/LifeGallerySlider'
import { getLifeGalleryRound } from '@/lib/life-gallery'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Life Gallery | Arthur & Grace',
  description: 'Arthur & Grace 的生活画廊，基于 R2 图库随机轮换展示。',
}

export default async function LifeGalleryPage() {
  let initialRound = null

  try {
    initialRound = await getLifeGalleryRound()
  } catch (error) {
    console.error('Failed to render Life Gallery page:', error)
  }

  if (!initialRound) {
    return (
      <DirectionalTransition>
        <main className="min-h-[calc(100dvh-4rem)] bg-background px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border/60 bg-card p-8 text-card-foreground shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Life Gallery</p>
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground">生活画廊暂时不可用</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              当前未能从 R2 图库取回完整的四组主题图片。请检查 Gallery 目录、公开域名配置以及对应 bucket 是否可访问，然后重试。
            </p>
          </div>
        </main>
      </DirectionalTransition>
    )
  }

  return (
    <DirectionalTransition>
      <main className="relative -mb-24 min-h-[calc(100dvh-4rem)] overflow-hidden bg-background md:mb-0">
        <LifeGallerySlider initialRound={initialRound} />
      </main>
    </DirectionalTransition>
  )
}