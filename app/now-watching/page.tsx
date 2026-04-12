import type { Metadata } from 'next'
import { Open_Sans } from 'next/font/google'
import NowWatchingColumns from '@/components/now-watching/NowWatchingColumns'
import { getNowWatchingColumns } from '@/lib/now-watching'

const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Now Watching',
  description: 'Arthur & Grace 最近看过的电影海报流',
}

export const revalidate = 60

export default async function NowWatchingPage() {
  const columns = await getNowWatchingColumns()

  return (
    <section className={openSans.className}>
      <NowWatchingColumns columns={columns} />
    </section>
  )
}