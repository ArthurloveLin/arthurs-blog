import { NextResponse } from 'next/server'

import { deleteCalorieWorkspace } from '@/lib/calorie/service'
import { handleApiError, requireAdminUser } from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    await deleteCalorieWorkspace({ ownerUserId: user.id, workspaceId: id })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
