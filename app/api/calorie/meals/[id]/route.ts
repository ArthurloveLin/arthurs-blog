import { NextResponse } from 'next/server'

import { deleteCalorieMeal } from '@/lib/calorie/service'
import { handleApiError, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const result = await deleteCalorieMeal({ ownerUserId: user.id, mealId: id })
    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
