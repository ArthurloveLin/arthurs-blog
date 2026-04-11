import { cache } from 'react'
import { getUserRole, type UserRole } from '@/lib/auth'
import { getNoteBoardConfig, isNoteBoardSlug, type NoteBoardSlug } from '@/lib/note-board-config'
import { supabaseAdmin } from '@/lib/supabase'

export interface NoteMessage {
  id: string
  author: string
  content: string
  created_at: string
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

export { getNoteBoardConfig, isNoteBoardSlug }

export const getBoardMessages = cache(async (board: NoteBoardSlug, limit = getNoteBoardConfig(board).initialPageLimit, offset = 0) => {
  const config = getNoteBoardConfig(board)
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at, parent_id')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
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
    .select('id, author, content, created_at, parent_id')
    .single()

  if (error) {
    throw new Error(error.message)
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
  }
}
