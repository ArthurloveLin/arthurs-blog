import { redirect } from 'next/navigation'

import DirectionalTransition from '@/components/DirectionalTransition'
import CalorieWorkspace from '@/components/calorie/CalorieWorkspace'
import { getUserRole } from '@/lib/auth'

export const metadata = {
  title: 'Calorie Atelier',
}

export default async function CaloriePage() {
  const role = await getUserRole()
  if (role !== 'admin') {
    redirect('/')
  }

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        <CalorieWorkspace />
      </main>
    </DirectionalTransition>
  )
}