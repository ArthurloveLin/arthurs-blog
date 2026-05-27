import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

import { getAgentRuntimeConfig, assertAgentRuntimeReady } from '@/lib/agent-runtime/config'
import type {
  AgentAttachmentRecord,
  AgentMessageRecord,
  AgentRunExecutionInput,
  AgentRunExecutionResult,
  AgentRunRecord,
  AgentThreadBundle,
  AgentThreadRecord,
} from '@/lib/agent-runtime/contracts'
import { executeAgyPrompt, type AgyExecutionResult } from '@/lib/agent-runtime/executor'
import { getAgentRuntimeAdapter } from '@/lib/agent-runtime/registry'
import {
  createAgentAttachment,
  createAgentMessage,
  createAgentRun,
  createAgentThread,
  getAgentRun,
  getAgentThreadBundle,
  listAgentRuns,
  listAgentThreads,
  setThreadLatestRun,
  updateAgentRun,
} from '@/lib/agent-runtime/repository'
import { materializeAttachments } from '@/lib/agent-runtime/attachments'
import { AppError } from '@/lib/app-error'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown runtime error'
}

function getExecutionArtifact(error: unknown): Partial<AgyExecutionResult> | null {
  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined
  return isRecord(cause) ? cause : null
}

function guessExtension(filename: string | null | undefined, mediaType: string) {
  const filenameExtension = filename ? extname(filename) : ''
  if (filenameExtension) {
    return filenameExtension
  }

  const byMimeType: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'application/json': '.json',
    'text/plain': '.txt',
  }

  return byMimeType[mediaType] ?? ''
}

function ensureThreadOwnership(thread: AgentThreadRecord, ownerUserId: string) {
  if (thread.owner_user_id !== ownerUserId) {
    throw new AppError(404, 'Agent thread not found')
  }
}

function ensureRunOwnership(thread: AgentThreadRecord, ownerUserId: string) {
  if (thread.owner_user_id !== ownerUserId) {
    throw new AppError(404, 'Agent run not found')
  }
}

function getLatestUserMessage(
  bundle: AgentThreadBundle,
  requestedMessageId?: string
): AgentMessageRecord | null {
  if (requestedMessageId) {
    const requestedMessage = bundle.messages.find((message) => message.id === requestedMessageId)
    if (!requestedMessage) {
      throw new AppError(400, `Message ${requestedMessageId} does not belong to thread ${bundle.thread.id}`)
    }

    return requestedMessage
  }

  const reversedMessages = [...bundle.messages].reverse()
  return reversedMessages.find((message) => message.role === 'user') ?? null
}

function selectAttachments(bundle: AgentThreadBundle, attachmentIds?: string[]) {
  if (!attachmentIds || attachmentIds.length === 0) {
    return bundle.attachments
  }

  const selected = bundle.attachments.filter((attachment) => attachmentIds.includes(attachment.id))
  if (selected.length !== attachmentIds.length) {
    throw new AppError(400, 'Some attachmentIds do not belong to the target thread')
  }

  return selected
}

export async function listAgentThreadsForOwner(input: {
  ownerUserId: string
  appKey?: string
  taskKey?: string
  limit?: number
}) {
  return listAgentThreads({
    ownerUserId: input.ownerUserId,
    appKey: input.appKey,
    taskKey: input.taskKey,
    limit: input.limit,
  })
}

export async function createAgentThreadForOwner(input: {
  ownerUserId: string
  appKey: string
  taskKey: string
  title?: string | null
  metadata?: JsonRecord
}) {
  return createAgentThread(input)
}

export async function getAgentThreadBundleOrThrow(input: { threadId: string; ownerUserId: string }) {
  const bundle = await getAgentThreadBundle(input.threadId)
  if (!bundle) {
    throw new AppError(404, 'Agent thread not found')
  }

  ensureThreadOwnership(bundle.thread, input.ownerUserId)
  return bundle
}

export async function createAgentMessageForOwner(input: {
  threadId: string
  ownerUserId: string
  role: AgentMessageRecord['role']
  textContent?: string | null
  structuredContent?: JsonRecord
  sourceKind?: AgentMessageRecord['source_kind']
}) {
  const bundle = await getAgentThreadBundleOrThrow({ threadId: input.threadId, ownerUserId: input.ownerUserId })
  ensureThreadOwnership(bundle.thread, input.ownerUserId)

  const hasText = typeof input.textContent === 'string' && input.textContent.trim().length > 0
  const hasStructuredContent = input.structuredContent && Object.keys(input.structuredContent).length > 0

  if (!hasText && !hasStructuredContent) {
    throw new AppError(400, 'textContent or structuredContent is required')
  }

  return createAgentMessage({
    threadId: input.threadId,
    role: input.role,
    textContent: input.textContent ?? null,
    structuredContent: input.structuredContent ?? {},
    sourceKind: input.sourceKind,
  })
}

export async function registerAgentAttachmentForOwner(input: {
  threadId: string
  ownerUserId: string
  messageId?: string | null
  mediaType: string
  storageBackend: AgentAttachmentRecord['storage_backend']
  storageKey: string
  publicUrl?: string | null
  localCachePath?: string | null
  metadata?: JsonRecord
}) {
  await getAgentThreadBundleOrThrow({ threadId: input.threadId, ownerUserId: input.ownerUserId })

  return createAgentAttachment({
    threadId: input.threadId,
    messageId: input.messageId,
    mediaType: input.mediaType,
    storageBackend: input.storageBackend,
    storageKey: input.storageKey,
    publicUrl: input.publicUrl,
    localCachePath: input.localCachePath,
    metadata: input.metadata,
  })
}

export async function saveAgentAttachmentUpload(input: {
  threadId: string
  ownerUserId: string
  messageId?: string | null
  mediaType: string
  filename?: string | null
  content: Buffer
  metadata?: JsonRecord
}) {
  await getAgentThreadBundleOrThrow({ threadId: input.threadId, ownerUserId: input.ownerUserId })

  const { config } = getAgentRuntimeConfig()
  const attachmentId = randomUUID()
  const extension = guessExtension(input.filename, input.mediaType)
  const targetDirectory = join(config.uploadRoot.value, input.threadId)
  const targetPath = join(targetDirectory, `${attachmentId}${extension}`)

  await assertAgentRuntimeReady()
  await mkdir(targetDirectory, { recursive: true })
  await writeFile(targetPath, input.content)

  return createAgentAttachment({
    threadId: input.threadId,
    messageId: input.messageId,
    mediaType: input.mediaType,
    storageBackend: 'local',
    storageKey: targetPath,
    publicUrl: null,
    localCachePath: targetPath,
    metadata: {
      ...(input.metadata ?? {}),
      filename: input.filename ?? null,
      original_size: input.content.byteLength,
    },
  })
}

export async function getAgentRunDetailOrThrow(input: { runId: string; ownerUserId: string }) {
  const run = await getAgentRun(input.runId)
  if (!run) {
    throw new AppError(404, 'Agent run not found')
  }

  const bundle = await getAgentThreadBundleOrThrow({ threadId: run.thread_id, ownerUserId: input.ownerUserId })
  ensureRunOwnership(bundle.thread, input.ownerUserId)

  return {
    run,
    thread: bundle.thread,
    messages: bundle.messages,
    attachments: bundle.attachments,
  }
}

export async function listAgentRunsForOwner(input: {
  ownerUserId: string
  threadId?: string
  limit?: number
}) {
  if (input.threadId) {
    await getAgentThreadBundleOrThrow({ threadId: input.threadId, ownerUserId: input.ownerUserId })
    return listAgentRuns({ threadId: input.threadId, limit: input.limit })
  }

  const threads = await listAgentThreads({ ownerUserId: input.ownerUserId, limit: 100 })
  if (threads.length === 0) {
    return [] as AgentRunRecord[]
  }

  return listAgentRuns({
    threadIds: threads.map((thread) => thread.id),
    limit: input.limit,
  })
}

export async function executeAgentRunForOwner(
  input: AgentRunExecutionInput & { ownerUserId: string }
): Promise<AgentRunExecutionResult> {
  const bundle = await getAgentThreadBundleOrThrow({ threadId: input.threadId, ownerUserId: input.ownerUserId })
  const adapter = getAgentRuntimeAdapter(bundle.thread.app_key, bundle.thread.task_key)
  const relevantAttachments = selectAttachments(bundle, input.attachmentIds)
  const latestUserMessage = getLatestUserMessage(bundle, input.messageId)
  const requestedPayload: JsonRecord = {
    ...(input.requestPayload ?? {}),
    messageId: latestUserMessage?.id ?? null,
    attachmentIds: relevantAttachments.map((attachment) => attachment.id),
    retryFromRunId: input.retryFromRunId ?? null,
  }

  const queuedRun = await createAgentRun({
    threadId: bundle.thread.id,
    appKey: bundle.thread.app_key,
    taskKey: bundle.thread.task_key,
    status: 'queued',
    requestPayload: requestedPayload,
  })

  const startedAt = new Date().toISOString()
  let promptVersion: string | null = null
  let knowledgeVersion: string | null = null
  let rawStdout: string | null = null
  let rawStderr: string | null = null

  try {
    await updateAgentRun(queuedRun.id, { status: 'running', started_at: startedAt })
    await assertAgentRuntimeReady()

    const materializedAttachments = await materializeAttachments(relevantAttachments)
    const promptContext = {
      thread: bundle.thread,
      messages: bundle.messages,
      attachments: materializedAttachments,
      latestUserMessage,
      requestPayload: requestedPayload,
    }

    const promptBuild = await adapter.buildPrompt(promptContext)
    promptVersion = promptBuild.promptVersion
    knowledgeVersion = promptBuild.knowledgeVersion ?? null

    const { config } = getAgentRuntimeConfig()
    const execution = await executeAgyPrompt({
      prompt: promptBuild.prompt,
      addDirs: materializedAttachments.length > 0 ? [config.uploadRoot.value] : [],
      homeSubpath: `thread-${bundle.thread.id}`,
    })

    rawStdout = execution.stdout
    rawStderr = execution.stderr

    const parsed = await adapter.parseOutput(execution.stdout, promptContext)
    const assistantMessage = await createAgentMessage({
      threadId: bundle.thread.id,
      role: 'assistant',
      textContent: parsed.assistantMessage,
      structuredContent: {
        draftPayload: parsed.draftPayload,
        metadata: parsed.metadata ?? {},
        runId: queuedRun.id,
      },
      sourceKind: 'runtime',
    })

    const updatedRun = await updateAgentRun(queuedRun.id, {
      status: parsed.status,
      prompt_version: promptVersion,
      knowledge_version: knowledgeVersion,
      request_payload: {
        ...requestedPayload,
        buildMetadata: promptBuild.metadata ?? {},
      },
      parsed_output: {
        assistantMessageId: assistantMessage.id,
        draftPayload: parsed.draftPayload,
        metadata: parsed.metadata ?? {},
      },
      raw_stdout: rawStdout,
      raw_stderr: rawStderr,
      error_message: null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    })

    await setThreadLatestRun(bundle.thread.id, updatedRun.id)

    return {
      run: updatedRun,
      assistantMessage,
      parsed,
    }
  } catch (error) {
    const executionArtifact = getExecutionArtifact(error)
    rawStdout = typeof executionArtifact?.stdout === 'string' ? executionArtifact.stdout : rawStdout
    rawStderr = typeof executionArtifact?.stderr === 'string' ? executionArtifact.stderr : rawStderr

    const failedRun = await updateAgentRun(queuedRun.id, {
      status: 'failed',
      prompt_version: promptVersion,
      knowledge_version: knowledgeVersion,
      request_payload: requestedPayload,
      raw_stdout: rawStdout,
      raw_stderr: rawStderr,
      error_message: getErrorMessage(error),
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    })

    await setThreadLatestRun(bundle.thread.id, failedRun.id)
    throw error
  }
}

export async function retryAgentRunForOwner(input: { runId: string; ownerUserId: string }) {
  const { run } = await getAgentRunDetailOrThrow(input)

  return executeAgentRunForOwner({
    ownerUserId: input.ownerUserId,
    threadId: run.thread_id,
    requestPayload: run.request_payload,
    messageId: typeof run.request_payload.messageId === 'string' ? run.request_payload.messageId : undefined,
    attachmentIds: Array.isArray(run.request_payload.attachmentIds)
      ? run.request_payload.attachmentIds.filter((item): item is string => typeof item === 'string')
      : undefined,
    retryFromRunId: run.id,
  })
}