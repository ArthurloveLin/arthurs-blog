'use client'

import { useEffect, useState } from 'react'
import EmojiReactionSummary from '@/components/emoji/EmojiReactionSummary'
import ReactionToggleBar from '@/components/ReactionToggleBar'
import { useAuth } from '@/components/AuthProvider'
import type { PostReactionSummary } from '@/lib/post-reactions'

interface ArticleEngagementPanelProps {
  postId: string
  initialSummary: PostReactionSummary
}

function applyOptimisticReaction(summary: PostReactionSummary, nextReaction: 1 | -1 | 0): PostReactionSummary {
  let upvotes = summary.upvotes
  let downvotes = summary.downvotes

  if (summary.viewer_reaction === 1) {
    upvotes = Math.max(0, upvotes - 1)
  } else if (summary.viewer_reaction === -1) {
    downvotes = Math.max(0, downvotes - 1)
  }

  if (nextReaction === 1) {
    upvotes += 1
  } else if (nextReaction === -1) {
    downvotes += 1
  }

  return {
    ...summary,
    upvotes,
    downvotes,
    viewer_reaction: nextReaction,
  }
}

function applyOptimisticEmoji(summary: PostReactionSummary, nextEmoji: string): PostReactionSummary {
  const viewerEmojiSet = new Set(summary.viewer_emojis)
  const removingEmoji = viewerEmojiSet.has(nextEmoji)
  const summaryMap = new Map(summary.emoji_reactions.map((entry) => [entry.emoji, { ...entry }]))

  if (removingEmoji) {
    viewerEmojiSet.delete(nextEmoji)
    const previous = summaryMap.get(nextEmoji)
    if (previous) {
      const nextCount = previous.count - 1
      if (nextCount > 0) {
        summaryMap.set(nextEmoji, { ...previous, count: nextCount, viewer: false })
      } else {
        summaryMap.delete(nextEmoji)
      }
    }
  } else {
    viewerEmojiSet.add(nextEmoji)
    const current = summaryMap.get(nextEmoji)
    summaryMap.set(nextEmoji, {
      emoji: nextEmoji,
      count: (current?.count ?? 0) + 1,
      viewer: true,
    })
  }

  return {
    ...summary,
    viewer_emojis: [...viewerEmojiSet].sort((left, right) => left.localeCompare(right)),
    emoji_reactions: [...summaryMap.values()].sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      if (left.viewer !== right.viewer) {
        return Number(right.viewer) - Number(left.viewer)
      }

      return left.emoji.localeCompare(right.emoji)
    }),
  }
}

export default function ArticleEngagementPanel({ postId, initialSummary }: ArticleEngagementPanelProps) {
  const { identity } = useAuth()
  const [summary, setSummary] = useState(initialSummary)
  const [pendingReaction, setPendingReaction] = useState(false)
  const [pendingEmoji, setPendingEmoji] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSummary() {
      const response = await fetch(`/api/posts/${postId}/engagement?identity=${encodeURIComponent(identity)}`)
      if (!response.ok) {
        return
      }

      const nextSummary = await response.json() as PostReactionSummary
      if (!cancelled) {
        setSummary(nextSummary)
      }
    }

    if (identity) {
      void loadSummary()
    }

    return () => {
      cancelled = true
    }
  }, [identity, postId])

  async function handleReaction(value: 1 | -1) {
    if (!identity || pendingReaction) {
      return
    }

    const snapshot = summary
    const nextReaction = summary.viewer_reaction === value ? 0 : value
    setPendingReaction(true)
    setSummary((current) => applyOptimisticReaction(current, nextReaction))

    try {
      const response = await fetch(`/api/posts/${postId}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, reaction: nextReaction }),
      })

      if (!response.ok) {
        throw new Error('互动更新失败。')
      }

      const nextSummary = await response.json() as Pick<PostReactionSummary, 'upvotes' | 'downvotes' | 'viewer_reaction'>
      setSummary((current) => ({ ...current, ...nextSummary }))
    } catch {
      setSummary(snapshot)
    } finally {
      setPendingReaction(false)
    }
  }

  async function handleEmojiReaction(emoji: string) {
    if (!identity || pendingEmoji) {
      return
    }

    const snapshot = summary
    setPendingEmoji(true)
    setSummary((current) => applyOptimisticEmoji(current, emoji))

    try {
      const response = await fetch(`/api/posts/${postId}/emoji`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, emoji }),
      })

      if (!response.ok) {
        throw new Error('表情互动更新失败。')
      }

      const nextSummary = await response.json() as PostReactionSummary
      setSummary(nextSummary)
    } catch {
      setSummary(snapshot)
    } finally {
      setPendingEmoji(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-black/8 bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.18),transparent_38%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-4 py-6 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.38)] md:px-6 md:py-7">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.78),transparent_72%)] blur-2xl" />
      <div className="relative flex flex-col items-center justify-center gap-5">
        <div className="flex w-full justify-center">
          <ReactionToggleBar
            upvotes={summary.upvotes}
            downvotes={summary.downvotes}
            viewerReaction={summary.viewer_reaction}
            pending={pendingReaction}
            onReact={handleReaction}
            onEmojiReact={handleEmojiReaction}
            viewerEmojis={summary.viewer_emojis}
            emojiPending={pendingEmoji}
            emphasis="hero"
            className="justify-center"
          />
        </div>

        <EmojiReactionSummary
          entries={summary.emoji_reactions}
          onSelect={handleEmojiReaction}
          className="justify-center"
        />
      </div>
    </section>
  )
}