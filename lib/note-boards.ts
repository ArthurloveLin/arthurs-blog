import { cache } from 'react'
import { DEFAULT_NOTE_PRIORITY, isNotePriority, type NotePriority, type NoteSortMode } from '@/lib/note-priority'
import { getUserRole, type UserRole } from '@/lib/auth'
import { getNoteBoardConfig, isNoteBoardSlug, type NoteBoardSlug } from '@/lib/note-board-config'
import { supabaseAdmin } from '@/lib/supabase'

export interface NoteMessage {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  priority: NotePriority
  archived: boolean
  parent_id: string | null
}

function canWriteBoard(board: NoteBoardSlug, role: UserRole) {
  return board === 'guestbook' || role === 'admin'
}

function normalizeRequesterIdentities(requesterIdentity?: string | string[] | null) {
  return (Array.isArray(requesterIdentity) ? requesterIdentity : [requesterIdentity]).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
}

function canDeleteBoardMessage(board: NoteBoardSlug, role: UserRole, noteAuthor: string, requesterIdentity?: string | string[] | null) {
  if (board === 'memo') {
    return role === 'admin'
  }

  const requesterIdentities = normalizeRequesterIdentities(requesterIdentity)
  return role === 'admin' || requesterIdentities.includes(noteAuthor)
}

function canEditBoardMessage(role: UserRole, noteAuthor: string, requesterIdentity?: string | string[] | null) {
  const requesterIdentities = normalizeRequesterIdentities(requesterIdentity)
  return role === 'admin' || requesterIdentities.includes(noteAuthor)
}

interface UpdateBoardMessageInput {
  content?: string
  archived?: boolean
  priority?: NotePriority
}

export { getNoteBoardConfig, isNoteBoardSlug }

export const getBoardMessages = cache(async (
  board: NoteBoardSlug,
  limit = getNoteBoardConfig(board).initialPageLimit,
  offset = 0,
  archived = false,
  sort: NoteSortMode = 'time',
) => {
  const config = getNoteBoardConfig(board)
  let query = supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', archived)
    .is('parent_id', null)
    .range(offset, offset + limit - 1)

  if (sort === 'priority') {
    query = query.order('priority', { ascending: false })
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as NoteMessage[]
})

export async function createBoardMessage(board: NoteBoardSlug, author: string, content: string, priority?: NotePriority) {
  const config = getNoteBoardConfig(board)
  const role = await getUserRole()

  if (!canWriteBoard(board, role)) {
    throw new Error('FORBIDDEN')
  }

  const nextPriority = priority ?? DEFAULT_NOTE_PRIORITY

  if (!isNotePriority(nextPriority)) {
    throw new Error('INVALID_PRIORITY')
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      target_type: config.targetType,
      target_id: config.targetId,
      author: author.trim(),
      content: content.trim(),
      priority: nextPriority,
      parent_id: null,
    })
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as NoteMessage
}

export async function updateBoardMessage(
  board: NoteBoardSlug,
  id: string,
  input: UpdateBoardMessageInput,
  requesterIdentity?: string | string[] | null,
) {
  const config = getNoteBoardConfig(board)
  const role = await getUserRole()

  const { data: note, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('id, author, target_type, target_id')
    .eq('id', id)
    .single()

  if (fetchError || !note) {
    throw new Error('NOT_FOUND')
  }

  if (note.target_type !== config.targetType || note.target_id !== config.targetId) {
    throw new Error('NOT_FOUND')
  }

  if (!canEditBoardMessage(role, note.author, requesterIdentity)) {
    throw new Error('FORBIDDEN')
  }

  const patch: Record<string, string | boolean | number> = {}

  if (typeof input.content === 'string') {
    const content = input.content.trim()
    if (!content) {
      throw new Error('MISSING_CONTENT')
    }

    patch.content = content
  }

  if (typeof input.archived === 'boolean') {
    patch.archived = input.archived
  }

  if (typeof input.priority !== 'undefined') {
    if (!isNotePriority(input.priority)) {
      throw new Error('INVALID_PRIORITY')
    }

    patch.priority = input.priority
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('MISSING_PATCH')
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update(patch)
    .eq('id', id)
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'UPDATE_FAILED')
  }

  return data as NoteMessage
}

export async function deleteBoardMessage(
  board: NoteBoardSlug,
  id: string,
  requesterIdentity?: string | string[] | null,
) {
  const config = getNoteBoardConfig(board)
  const role = await getUserRole()

  const { data: note, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('id, author, target_type, target_id')
    .eq('id', id)
    .single()

  if (fetchError || !note) {
    throw new Error('NOT_FOUND')
  }

  if (note.target_type !== config.targetType || note.target_id !== config.targetId) {
    throw new Error('NOT_FOUND')
  }

  if (!canDeleteBoardMessage(board, role, note.author, requesterIdentity)) {
    throw new Error('FORBIDDEN')
  }

  const { error } = await supabaseAdmin.from('comments').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function getBoardViewerState(board: NoteBoardSlug, identity?: string | string[] | null) {
  const role = await getUserRole()

  const identities = normalizeRequesterIdentities(identity)
  const primaryIdentity = identities[0] ?? ''

  return {
    role,
    canWrite: canWriteBoard(board, role),
    canDeleteOwn: canDeleteBoardMessage(board, role, primaryIdentity, identities),
    canEditOwn: canEditBoardMessage(role, primaryIdentity, identities),
  }
}
