import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { CALORIE_CACHE_TAGS, getCalorieWorkspaceTag } from '@/lib/calorie/cache'
import { createCalorieWorkspace, listCalorieWorkspaces } from '@/lib/calorie/service'
import {
  asOptionalRecord,
  asOptionalString,
  handleApiError,
  readJsonBody,
  requireAdminUser,
} from '@/lib/server-api'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await requireAdminUser()
    const workspaces = await listCalorieWorkspaces(user.id)
    return NextResponse.json(workspaces)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminUser()
    const body = await readJsonBody(request)
    const workspace = await createCalorieWorkspace({
      ownerUserId: user.id,
      title: asOptionalString(body.title, 'title'),
      metadata: asOptionalRecord(body.metadata, 'metadata'),
    })

    revalidateTag(CALORIE_CACHE_TAGS.workspaces, 'max')
    revalidateTag(getCalorieWorkspaceTag(workspace.id), 'max')
    return NextResponse.json(workspace, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}