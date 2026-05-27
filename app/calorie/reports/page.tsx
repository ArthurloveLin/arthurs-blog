import { redirect } from 'next/navigation'

import DirectionalTransition from '@/components/DirectionalTransition'
import CalorieReports from '@/components/calorie/CalorieReports'
import { getUserRole } from '@/lib/auth'

export const metadata = {
  title: 'Calorie Reports',
}

export default async function CalorieReportsPage() {
  const role = await getUserRole()
  if (role !== 'admin') {
    redirect('/')
  }

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        <CalorieReports />
      </main>
    </DirectionalTransition>
  )
}