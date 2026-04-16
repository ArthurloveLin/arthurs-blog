import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserRole } from '@/lib/auth'
import SessionHeader from '@/components/SessionHeader'
import RealtimeSync from '@/components/RealtimeSync'
import ActivityBanner from '@/components/ActivityBanner'
import SessionItemsSection, { SessionItemsSectionFallback } from '@/components/SessionItemsSection'

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ sort?: string; view?: string }>
}) {
  const { token } = await params
  const { sort = 'time', view = 'all' } = await searchParams

  // getUserRole 与 session 查询互相独立，并行发起
  const [role, { data: session, error: sessionError }] = await Promise.all([
    getUserRole(),
    supabaseAdmin
      .from('sessions')
      .select('id, token, title, note, budget, template_config')
      .eq('token', token)
      .single(),
  ])
  const isAdmin = role === 'admin'

  if (sessionError || !session) notFound()

  const templateConfig = (session as { template_config?: import('@/lib/templates').TemplateConfig }).template_config

  return (
    <main className="min-h-screen bg-background text-foreground">
      <RealtimeSync sessionId={session.id} />
      <ActivityBanner sessionId={session.id} />
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <SessionHeader session={session} templateConfig={templateConfig} />
        <Suspense fallback={<SessionItemsSectionFallback isAdmin={isAdmin} />}>
          <SessionItemsSection
            sessionId={session.id}
            sessionToken={token}
            sort={sort}
            view={view}
            budget={session.budget}
            isAdmin={isAdmin}
            templateConfig={templateConfig}
          />
        </Suspense>
      </div>
    </main>
  )
}
