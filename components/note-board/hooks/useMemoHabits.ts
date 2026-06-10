'use client'

// All memo-habit orchestration for the board page: the agenda + habit-overview
// SWR fetches, agenda enrichment from live habit state, the Shanghai-midnight
// refetch, and the detail-panel selection/actions (complete / delay / delete).
// Extracted from NoteBoardExperience.tsx so the page component only wires views.
// No-op (null data, inert handlers) for non-memo boards — pass `enabled: false`.

import useSWR from 'swr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MemoHabitItemDetail, MemoHabitOverview } from '@/lib/memo-habits'
import type { MemoAgendaItem } from '@/lib/note-boards'
import { getMsUntilNextShanghaiMidnight, getShanghaiTimeKey, toShanghaiDateKey } from '@/lib/shanghai-time'

export interface SelectedHabit {
  noteId: string
  itemKey: string
  source?: 'sidebar' | 'note'
  anchorPos?: { x: number; y: number }
}

const jsonFetcher = (url: string) => fetch(url).then((r) => r.json())

export function useMemoHabits({ enabled }: { enabled: boolean }) {
  const { data: agendaItems, mutate: mutateAgendaItems } = useSWR<MemoAgendaItem[]>(
    enabled ? '/api/note-boards/memo/agenda' : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  const { data: habitOverview, mutate: mutateHabitOverview } = useSWR<MemoHabitOverview>(
    enabled ? '/api/note-boards/memo/habits/overview' : null,
    jsonFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  )

  // Enrich agenda items from live habit state: when a repeating task is completed
  // today, keep the completion visual pinned to today's slot until Shanghai midnight
  // (instead of immediately striking through tomorrow's next occurrence slot).
  const enrichedAgendaItems = useMemo(() => {
    if (!agendaItems) return agendaItems
    const states = habitOverview?.currentStates
    if (!states) return agendaItems
    const todayKey = toShanghaiDateKey(new Date())

    return agendaItems.map((item) => {
      if (!item.repeatMode) return item
      const noteStates = states[item.memoId]
      if (!noteStates) return item

      const allStates = Object.values(noteStates)
      const itemTimeKey = getShanghaiTimeKey(item.dueAt)

      // Case 1: completed today — keep the dot pinned to today until Shanghai midnight
      const completedStates = allStates.filter((state) => state.status === 'completed')
      const matchedCompleted = completedStates.find(
        (state) => state.label === item.label && getShanghaiTimeKey(state.dueAt) === itemTimeKey,
      ) ?? completedStates.find((state) => state.label === item.label)

      if (matchedCompleted && toShanghaiDateKey(matchedCompleted.dueAt) === todayKey) {
        return { ...item, dueAt: matchedCompleted.dueAt, isNotified: true }
      }

      // Case 2: a pending/scheduled/delayed occurrence exists on a different day than
      // the @due tag (e.g. user postponed to 6.1 but the cron already advanced the tag
      // to 6.2). Show the dot on the actual occurrence date so the calendar is correct.
      const openStates = allStates.filter(
        (state) => state.status === 'pending' || state.status === 'scheduled' || state.status === 'delayed',
      )
      const matchedOpen = openStates.find(
        (state) => state.label === item.label && getShanghaiTimeKey(state.dueAt) === itemTimeKey,
      ) ?? openStates.find((state) => state.label === item.label)

      // Only apply the date override when the state comes from a real DB occurrence
      // row (not a synthesised virtual-today state). A synthesised state always has
      // dueAt=today even when the @due tag is in the future, which would
      // incorrectly pull a normally-planned future task into today's schedule.
      // Also guard against stale past-date rows that the reconciler hasn't cleaned
      // up yet: never move an item backwards onto a historical date.
      if (matchedOpen && !matchedOpen.synthetic) {
        const openDateKey = toShanghaiDateKey(matchedOpen.dueAt)
        if (openDateKey !== toShanghaiDateKey(item.dueAt) && openDateKey >= todayKey) {
          return { ...item, dueAt: matchedOpen.dueAt }
        }
      }

      return item
    })
  }, [agendaItems, habitOverview])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let timer: ReturnType<typeof setTimeout> | null = null

    const scheduleMidnightRefresh = () => {
      timer = setTimeout(() => {
        void Promise.all([mutateHabitOverview(), mutateAgendaItems()])
        scheduleMidnightRefresh()
      }, getMsUntilNextShanghaiMidnight())
    }

    scheduleMidnightRefresh()

    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [enabled, mutateAgendaItems, mutateHabitOverview])

  // Track the last pointer-down position so the detail panel can anchor itself
  // next to whatever badge/checkbox the user clicked.
  const lastClickPos = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      lastClickPos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  const [selectedHabit, setSelectedHabit] = useState<SelectedHabit | null>(null)
  const selectedHabitKey = selectedHabit
    ? `/api/note-boards/memo/habits/item?note_id=${encodeURIComponent(selectedHabit.noteId)}&item_key=${encodeURIComponent(selectedHabit.itemKey)}`
    : null
  const { data: selectedHabitDetail, mutate: mutateSelectedHabitDetail, isLoading: isHabitDetailLoading } = useSWR<MemoHabitItemDetail>(
    selectedHabitKey,
    jsonFetcher,
    { revalidateOnFocus: false },
  )

  const openHabitDetail = useCallback((noteId: string, itemKey: string, source?: 'sidebar' | 'note') => {
    setSelectedHabit({ noteId, itemKey, source, anchorPos: lastClickPos.current ?? undefined })
  }, [])

  const closeHabitDetail = useCallback(() => {
    setSelectedHabit(null)
  }, [])

  const handleCompleteHabit = useCallback(async () => {
    if (!selectedHabit) return
    const response = await fetch('/api/note-boards/memo/habits/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: selectedHabit.noteId, item_key: selectedHabit.itemKey }),
    })
    if (!response.ok) return
    const detail = await response.json() as MemoHabitItemDetail
    await Promise.all([
      mutateSelectedHabitDetail(detail, { revalidate: false }),
      mutateHabitOverview(),
    ])
  }, [mutateHabitOverview, mutateSelectedHabitDetail, selectedHabit])

  // Completes a habit occurrence directly from the checklist checkbox, without
  // opening the detail panel.  The detail panel's "记为完成" button uses
  // handleCompleteHabit above (which also refreshes the panel state).
  const handleCompleteHabitItem = useCallback(async (noteId: string, itemKey: string) => {
    const nowIso = new Date().toISOString()
    // Optimistic update: immediately show the item as completed in the UI so
    // the checkbox animates right away without waiting for the round-trip.
    await mutateHabitOverview((current) => {
      if (!current) return current
      const noteStates = current.currentStates[noteId]
      if (!noteStates?.[itemKey]) return current
      return {
        ...current,
        currentStates: {
          ...current.currentStates,
          [noteId]: {
            ...noteStates,
            [itemKey]: {
              ...noteStates[itemKey],
              status: 'completed' as const,
              completedAt: nowIso,
              completionSource: 'manual_check' as const,
            },
          },
        },
      }
    }, { revalidate: false })

    const response = await fetch('/api/note-boards/memo/habits/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: noteId, item_key: itemKey }),
    })
    if (!response.ok) {
      // Revert the optimistic update by re-fetching the real state.
      await mutateHabitOverview()
      return
    }
    const mutations: Promise<unknown>[] = [mutateHabitOverview()]
    // If the detail panel for this item is open, refresh it too.
    if (selectedHabit?.noteId === noteId && selectedHabit?.itemKey === itemKey) {
      mutations.push(mutateSelectedHabitDetail())
    }
    await Promise.all(mutations)
  }, [mutateHabitOverview, mutateSelectedHabitDetail, selectedHabit])

  const handleDelayHabit = useCallback(async (delayUntil: string) => {
    if (!selectedHabit) return
    const response = await fetch('/api/note-boards/memo/habits/delay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: selectedHabit.noteId, item_key: selectedHabit.itemKey, delay_until: delayUntil }),
    })
    if (!response.ok) return
    const detail = await response.json() as MemoHabitItemDetail
    await Promise.all([
      mutateSelectedHabitDetail(detail, { revalidate: false }),
      mutateHabitOverview(),
    ])
  }, [mutateHabitOverview, mutateSelectedHabitDetail, selectedHabit])

  const handleDeleteOccurrence = useCallback(async (occurrenceId: string) => {
    const response = await fetch(`/api/note-boards/memo/habits/occurrence/${encodeURIComponent(occurrenceId)}`, {
      method: 'DELETE',
    })
    if (!response.ok) return
    await Promise.all([mutateSelectedHabitDetail(), mutateHabitOverview()])
  }, [mutateHabitOverview, mutateSelectedHabitDetail])

  return {
    agendaItems: enrichedAgendaItems,
    habitOverview,
    selectedHabit,
    selectedHabitDetail,
    isHabitDetailLoading,
    openHabitDetail,
    closeHabitDetail,
    handleCompleteHabit,
    handleCompleteHabitItem,
    handleDelayHabit,
    handleDeleteOccurrence,
  }
}
