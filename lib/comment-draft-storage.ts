import type { CommentReplyTarget } from '@/lib/comments'

const STORAGE_PREFIX = 'comment-draft:v1'

type ComposerDraftPayload = {
  draft: string
  replyTo: CommentReplyTarget | null
}

type EditDraftPayload = {
  draft: string
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function parseStoredJson<T>(value: string | null) {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function getComposerStorageKey(targetType: string, targetId: string) {
  return `${STORAGE_PREFIX}:${targetType}:${targetId}:composer`
}

function getEditStorageKey(targetType: string, targetId: string, commentId: string) {
  return `${STORAGE_PREFIX}:${targetType}:${targetId}:edit:${commentId}`
}

export function loadCommentComposerDraft(targetType: string, targetId: string): ComposerDraftPayload | null {
  if (!canUseStorage()) {
    return null
  }

  return parseStoredJson<ComposerDraftPayload>(window.localStorage.getItem(getComposerStorageKey(targetType, targetId)))
}

export function saveCommentComposerDraft(targetType: string, targetId: string, draft: string, replyTo: CommentReplyTarget | null) {
  if (!canUseStorage()) {
    return
  }

  const storageKey = getComposerStorageKey(targetType, targetId)
  if (!draft && !replyTo) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify({ draft, replyTo } satisfies ComposerDraftPayload))
}

export function clearCommentComposerDraft(targetType: string, targetId: string) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(getComposerStorageKey(targetType, targetId))
}

export function loadCommentEditDraft(targetType: string, targetId: string, commentId: string) {
  if (!canUseStorage()) {
    return null
  }

  const payload = parseStoredJson<EditDraftPayload>(window.localStorage.getItem(getEditStorageKey(targetType, targetId, commentId)))
  return payload?.draft ?? null
}

export function saveCommentEditDraft(targetType: string, targetId: string, commentId: string, draft: string, sourceContent: string) {
  if (!canUseStorage()) {
    return
  }

  const storageKey = getEditStorageKey(targetType, targetId, commentId)
  if (draft === sourceContent) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify({ draft } satisfies EditDraftPayload))
}

export function clearCommentEditDraft(targetType: string, targetId: string, commentId: string) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(getEditStorageKey(targetType, targetId, commentId))
}