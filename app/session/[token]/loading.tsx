import { SessionItemsSectionFallback } from '@/components/SessionItemsSection'

export default function LoadingSessionPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="mt-1 h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-9 w-56 rounded-xl bg-card animate-pulse" />
            <div className="h-5 w-full max-w-xl rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
        <SessionItemsSectionFallback isAdmin={true} />
      </div>
    </main>
  )
}