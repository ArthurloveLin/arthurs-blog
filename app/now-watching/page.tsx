import type { Metadata } from 'next'
import { Open_Sans } from 'next/font/google'
import NowWatchingColumns from '@/components/now-watching/NowWatchingColumns'
import { getPagedNowWatchingPosters } from '@/lib/now-watching'

const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Now Watching',
  description: 'Arthur & Grace 最近看过的电影海报流',
}

export const revalidate = 60

const INITIAL_PER_PAGE = 30

export default async function NowWatchingPage() {
  const { posters, totalCount, hasMore } = await getPagedNowWatchingPosters(1, INITIAL_PER_PAGE)

  return (
    <section className={openSans.className}>
      <NowWatchingColumns
        initialPosters={posters}
        initialPage={1}
        totalCount={totalCount}
        hasMore={hasMore}
        perPage={INITIAL_PER_PAGE}
      />
    </section>
  )
}