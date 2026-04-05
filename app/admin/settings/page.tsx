import { getUserRole } from '@/lib/auth'
import { getSiteConfig } from '@/lib/blog'
import { redirect } from 'next/navigation'
import SiteSettingsForm from '@/components/admin/SiteSettingsForm'

export const metadata = { title: 'Site Settings - Admin' }

export default async function SettingsPage() {
  const role = await getUserRole()
  if (role !== 'admin') redirect('/')

  const config = await getSiteConfig()

  return (
    <main className="min-h-screen bg-background pt-12 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">网站全局配置</h1>
        <p className="text-sm text-muted-foreground mb-10">
          管理个人资料卡、导航栏 Logo 和主页大标题文案。实时更新，立等可取。
        </p>
        <SiteSettingsForm initialData={config} />
      </div>
    </main>
  )
}
