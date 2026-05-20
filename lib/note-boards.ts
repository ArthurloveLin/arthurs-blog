import { cache } from 'react'
import { attachViewerEmojiReactions, type EmojiReactionEntry } from '@/lib/comment-emojis'
import { attachViewerReactions, type ReactionValue } from '@/lib/comment-reactions'
import { applyViewerStateToComments, type CommentSyncState } from '@/lib/comments'
import { getCommentThread, getCommentViewerState } from '@/lib/comments-server'
import { createGuestbookMessagesFromComments } from '@/lib/guestbook-comments'
import {
  DEFAULT_NOTE_PRIORITY,
  isNotePriority,
  type NotePriority,
  type NoteSortDirection,
  type NoteSortMode,
} from '@/lib/note-priority'
import { getCurrentUser, getUserRole, type UserRole } from '@/lib/auth'
import { getNoteBoardConfig, isNoteBoardSlug, type NoteBoardSlug } from '@/lib/note-board-config'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type NoteVisibility = 'public' | 'admin_only'

export interface NoteMessage {
  id: string
  visual_seed?: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
  priority: NotePriority
  archived: boolean
  parent_id: string | null
  upvotes: number
  downvotes: number
  viewer_reaction: ReactionValue
  emoji_reactions: EmojiReactionEntry[]
  viewer_emojis: string[]
  sync_state?: CommentSyncState
  visibility: NoteVisibility
  comment_count?: number
  due_at?: string | null
  notified_dues?: string[] | null
}

function compareBoardMessageTime(
  left: Pick<NoteMessage, 'created_at' | 'updated_at' | 'id'>,
  right: Pick<NoteMessage, 'created_at' | 'updated_at' | 'id'>,
  sortDirection: NoteSortDirection = 'desc',
) {
  const directionFactor = sortDirection === 'asc' ? -1 : 1
  const leftTime = Date.parse(left.updated_at ?? left.created_at)
  const rightTime = Date.parse(right.updated_at ?? right.created_at)

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && rightTime !== leftTime) {
    return (rightTime - leftTime) * directionFactor
  }

  if (right.created_at !== left.created_at) {
    return right.created_at.localeCompare(left.created_at) * directionFactor
  }

  return right.id.localeCompare(left.id) * directionFactor
}

async function getGuestbookMessages(
  limit: number,
  offset: number,
  archived: boolean,
  sortDirection: NoteSortDirection = 'desc',
  viewerIdentity?: string | null,
  searchQuery?: string | null,
  tagFilters: string[] = [],
) {
  const config = getNoteBoardConfig('guestbook')
  const normalizedQuery = searchQuery?.trim().toLocaleLowerCase() ?? ''
  const normalizedTags = tagFilters.map((t) => t.trim().toLocaleLowerCase()).filter(Boolean)
  const [thread, viewerState] = await Promise.all([
    getCommentThread(config.targetType, config.targetId, { archived }),
    viewerIdentity ? getCommentViewerState(config.targetType, config.targetId, viewerIdentity) : Promise.resolve([]),
  ])

  const mergedThread = viewerState.length > 0 ? applyViewerStateToComments(thread, viewerState) : thread

  return createGuestbookMessagesFromComments(mergedThread, archived)
    .filter((message) => {
      const lower = message.content.toLocaleLowerCase()
      if (normalizedQuery) return lower.includes(normalizedQuery)
      if (normalizedTags.length > 0) return normalizedTags.every((tag) => lower.includes(`#${tag}`))
      return true
    })
    .sort((left, right) => compareBoardMessageTime(left, right, sortDirection))
    .slice(offset, offset + limit)
}

function canWriteBoard(board: NoteBoardSlug, role: UserRole) {
  // Memo: any authenticated user (admin or regular user)
  // Guestbook: anyone including guests
  return board === 'guestbook' || role === 'admin' || role === 'user'
}

function normalizeRequesterIdentities(requesterIdentity?: string | string[] | null) {
  return (Array.isArray(requesterIdentity) ? requesterIdentity : [requesterIdentity]).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
}

function canDeleteBoardMessage(board: NoteBoardSlug, role: UserRole, noteAuthor: string, requesterIdentity?: string | string[] | null) {
  if (board === 'memo') {
    // Memo delete: admin always allowed; owner allowed via user_id check in caller
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
  visibility?: NoteVisibility
  due_at?: string | null
}

export { getNoteBoardConfig, isNoteBoardSlug }

async function batchFetchNoteCommentCounts(noteIds: string[]): Promise<Record<string, number>> {
  if (noteIds.length === 0) return {}

  const { data } = await supabaseAdmin
    .from('comments')
    .select('target_id')
    .eq('target_type', 'note')
    .in('target_id', noteIds)

  return (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.target_id as string
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

export const getBoardMessages = cache(async (
  board: NoteBoardSlug,
  limit = getNoteBoardConfig(board).initialPageLimit,
  offset = 0,
  archived = false,
  sort: NoteSortMode = 'time',
  sortDirection: NoteSortDirection = 'desc',
  viewerIdentity?: string | null,
  searchQuery?: string | null,
  tagFilters: string[] = [],
  ownerUserId?: string | null,
) => {
  const config = getNoteBoardConfig(board)

  if (board === 'guestbook') {
    return getGuestbookMessages(limit, offset, archived, sortDirection, viewerIdentity, searchQuery, tagFilters)
  }

  // Fall back to the public demo owner so unauthenticated visitors see the board
  const effectiveOwnerId = ownerUserId ?? process.env.MEMO_PUBLIC_OWNER_ID ?? null
  if (board === 'memo' && !effectiveOwnerId) {
    return []
  }

  const role = await getUserRole()
  const isAdmin = role === 'admin'

  // Guests viewing the demo always see only public notes, regardless of role
  const isOwner = ownerUserId != null
  const showAdminOnly = isAdmin && isOwner

  let query = supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id, upvotes, downvotes, visibility, due_at, notified_dues')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', archived)
    .is('parent_id', null)
    .eq('user_id', effectiveOwnerId!)
    .range(offset, offset + limit - 1)

  if (!showAdminOnly) {
    query = query.eq('visibility', 'public')
  }

  if (searchQuery?.trim()) {
    query = query.ilike('content', `%${searchQuery.trim()}%`)
  } else {
    for (const tag of tagFilters) {
      if (tag.trim()) query = query.ilike('content', `%#${tag.trim()}%`)
    }
  }

  if (sort === 'priority') {
    query = query.order('priority', { ascending: sortDirection === 'asc' })
  }

  const { data, error } = await query
    .order('updated_at', { ascending: sortDirection === 'asc' })
    .order('created_at', { ascending: sortDirection === 'asc' })
    .order('id', { ascending: sortDirection === 'asc' })

  if (error) {
    throw new Error(error.message)
  }

  const baseData = (data ?? []) as Array<Omit<NoteMessage, 'viewer_reaction' | 'emoji_reactions' | 'viewer_emojis'>>
  const noteIds = baseData.map((m) => m.id)

  // batchFetchNoteCommentCounts only needs noteIds (available now), so run it
  // in parallel with the reactions chain rather than after it.
  const [withReactions, commentCounts] = await Promise.all([
    attachViewerReactions(baseData, viewerIdentity),
    batchFetchNoteCommentCounts(noteIds),
  ])

  const messages = await attachViewerEmojiReactions(withReactions, viewerIdentity) as NoteMessage[]

  return messages.map((m) => ({ ...m, comment_count: commentCounts[m.id] ?? 0 }))
})

export async function createBoardMessage(board: NoteBoardSlug, author: string, content: string, priority?: NotePriority, visibility: NoteVisibility = 'public', dueAt?: string | null, userId?: string | null) {
  const config = getNoteBoardConfig(board)
  const role = await getUserRole()

  if (!canWriteBoard(board, role)) {
    throw new Error('FORBIDDEN')
  }

  // Memo requires an authenticated user identity
  if (board === 'memo' && !userId) {
    throw new Error('FORBIDDEN')
  }

  const nextPriority = priority ?? DEFAULT_NOTE_PRIORITY

  if (!isNotePriority(nextPriority)) {
    throw new Error('INVALID_PRIORITY')
  }

  const nextContent = content.trim()
  if (!nextContent) {
    throw new Error('MISSING_CONTENT')
  }

  if (nextContent.length > NOTE_MAX_LENGTH) {
    throw new Error('CONTENT_TOO_LONG')
  }

  // Non-admins cannot set admin_only visibility.
  const safeVisibility: NoteVisibility = visibility === 'admin_only' && role === 'admin' ? 'admin_only' : 'public'

  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      target_type: config.targetType,
      target_id: config.targetId,
      author: author.trim(),
      content: nextContent,
      priority: nextPriority,
      parent_id: null,
      visibility: safeVisibility,
      ...(userId ? { user_id: userId } : {}),
      ...(dueAt ? { due_at: dueAt } : {}),
    })
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id, upvotes, downvotes, visibility, due_at, notified_dues')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return {
    ...(data as Omit<NoteMessage, 'viewer_reaction' | 'emoji_reactions' | 'viewer_emojis'>),
    viewer_reaction: 0,
    emoji_reactions: [],
    viewer_emojis: [],
  } as NoteMessage
}

export async function updateBoardMessage(
  board: NoteBoardSlug,
  id: string,
  input: UpdateBoardMessageInput,
  requesterIdentity?: string | string[] | null,
) {
  const config = getNoteBoardConfig(board)
  const [role, currentUser] = await Promise.all([getUserRole(), getCurrentUser()])

  const { data: note, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('id, author, user_id, target_type, target_id')
    .eq('id', id)
    .single()

  if (fetchError || !note) {
    throw new Error('NOT_FOUND')
  }

  if (note.target_type !== config.targetType || note.target_id !== config.targetId) {
    throw new Error('NOT_FOUND')
  }

  if (board === 'memo') {
    // Memo: owner (matched by auth user_id) or admin
    const isOwner = currentUser?.id != null && currentUser.id === (note as { user_id?: string | null }).user_id
    if (role !== 'admin' && !isOwner) {
      throw new Error('FORBIDDEN')
    }
  } else if (!canEditBoardMessage(role, note.author, requesterIdentity)) {
    throw new Error('FORBIDDEN')
  }

  const patch: Record<string, string | boolean | number | null> = {}

  if (typeof input.content === 'string') {
    const content = input.content.trim()
    if (!content) {
      throw new Error('MISSING_CONTENT')
    }

    if (content.length > NOTE_MAX_LENGTH) {
      throw new Error('CONTENT_TOO_LONG')
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

  if (typeof input.visibility !== 'undefined') {
    // Non-admins cannot escalate to admin_only.
    patch.visibility = input.visibility === 'admin_only' && role === 'admin' ? 'admin_only' : 'public'
  }

  if ('due_at' in input) {
    patch.due_at = input.due_at ?? null
    patch.notified_at = null
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('MISSING_PATCH')
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update(patch)
    .eq('id', id)
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id, upvotes, downvotes, visibility, due_at, notified_dues')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'UPDATE_FAILED')
  }

  const [message] = await attachViewerEmojiReactions([
    {
      ...(data as Omit<NoteMessage, 'viewer_reaction' | 'emoji_reactions' | 'viewer_emojis'>),
      viewer_reaction: 0,
    },
  ])

  return message as NoteMessage
}

export async function deleteBoardMessage(
  board: NoteBoardSlug,
  id: string,
  requesterIdentity?: string | string[] | null,
) {
  const config = getNoteBoardConfig(board)
  const [role, currentUser] = await Promise.all([getUserRole(), getCurrentUser()])

  const { data: note, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('id, author, user_id, target_type, target_id')
    .eq('id', id)
    .single()

  if (fetchError || !note) {
    throw new Error('NOT_FOUND')
  }

  if (note.target_type !== config.targetType || note.target_id !== config.targetId) {
    throw new Error('NOT_FOUND')
  }

  if (board === 'memo') {
    // Memo: owner (matched by auth user_id) or admin
    const isOwner = currentUser?.id != null && currentUser.id === (note as { user_id?: string | null }).user_id
    if (role !== 'admin' && !isOwner) {
      throw new Error('FORBIDDEN')
    }
  } else if (!canDeleteBoardMessage(board, role, note.author, requesterIdentity)) {
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
