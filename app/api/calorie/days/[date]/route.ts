import { NextRequest, NextResponse } from 'next/server'

import { getCalorieDay, patchCalorieDay } from '@/lib/calorie/service'
import { handleApiError, readJsonBody, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ date: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { date } = await params
    const response = await getCalorieDay(user.id, date)
    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { date } = await params
    const body = await readJsonBody(request)
    const response = await patchCalorieDay({
      ownerUserId: user.id,
      date,
      updates: body,
    })

    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error)
  }
}