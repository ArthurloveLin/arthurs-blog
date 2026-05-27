import { redirect } from 'next/navigation'

import DirectionalTransition from '@/components/DirectionalTransition'
import CalorieDayDetail from '@/components/calorie/CalorieDayDetail'
import { getUserRole } from '@/lib/auth'

export const metadata = {
  title: 'Calorie Day Ledger',
}

type Params = { params: Promise<{ date: string }> }

export default async function CalorieDayPage({ params }: Params) {
  const role = await getUserRole()
  if (role !== 'admin') {
    redirect('/')
  }

  const { date } = await params

  return (
    <DirectionalTransition>
      <main className="min-h-screen bg-background">
        <CalorieDayDetail date={date} />
      </main>
    </DirectionalTransition>
  )
}