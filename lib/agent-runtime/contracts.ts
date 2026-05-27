import 'server-only'

export type AgentThreadStatus = 'active' | 'archived' | 'closed'
export type AgentMessageRole = 'system' | 'user' | 'assistant' | 'tool'
export type AgentMessageSourceKind = 'manual' | 'upload' | 'runtime' | 'system_seed'
export type AgentAttachmentStorageBackend = 'r2' | 'local'
export type AgentRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'needs_confirmation' | 'cancelled'

export interface AgentThreadRecord {
  id: string
  app_key: string
  task_key: string
  owner_user_id: string | null
  title: string | null
  status: AgentThreadStatus
  metadata: Record<string, unknown>
  latest_run_id: string | null
  created_at: string
  updated_at: string
}

export interface AgentMessageRecord {
  id: string
  thread_id: string
  role: AgentMessageRole
  text_content: string | null
  structured_content: Record<string, unknown>
  source_kind: AgentMessageSourceKind
  created_at: string
}

export interface AgentAttachmentRecord {
  id: string
  thread_id: string
  message_id: string | null
  media_type: string
  storage_backend: AgentAttachmentStorageBackend
  storage_key: string
  public_url: string | null
  local_cache_path: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AgentRunRecord {
  id: string
  thread_id: string
  app_key: string
  task_key: string
  status: AgentRunStatus
  prompt_version: string | null
  knowledge_version: string | null
  request_payload: Record<string, unknown>
  parsed_output: Record<string, unknown>
  raw_stdout: string | null
  raw_stderr: string | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface AgentThreadBundle {
  thread: AgentThreadRecord
  messages: AgentMessageRecord[]
  attachments: AgentAttachmentRecord[]
  runs: AgentRunRecord[]
}

export interface AgentPromptAttachment {
  attachmentId: string
  mediaType: string
  absolutePath: string
  publicUrl: string | null
  metadata: Record<string, unknown>
}

export interface AgentPromptContext {
  thread: AgentThreadRecord
  messages: AgentMessageRecord[]
  attachments: AgentPromptAttachment[]
  latestUserMessage: AgentMessageRecord | null
  requestPayload: Record<string, unknown>
}

export interface AgentParsedResult<TOutput extends Record<string, unknown> = Record<string, unknown>> {
  status: Extract<AgentRunStatus, 'succeeded' | 'needs_confirmation'>
  assistantMessage: string
  draftPayload: TOutput
  metadata?: Record<string, unknown>
}

export interface AgentPromptBuildResult {
  prompt: string
  promptVersion: string
  knowledgeVersion?: string | null
  metadata?: Record<string, unknown>
}

export interface AgentRuntimeAdapter<TOutput extends Record<string, unknown> = Record<string, unknown>> {
  appKey: string
  taskKey: string
  buildPrompt(context: AgentPromptContext): Promise<AgentPromptBuildResult>
  parseOutput(stdout: string, context: AgentPromptContext): Promise<AgentParsedResult<TOutput>>
}

export interface AgentRunExecutionInput {
  threadId: string
  requestPayload?: Record<string, unknown>
  messageId?: string
  attachmentIds?: string[]
  retryFromRunId?: string
}

export interface AgentRunExecutionResult<TOutput extends Record<string, unknown> = Record<string, unknown>> {
  run: AgentRunRecord
  assistantMessage: AgentMessageRecord | null
  parsed: AgentParsedResult<TOutput> | null
}

export interface CalorieNutritionDraft {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  fiber_g: number | null
  sugar_g: number | null
  sodium_mg: number | null
}

export interface CalorieEntryDraft extends CalorieNutritionDraft {
  food_name: string
  food_alias?: string | null
  quantity_text?: string | null
  grams?: number | null
  estimate_level: 'confirmed' | 'database' | 'estimated'
  source_kind: 'agent' | 'knowledge_db' | 'reference_override' | 'ocr' | 'manual'
  confidence_score?: number | null
  needs_review?: boolean
  source_ref?: Record<string, unknown>
}

export interface CalorieMealDraft {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'custom'
  meal_label?: string | null
  occurred_at?: string | null
  items: CalorieEntryDraft[]
}

export interface CalorieDraftPayload extends Record<string, unknown> {
  schemaVersion: 'calorie-draft-v1'
  date: string | null
  summary: string
  insights: string[]
  totals: CalorieNutritionDraft
  meals: CalorieMealDraft[]
}