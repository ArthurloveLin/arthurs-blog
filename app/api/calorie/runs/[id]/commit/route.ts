import { NextRequest, NextResponse } from 'next/server'

import { commitCalorieRun } from '@/lib/calorie/service'
import { asOptionalString, handleApiError, readOptionalJsonBody, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const body = await readOptionalJsonBody(request)
    const response = await commitCalorieRun({
      ownerUserId: user.id,
      runId: id,
      dateOverride: asOptionalString(body.date, 'date'),
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}