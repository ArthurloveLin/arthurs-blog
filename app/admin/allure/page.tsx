import { getUserRole } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Allure Test Report - Admin' }

export default async function AllureReportPage() {
  const role = await getUserRole()
  if (role !== 'admin') redirect('/')

  const cdnDomain = process.env.R2_CDN_PUBLIC_DOMAIN
  if (!cdnDomain) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">R2_CDN_PUBLIC_DOMAIN 未配置</p>
      </main>
    )
  }

  const reportUrl = `https://${cdnDomain}/allure/latest/index.html`

  return (
    <main className="h-[calc(100dvh-48px)]">
      <iframe
        src={reportUrl}
        className="w-full h-full border-0"
        title="Allure Test Report"
      />
    </main>
  )
}
