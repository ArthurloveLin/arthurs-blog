import Link from 'next/link'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-800 hover:text-gray-600 transition-colors">
          Arthur &amp; Grace
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/wardrobe"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            选衣记录
          </Link>
          <a
            href="https://trendradar.arthurlovegrace.top"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
          >
            新闻汇总
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 10L10 2M10 2H5M10 2V7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  )
}
