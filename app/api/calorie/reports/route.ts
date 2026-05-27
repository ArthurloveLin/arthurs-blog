import { NextRequest, NextResponse } from 'next/server'

import { AppError } from '@/lib/app-error'
import { getCalorieReports } from '@/lib/calorie/service'
import { getOptionalSearchParam, handleApiError, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdminUser()
    const period = (getOptionalSearchParam(request, 'period') ?? 'day') as 'day' | 'week' | 'month'
    const anchor = getOptionalSearchParam(request, 'anchor') ?? new Date().toISOString().slice(0, 10)

    if (!['day', 'week', 'month'].includes(period)) {
      throw new AppError(400, 'period must be one of day, week, month')
    }

    const report = await getCalorieReports({
      ownerUserId: user.id,
      period,
      anchor,
    })

    return NextResponse.json(report)
  } catch (error) {
    return handleApiError(error)
  }
}