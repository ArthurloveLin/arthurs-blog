import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { AGENT_RUNTIME_CACHE_TAGS, getAgentThreadTag } from '@/lib/agent-runtime/cache'
import { getAgentThreadBundleOrThrow, registerAgentAttachmentForOwner, saveAgentAttachmentUpload } from '@/lib/agent-runtime/service'
import { AppError } from '@/lib/app-error'
import {
  asOptionalRecord,
  asOptionalString,
  asRequiredString,
  handleApiError,
  readJsonBody,
  requireAdminUser,
} from '@/lib/server-api'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

async function parseUploadMetadata(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return undefined
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(rawValue)
  } catch {
    throw new AppError(400, 'metadata must be valid JSON')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AppError(400, 'metadata must be a JSON object')
  }

  return parsed as Record<string, unknown>
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const bundle = await getAgentThreadBundleOrThrow({ threadId: id, ownerUserId: user.id })
    return NextResponse.json(bundle.attachments)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminUser()
    const { id } = await params
    const contentType = request.headers.get('content-type') ?? ''

    const attachment = contentType.includes('multipart/form-data')
      ? await (async () => {
          const formData = await request.formData()
          const fileEntry = formData.get('file')
          if (!fileEntry || typeof fileEntry === 'string') {
            throw new AppError(400, 'file is required for multipart uploads')
          }

          const buffer = Buffer.from(await fileEntry.arrayBuffer())
          return saveAgentAttachmentUpload({
            threadId: id,
            ownerUserId: user.id,
            messageId: typeof formData.get('messageId') === 'string' ? String(formData.get('messageId')).trim() || null : null,
            mediaType: fileEntry.type || 'application/octet-stream',
            filename: fileEntry.name,
            content: buffer,
            metadata: await parseUploadMetadata(formData.get('metadata')),
          })
        })()
      : await (async () => {
          const body = await readJsonBody(request)
          return registerAgentAttachmentForOwner({
            threadId: id,
            ownerUserId: user.id,
            messageId: asOptionalString(body.messageId, 'messageId'),
            mediaType: asRequiredString(body.mediaType, 'mediaType'),
            storageBackend: asRequiredString(body.storageBackend, 'storageBackend') as 'local' | 'r2',
            storageKey: asRequiredString(body.storageKey, 'storageKey'),
            publicUrl: asOptionalString(body.publicUrl, 'publicUrl'),
            localCachePath: asOptionalString(body.localCachePath, 'localCachePath'),
            metadata: asOptionalRecord(body.metadata, 'metadata'),
          })
        })()

    revalidateTag(AGENT_RUNTIME_CACHE_TAGS.threads, 'max')
    revalidateTag(getAgentThreadTag(id), 'max')
    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}