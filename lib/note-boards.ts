import { cache } from 'react'
import { attachViewerEmojiReactions, type EmojiReactionEntry } from '@/lib/comment-emojis'
import { attachViewerReactions, type ReactionValue } from '@/lib/comment-reactions'
import { applyViewerStateToComments, type CommentSyncState } from '@/lib/comments'
import { getCommentThread, getCommentViewerState } from '@/lib/comments-server'
import { createGuestbookMessagesFromComments } from '@/lib/guestbook-comments'
import {
  DEFAULT_NOTE_PRIORITY,
  isNotePriority,
  normalizeNotePriority,
  type NotePriority,
  type NoteSortDirection,
  type NoteSortMode,
} from '@/lib/note-priority'
import { getCurrentUser, getUserRole, type UserRole } from '@/lib/auth'
import { getNoteBoardConfig, isNoteBoardSlug, type NoteBoardSlug } from '@/lib/note-board-config'
import { NOTE_MAX_LENGTH } from '@/lib/input-limits'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type NoteVisibility = 'public' | 'admin_only'

export interface MemoReminder {
  id: string
  memo_id: string
  label: string
  due_at: string
  repeat_mode: string
  repeat_days?: number[] | null
  notified_at?: string | null
  created_at: string
}

export interface PendingReminder {
  tempId: string
  label: string
  due_at: string
  repeat_mode: string
  repeat_days?: number[] | null
}

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
  repeat_mode?: string | null
  repeat_days?: number[] | null
  reminders?: MemoReminder[]
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
      if (normalizedQuery) {
        const tokens = normalizedQuery.split(/[\s　]+/).filter(Boolean)
        return tokens.every((token) => lower.includes(token))
      }
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
  repeat_mode?: string | null
  repeat_days?: number[] | null
}

function toShanghaiDateKey(ts: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ts))
  const y = parts.find((p) => p.type === 'year')?.value ?? '0'
  const m = parts.find((p) => p.type === 'month')?.value ?? '00'
  const d = parts.find((p) => p.type === 'day')?.value ?? '00'
  return `${y}-${m}-${d}`
}

export const getMemoDateCounts = cache(async (ownerUserId: string, showAdminOnly = false) => {
  const config = getNoteBoardConfig('memo')
  let query = supabaseAdmin
    .from('comments')
    .select('updated_at, created_at')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', false)
    .is('parent_id', null)
    .eq('user_id', ownerUserId)

  if (!showAdminOnly) {
    query = query.eq('visibility', 'public')
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const ts = (row.updated_at ?? row.created_at) as string
    const key = toShanghaiDateKey(ts)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }))
})

const HASHTAG_RE = /#([\p{L}\p{N}_-]+)/gu

export const getMemoTagCounts = cache(async (ownerUserId: string, showAdminOnly = false) => {
  const config = getNoteBoardConfig('memo')
  let query = supabaseAdmin
    .from('comments')
    .select('content')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', false)
    .is('parent_id', null)
    .eq('user_id', ownerUserId)

  if (!showAdminOnly) {
    query = query.eq('visibility', 'public')
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    HASHTAG_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = HASHTAG_RE.exec(row.content as string)) !== null) {
      const tag = match[1].toLowerCase()
      if (tag.length > 0 && tag.length <= 32) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
      HASHTAG_RE.lastIndex = match.index + 1
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})

export type MemoAgendaItem = { memoId: string; dueAt: string; label: string; priority: NotePriority }

const INLINE_DUE_RE = /@due\[([^\]]*)\]\(([^)]*)\)/g

function extractContentLabel(content: string): string {
  const line = (content.split('\n').find((l) => l.trim().length > 0) ?? '').trim()
  const cleaned = line
    .replace(/@due\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/[*_`]/g, '')
    .trim()
  return cleaned.slice(0, 22) || '截止'
}

export const getMemoAgendaItems = cache(async (ownerUserId: string, showAdminOnly = false) => {
  const config = getNoteBoardConfig('memo')

  // Inline @due[label](iso) tags
  let inlineQuery = supabaseAdmin
    .from('comments')
    .select('id, content, priority')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', false)
    .is('parent_id', null)
    .eq('user_id', ownerUserId)
    .ilike('content', '%@due[%')
  if (!showAdminOnly) inlineQuery = inlineQuery.eq('visibility', 'public')

  // due_at column (one-time unnotified + all recurring)
  let columnQuery = supabaseAdmin
    .from('comments')
    .select('id, content, priority, due_at, repeat_mode')
    .eq('target_type', config.targetType)
    .eq('target_id', config.targetId)
    .eq('archived', false)
    .is('parent_id', null)
    .eq('user_id', ownerUserId)
    .not('due_at', 'is', null)
  if (!showAdminOnly) columnQuery = columnQuery.eq('visibility', 'public')

  // memo_reminders table (primary path)
  let remindersQuery = supabaseAdmin
    .from('memo_reminders')
    .select('id, label, due_at, repeat_mode, comments!inner(id, priority, user_id, archived, visibility)')
    .eq('comments.user_id', ownerUserId)
    .eq('comments.archived', false)
    .is('notified_at', null)
  if (!showAdminOnly) remindersQuery = remindersQuery.eq('comments.visibility', 'public')

  const [
    { data: inlineData, error: inlineError },
    { data: columnData, error: columnError },
    { data: remindersData, error: remindersError },
  ] = await Promise.all([inlineQuery, columnQuery, remindersQuery])

  if (inlineError) throw new Error(inlineError.message)
  if (columnError) throw new Error(columnError.message)
  if (remindersError) throw new Error(remindersError.message)

  const items: MemoAgendaItem[] = []
  const seenMemoIds = new Set<string>()

  // Primary: memo_reminders table entries
  for (const row of remindersData ?? []) {
    const comment = Array.isArray(row.comments) ? row.comments[0] : row.comments as { id: string; priority: unknown } | null
    if (!comment) continue
    const memoId = (comment as { id: string }).id
    const dueAt = row.due_at as string
    const repeatMode = (row.repeat_mode as string | null) ?? 'once'
    if (repeatMode === 'once' && Date.parse(dueAt) <= Date.now()) continue
    items.push({
      memoId,
      dueAt,
      label: (row.label as string) || '提醒',
      priority: normalizeNotePriority((comment as { priority: unknown }).priority),
    })
    seenMemoIds.add(memoId)
  }

  // Legacy: inline @due tags in content
  for (const row of inlineData ?? []) {
    INLINE_DUE_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = INLINE_DUE_RE.exec(row.content as string)) !== null) {
      const label = match[1].trim() || '截止'
      const iso = match[2]
      if (iso && !isNaN(Date.parse(iso))) {
        items.push({ memoId: row.id as string, dueAt: iso, label, priority: normalizeNotePriority(row.priority) })
      }
    }
  }

  // Legacy: column-based due_at
  for (const row of columnData ?? []) {
    if (seenMemoIds.has(row.id as string)) continue
    const repeatMode = (row.repeat_mode as string | null) ?? 'once'
    const dueAt = row.due_at as string
    if (repeatMode === 'once' && Date.parse(dueAt) <= Date.now()) continue
    items.push({
      memoId: row.id as string,
      dueAt,
      label: extractContentLabel(row.content as string),
      priority: normalizeNotePriority(row.priority),
    })
  }

  return items
})

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
  dateFilter?: string | null,
  dueDateFilter?: string | null,
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
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id, upvotes, downvotes, visibility, due_at, notified_dues, repeat_mode, repeat_days, memo_reminders(*)')
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
    const tokens = searchQuery.trim().split(/[\s　]+/).filter(Boolean)
    for (const token of tokens) {
      query = query.ilike('content', `%${token}%`)
    }
  } else {
    for (const tag of tagFilters) {
      if (tag.trim()) query = query.ilike('content', `%#${tag.trim()}%`)
    }
    if (dateFilter) {
      const startUtc = new Date(`${dateFilter}T00:00:00+08:00`).toISOString()
      const nextDay = new Date(`${dateFilter}T00:00:00+08:00`)
      nextDay.setDate(nextDay.getDate() + 1)
      query = query.gte('updated_at', startUtc).lt('updated_at', nextDay.toISOString())
    }
    if (dueDateFilter) {
      const startUtc = new Date(`${dueDateFilter}T00:00:00+08:00`).toISOString()
      const nextDay = new Date(`${dueDateFilter}T00:00:00+08:00`)
      nextDay.setDate(nextDay.getDate() + 1)
      query = query.gte('due_at', startUtc).lt('due_at', nextDay.toISOString())
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

export async function createBoardMessage(board: NoteBoardSlug, author: string, content: string, priority?: NotePriority, visibility: NoteVisibility = 'public', dueAt?: string | null, userId?: string | null, repeatMode?: string | null, repeatDays?: number[] | null) {
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
      ...(repeatMode && repeatMode !== 'once' ? { repeat_mode: repeatMode } : {}),
      ...(repeatDays?.length ? { repeat_days: repeatDays } : {}),
    })
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id, upvotes, downvotes, visibility, due_at, notified_dues, repeat_mode, repeat_days, memo_reminders(*)')
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

  const patch: Record<string, string | boolean | number | number[] | null> = {}

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

  if ('repeat_mode' in input) {
    patch.repeat_mode = input.repeat_mode ?? 'once'
  }

  if ('repeat_days' in input) {
    patch.repeat_days = input.repeat_days?.length ? input.repeat_days : null
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('MISSING_PATCH')
  }

  const { data, error } = await supabaseAdmin
    .from('comments')
    .update(patch)
    .eq('id', id)
    .select('id, author, content, created_at, updated_at, priority, archived, parent_id, upvotes, downvotes, visibility, due_at, notified_dues, repeat_mode, repeat_days, memo_reminders(*)')
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
