import { NextResponse } from 'next/server'

import { discardCalorieRun } from '@/lib/calorie/service'
import { handleApiError, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    await discardCalorieRun({ ownerUserId: user.id, runId: id })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
