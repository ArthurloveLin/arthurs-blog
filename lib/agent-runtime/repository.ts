import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  AgentAttachmentRecord,
  AgentMessageRecord,
  AgentRunRecord,
  AgentRunStatus,
  AgentThreadBundle,
  AgentThreadRecord,
} from '@/lib/agent-runtime/contracts'
import { AppError } from '@/lib/app-error'

type JsonRecord = Record<string, unknown>

function asJsonRecord(value: unknown): JsonRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as JsonRecord
  }

  return {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function isNoRowsError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'PGRST116'
}

function unwrapData<T>(data: T | null, error: unknown) {
  if (error) {
    if (isNoRowsError(error)) {
      return null
    }

    const message = error instanceof Error ? error.message : 'Supabase request failed'
    throw new AppError(500, message)
  }

  return data
}

function mapThread(row: Record<string, unknown>): AgentThreadRecord {
  return {
    id: String(row.id),
    app_key: String(row.app_key),
    task_key: String(row.task_key),
    owner_user_id: asString(row.owner_user_id),
    title: asString(row.title),
    status: String(row.status) as AgentThreadRecord['status'],
    metadata: asJsonRecord(row.metadata),
    latest_run_id: asString(row.latest_run_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapMessage(row: Record<string, unknown>): AgentMessageRecord {
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    role: String(row.role) as AgentMessageRecord['role'],
    text_content: asString(row.text_content),
    structured_content: asJsonRecord(row.structured_content),
    source_kind: String(row.source_kind) as AgentMessageRecord['source_kind'],
    created_at: String(row.created_at),
  }
}

function mapAttachment(row: Record<string, unknown>): AgentAttachmentRecord {
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    message_id: asString(row.message_id),
    media_type: String(row.media_type),
    storage_backend: String(row.storage_backend) as AgentAttachmentRecord['storage_backend'],
    storage_key: String(row.storage_key),
    public_url: asString(row.public_url),
    local_cache_path: asString(row.local_cache_path),
    metadata: asJsonRecord(row.metadata),
    created_at: String(row.created_at),
  }
}

function mapRun(row: Record<string, unknown>): AgentRunRecord {
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    app_key: String(row.app_key),
    task_key: String(row.task_key),
    status: String(row.status) as AgentRunRecord['status'],
    prompt_version: asString(row.prompt_version),
    knowledge_version: asString(row.knowledge_version),
    request_payload: asJsonRecord(row.request_payload),
    parsed_output: asJsonRecord(row.parsed_output),
    raw_stdout: asString(row.raw_stdout),
    raw_stderr: asString(row.raw_stderr),
    error_message: asString(row.error_message),
    started_at: asString(row.started_at),
    finished_at: asString(row.finished_at),
    created_at: String(row.created_at),
  }
}

async function touchThread(threadId: string, patch?: JsonRecord) {
  const { error } = await supabaseAdmin
    .from('agent_threads')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', threadId)

  if (error) {
    throw new AppError(500, error.message)
  }
}

export async function listAgentThreads(filters: {
  ownerUserId?: string
  appKey?: string
  taskKey?: string
  limit?: number
}) {
  let query = supabaseAdmin
    .from('agent_threads')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(filters.limit ?? 20)

  if (filters.ownerUserId) {
    query = query.eq('owner_user_id', filters.ownerUserId)
  }

  if (filters.appKey) {
    query = query.eq('app_key', filters.appKey)
  }

  if (filters.taskKey) {
    query = query.eq('task_key', filters.taskKey)
  }

  const { data, error } = await query
  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []).map((row) => mapThread(row as Record<string, unknown>))
}

export async function createAgentThread(input: {
  appKey: string
  taskKey: string
  ownerUserId: string
  title?: string | null
  metadata?: JsonRecord
}) {
  const { data, error } = await supabaseAdmin
    .from('agent_threads')
    .insert({
      app_key: input.appKey,
      task_key: input.taskKey,
      owner_user_id: input.ownerUserId,
      title: input.title ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  const row = unwrapData(data as Record<string, unknown> | null, error)
  if (!row) {
    throw new AppError(500, 'Failed to create agent thread')
  }

  return mapThread(row)
}

export async function getAgentThread(threadId: string) {
  const { data, error } = await supabaseAdmin
    .from('agent_threads')
    .select('*')
    .eq('id', threadId)
    .single()

  const row = unwrapData(data as Record<string, unknown> | null, error)
  return row ? mapThread(row) : null
}

export async function getAgentMessages(threadId: string) {
  const { data, error } = await supabaseAdmin
    .from('agent_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []).map((row) => mapMessage(row as Record<string, unknown>))
}

export async function createAgentMessage(input: {
  threadId: string
  role: AgentMessageRecord['role']
  textContent?: string | null
  structuredContent?: JsonRecord
  sourceKind?: AgentMessageRecord['source_kind']
}) {
  const { data, error } = await supabaseAdmin
    .from('agent_messages')
    .insert({
      thread_id: input.threadId,
      role: input.role,
      text_content: input.textContent ?? null,
      structured_content: input.structuredContent ?? {},
      source_kind: input.sourceKind ?? 'manual',
    })
    .select('*')
    .single()

  if (error) {
    throw new AppError(500, error.message)
  }

  await touchThread(input.threadId)
  return mapMessage(data as Record<string, unknown>)
}

export async function getAgentAttachments(threadId: string) {
  const { data, error } = await supabaseAdmin
    .from('agent_attachments')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []).map((row) => mapAttachment(row as Record<string, unknown>))
}

export async function createAgentAttachment(input: {
  threadId: string
  messageId?: string | null
  mediaType: string
  storageBackend: AgentAttachmentRecord['storage_backend']
  storageKey: string
  publicUrl?: string | null
  localCachePath?: string | null
  metadata?: JsonRecord
}) {
  const { data, error } = await supabaseAdmin
    .from('agent_attachments')
    .insert({
      thread_id: input.threadId,
      message_id: input.messageId ?? null,
      media_type: input.mediaType,
      storage_backend: input.storageBackend,
      storage_key: input.storageKey,
      public_url: input.publicUrl ?? null,
      local_cache_path: input.localCachePath ?? null,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) {
    throw new AppError(500, error.message)
  }

  await touchThread(input.threadId)
  return mapAttachment(data as Record<string, unknown>)
}

export async function updateAttachmentLocalCachePath(attachmentId: string, localCachePath: string) {
  const { data, error } = await supabaseAdmin
    .from('agent_attachments')
    .update({ local_cache_path: localCachePath })
    .eq('id', attachmentId)
    .select('*')
    .single()

  if (error) {
    throw new AppError(500, error.message)
  }

  return mapAttachment(data as Record<string, unknown>)
}

export async function createAgentRun(input: {
  threadId: string
  appKey: string
  taskKey: string
  status?: AgentRunStatus
  promptVersion?: string | null
  knowledgeVersion?: string | null
  requestPayload?: JsonRecord
  parsedOutput?: JsonRecord
  rawStdout?: string | null
  rawStderr?: string | null
  errorMessage?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}) {
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .insert({
      thread_id: input.threadId,
      app_key: input.appKey,
      task_key: input.taskKey,
      status: input.status ?? 'queued',
      prompt_version: input.promptVersion ?? null,
      knowledge_version: input.knowledgeVersion ?? null,
      request_payload: input.requestPayload ?? {},
      parsed_output: input.parsedOutput ?? {},
      raw_stdout: input.rawStdout ?? null,
      raw_stderr: input.rawStderr ?? null,
      error_message: input.errorMessage ?? null,
      started_at: input.startedAt ?? null,
      finished_at: input.finishedAt ?? null,
    })
    .select('*')
    .single()

  if (error) {
    throw new AppError(500, error.message)
  }

  return mapRun(data as Record<string, unknown>)
}

export async function updateAgentRun(
  runId: string,
  patch: Partial<{
    status: AgentRunStatus
    prompt_version: string | null
    knowledge_version: string | null
    request_payload: JsonRecord
    parsed_output: JsonRecord
    raw_stdout: string | null
    raw_stderr: string | null
    error_message: string | null
    started_at: string | null
    finished_at: string | null
  }>
) {
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .update(patch)
    .eq('id', runId)
    .select('*')
    .single()

  if (error) {
    throw new AppError(500, error.message)
  }

  return mapRun(data as Record<string, unknown>)
}

export async function getAgentRun(runId: string) {
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('*')
    .eq('id', runId)
    .single()

  const row = unwrapData(data as Record<string, unknown> | null, error)
  return row ? mapRun(row) : null
}

export async function listAgentRuns(filters: {
  threadId?: string
  threadIds?: string[]
  status?: AgentRunStatus
  limit?: number
}) {
  let query = supabaseAdmin
    .from('agent_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 20)

  if (filters.threadId) {
    query = query.eq('thread_id', filters.threadId)
  }

  if (filters.threadIds && filters.threadIds.length > 0) {
    query = query.in('thread_id', filters.threadIds)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []).map((row) => mapRun(row as Record<string, unknown>))
}

export async function setThreadLatestRun(threadId: string, runId: string | null) {
  await touchThread(threadId, { latest_run_id: runId })
}

export async function getAgentThreadBundle(threadId: string): Promise<AgentThreadBundle | null> {
  const thread = await getAgentThread(threadId)
  if (!thread) {
    return null
  }

  const [messages, attachments, runs] = await Promise.all([
    getAgentMessages(threadId),
    getAgentAttachments(threadId),
    listAgentRuns({ threadId, limit: 50 }),
  ])

  return {
    thread,
    messages,
    attachments,
    runs,
  }
}