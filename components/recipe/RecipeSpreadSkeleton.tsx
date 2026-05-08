import BookSpread from './BookSpread'

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-amber-900/8 ${className}`} aria-hidden="true" />
}

function SkeletonLines({ lines }: { lines: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          className={index === lines - 1 ? 'h-3 w-2/3' : 'h-3 w-full'}
        />
      ))}
    </div>
  )
}

function LeftPageSkeleton() {
  return (
    <div className="h-full flex flex-col gap-3 p-0.5">
      <div className="border-b border-amber-800/15 pb-2">
        <SkeletonBlock className="h-3 w-20 mb-2" />
        <SkeletonBlock className="h-5 w-36 mb-2" />
        <SkeletonBlock className="h-3 w-24" />
      </div>
      <SkeletonBlock className="aspect-[3/2] w-full" />
      <SkeletonLines lines={3} />
      <SkeletonLines lines={5} />
      <div className="mt-auto">
        <SkeletonBlock className="h-3 w-16 mb-2" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    </div>
  )
}

function RightPageSkeleton() {
  return (
    <div className="h-full flex flex-col gap-3 p-0.5">
      <div>
        <SkeletonBlock className="h-3 w-14 mb-2" />
        <div className="flex flex-wrap gap-2">
          <SkeletonBlock className="h-5 w-14 rounded-full" />
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <SkeletonBlock className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <div>
        <SkeletonBlock className="h-3 w-16 mb-2" />
        <SkeletonBlock className="h-[140px] w-full" />
      </div>
      <SkeletonLines lines={4} />
      <div className="mt-auto border-t border-amber-800/15 pt-3">
        <SkeletonBlock className="ml-auto h-3 w-28" />
      </div>
    </div>
  )
}

export default function RecipeSpreadSkeleton() {
  return <BookSpread left={<LeftPageSkeleton />} right={<RightPageSkeleton />} />
}