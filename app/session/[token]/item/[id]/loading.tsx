export default function LoadingItemPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-24 rounded-xl bg-card animate-pulse" />
        </div>
        <div className="aspect-square rounded-2xl border border-border bg-card animate-pulse" />
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="h-5 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="h-5 w-28 rounded-full bg-muted animate-pulse" />
          <div className="h-12 rounded-xl bg-muted animate-pulse" />
          <div className="h-40 rounded-xl bg-muted animate-pulse" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
          <div className="h-16 rounded-xl bg-muted animate-pulse" />
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    </main>
  )
}