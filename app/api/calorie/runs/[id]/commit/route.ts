import { NextRequest, NextResponse } from 'next/server'

import { validateCalorieDraftPayload } from '@/lib/agent-runtime/validation'
import { commitCalorieRun } from '@/lib/calorie/service'
import { AppError } from '@/lib/app-error'
import { asOptionalString, handleApiError, readOptionalJsonBody, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const body = await readOptionalJsonBody(request)

    let editedPayload = null
    if (body.editedPayload !== undefined && body.editedPayload !== null) {
      try {
        editedPayload = validateCalorieDraftPayload(body.editedPayload)
      } catch (err) {
        throw new AppError(400, err instanceof Error ? err.message : 'Invalid editedPayload')
      }
    }

    const response = await commitCalorieRun({
      ownerUserId: user.id,
      runId: id,
      dateOverride: asOptionalString(body.date, 'date'),
      editedPayload,
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}