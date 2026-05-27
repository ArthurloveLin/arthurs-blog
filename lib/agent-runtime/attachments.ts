import 'server-only'

import { constants as fsConstants } from 'node:fs'
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

import { getAgentRuntimeConfig } from '@/lib/agent-runtime/config'
import type { AgentAttachmentRecord, AgentPromptAttachment } from '@/lib/agent-runtime/contracts'
import { updateAttachmentLocalCachePath } from '@/lib/agent-runtime/repository'
import { AppError } from '@/lib/app-error'
import { getR2ObjectBuffer } from '@/lib/r2'

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'attachment'
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

function inferExtension(attachment: AgentAttachmentRecord) {
  const explicitName = typeof attachment.metadata.filename === 'string' ? attachment.metadata.filename : null
  const explicitExtension = explicitName ? extname(explicitName) : ''
  if (explicitExtension) {
    return explicitExtension
  }

  const byMimeType: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'text/plain': '.txt',
    'application/json': '.json',
  }

  return byMimeType[attachment.media_type] ?? ''
}

async function fetchAttachmentBuffer(attachment: AgentAttachmentRecord) {
  if (attachment.public_url) {
    const response = await fetch(attachment.public_url)
    if (!response.ok) {
      throw new AppError(502, `Failed to fetch attachment from ${attachment.public_url}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  const bucket = typeof attachment.metadata.r2_bucket === 'string' ? attachment.metadata.r2_bucket : null
  if (bucket) {
    return getR2ObjectBuffer(bucket, attachment.storage_key)
  }

  throw new AppError(500, `Attachment ${attachment.id} cannot be materialized`)
}

export async function materializeAttachment(attachment: AgentAttachmentRecord): Promise<AgentPromptAttachment> {
  const { config } = getAgentRuntimeConfig()
  const uploadRoot = resolve(config.uploadRoot.value)
  const threadDir = join(uploadRoot, sanitizePathSegment(attachment.thread_id))
  await mkdir(threadDir, { recursive: true })

  if (attachment.local_cache_path) {
    const resolvedLocalPath = resolve(attachment.local_cache_path)
    if (await pathExists(resolvedLocalPath)) {
      return {
        attachmentId: attachment.id,
        mediaType: attachment.media_type,
        absolutePath: resolvedLocalPath,
        publicUrl: attachment.public_url,
        metadata: attachment.metadata,
      }
    }
  }

  const extension = inferExtension(attachment)
  const targetPath = join(threadDir, `${sanitizePathSegment(attachment.id)}${extension}`)

  if (attachment.storage_backend === 'local') {
    const sourcePath = resolve(attachment.storage_key)
    if (!await pathExists(sourcePath)) {
      throw new AppError(500, `Local attachment source is missing: ${attachment.storage_key}`)
    }

    if (sourcePath.startsWith(uploadRoot)) {
      await updateAttachmentLocalCachePath(attachment.id, sourcePath)
      return {
        attachmentId: attachment.id,
        mediaType: attachment.media_type,
        absolutePath: sourcePath,
        publicUrl: attachment.public_url,
        metadata: attachment.metadata,
      }
    }

    await copyFile(sourcePath, targetPath)
  } else {
    const buffer = await fetchAttachmentBuffer(attachment)
    await writeFile(targetPath, buffer)
  }

  await updateAttachmentLocalCachePath(attachment.id, targetPath)

  return {
    attachmentId: attachment.id,
    mediaType: attachment.media_type,
    absolutePath: targetPath,
    publicUrl: attachment.public_url,
    metadata: attachment.metadata,
  }
}

export async function materializeAttachments(attachments: AgentAttachmentRecord[]) {
  return Promise.all(attachments.map((attachment) => materializeAttachment(attachment)))
}