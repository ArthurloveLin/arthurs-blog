import { cache } from 'react'
import { getUserRole, type UserRole } from '@/lib/auth'
import { getNoteBoardConfig, isNoteBoardSlug, type NoteBoardSlug } from '@/lib/note-board-config'
import { supabaseAdmin } from '@/lib/supabase'

export interface NoteMessage {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  archived: boolean
  parent_id: string | null
}

function canWriteBoard(board: NoteBoardSlug, role: UserRole) {
  return board === 'guestbook' || role === 'admin'
}

function canDeleteBoardMessage(board: NoteBoardSlug, role: UserRole, noteAuthor: string, requesterIdentity?: string | null) {
  if (board === 'memo') {
    return role === 'admin'
  }

  return role === 'admin' || (!!requesterIdentity && requesterIdentity === noteAuthor)
}

function canEditBoardMessage(role: UserRole, noteAuthor: string, requesterIdentity?: string | null) {
  return role === 'admin' || (!!requesterIdentity && requesterIdentity === noteAuthor)
}

interface BoardMessageQueryOptions {
  archived?: boolean
}

interface UpdateBoardMessageInput {
  content?: string
  archived?: boolean
}

export { getNoteBoardConfig, isNoteBoardSlug }

export const getBoardMessages = cache(async (
  board: NoteBoardSlug,
  limit = getNoteBoardConfig(board).initialPageLimit,
  offset = 0,
  options: BoardMessageQueryOptions = {},
) => {
  const config = getNoteBoardConfig(board)
  const archived = options.archived ?? false
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at, updated_at, archived, parent_id')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', archived)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as NoteMessage[]
})

export async function createBoardMessage(board: NoteBoardSlug, author: string, content: string) {
  const config = getNoteBoardConfig(board)
  const role = await getUserRole()

  if (!canWriteBoard(board, role)) {
    throw new Error('FORBIDDEN')
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      target_type: config.targetType,
      target_id: config.targetId,
      author: author.trim(),
      content: content.trim(),
      parent_id: null,
    })
    .select('id, author, content, created_at, updated_at, archived, parent_id')
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
  requesterIdentity?: string | null,
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

  const patch: Record<string, string | boolean> = {}

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

  if (Object.keys(patch).length === 0) {
    throw new Error('MISSING_PATCH')
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update(patch)
    .eq('id', id)
    .select('id, author, content, created_at, updated_at, archived, parent_id')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'UPDATE_FAILED')
  }

  return data as NoteMessage
}

export async function deleteBoardMessage(
  board: NoteBoardSlug,
  id: string,
  requesterIdentity?: string | null,
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

export async function getBoardViewerState(board: NoteBoardSlug, identity?: string | null) {
  const role = await getUserRole()

  return {
    role,
    canWrite: canWriteBoard(board, role),
    canDeleteOwn: canDeleteBoardMessage(board, role, identity ?? '', identity),
    canEditOwn: canEditBoardMessage(role, identity ?? '', identity),
  }
}
