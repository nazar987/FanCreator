import React from 'react'
import { Timer } from 'lucide-react'
import type { Project } from '@shared/types'
import { useStore } from '../../store/store'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { recordSprintCompleted } from '../achievements/achievements'

interface SprintState {
  startedAt: number
  endAt: number
  durationMinutes: number
  baselineWords: number
}

interface SprintSummary {
  durationMinutes: number
  words: number
  completedAt: number
}

interface StoredSprint {
  active?: SprintState
  summary?: SprintSummary
}

interface WritingSprintProps {
  storyId: string
  chapterId: string
  wordCount: number
}

const storageKey = (projectId: string): string => `fancreator.sprint.${projectId}`

function projectWords(
  project: Project,
  storyId: string,
  chapterId: string,
  liveChapterWords: number
): number {
  return project.stories.reduce((total, story) => {
    if (story.deletedAt) return total
    return total + story.chapters.reduce((sum, chapter) => {
      if (chapter.deletedAt) return sum
      return sum + (
        story.id === storyId && chapter.id === chapterId
          ? liveChapterWords
          : chapter.wordCount || 0
      )
    }, 0)
  }, 0)
}

function readStored(projectId: string): StoredSprint {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? '{}') as StoredSprint
    const active = parsed.active
    const summary = parsed.summary
    return {
      active:
        active &&
        Number.isFinite(active.startedAt) &&
        Number.isFinite(active.endAt) &&
        Number.isFinite(active.durationMinutes) &&
        Number.isFinite(active.baselineWords)
          ? active
          : undefined,
      summary:
        summary &&
        Number.isFinite(summary.durationMinutes) &&
        Number.isFinite(summary.words) &&
        Number.isFinite(summary.completedAt)
          ? summary
          : undefined
    }
  } catch {
    return {}
  }
}

function writeStored(projectId: string, value: StoredSprint): void {
  try {
    if (!value.active && !value.summary) localStorage.removeItem(storageKey(projectId))
    else localStorage.setItem(storageKey(projectId), JSON.stringify(value))
  } catch {
    /* Таймер продолжает работать в памяти, если localStorage недоступен. */
  }
}

const signedWords = (words: number): string => `${words >= 0 ? '+' : ''}${words}`

export function WritingSprint({
  storyId,
  chapterId,
  wordCount
}: WritingSprintProps): React.JSX.Element | null {
  const { current } = useStore()
  const [active, setActive] = React.useState<SprintState | null>(null)
  const [summary, setSummary] = React.useState<SprintSummary | null>(null)
  const [clock, setClock] = React.useState(Date.now())
  const completedRef = React.useRef<number | null>(null)

  const projectId = current?.id ?? ''
  const words = current ? projectWords(current, storyId, chapterId, wordCount) : 0

  React.useEffect(() => {
    if (!projectId) {
      setActive(null)
      setSummary(null)
      return
    }
    const stored = readStored(projectId)
    setActive(stored.active ?? null)
    setSummary(stored.summary ?? null)
    completedRef.current = null
    setClock(Date.now())
  }, [projectId])

  React.useEffect(() => {
    if (!active) return
    setClock(Date.now())
    const timer = window.setInterval(() => setClock(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [active])

  React.useEffect(() => {
    if (!active || clock < active.endAt || !projectId) return
    if (completedRef.current === active.startedAt) return
    completedRef.current = active.startedAt
    const nextSummary: SprintSummary = {
      durationMinutes: active.durationMinutes,
      words: words - active.baselineWords,
      completedAt: Date.now()
    }
    setActive(null)
    setSummary(nextSummary)
    writeStored(projectId, { summary: nextSummary })
    recordSprintCompleted()
  }, [active, clock, projectId, words])

  if (!current) return null

  const start = (durationMinutes: number): void => {
    const startedAt = Date.now()
    const next: SprintState = {
      startedAt,
      endAt: startedAt + durationMinutes * 60_000,
      durationMinutes,
      baselineWords: words
    }
    completedRef.current = null
    setActive(next)
    setSummary(null)
    setClock(startedAt)
    writeStored(projectId, { active: next })
  }

  const stop = (): void => {
    setActive(null)
    setSummary(null)
    writeStored(projectId, {})
  }

  const openSprintMenu = (event: React.MouseEvent): void => {
    if (active) {
      openContextMenu(event, [
        { type: 'label', label: `Спринт на ${active.durationMinutes} минут` },
        { label: 'Остановить', danger: true, onClick: stop }
      ])
      return
    }
    openContextMenu(event, [
      { type: 'label', label: 'Начать спринт' },
      ...[15, 25, 45].map((minutes) => ({
        label: `${minutes} минут`,
        onClick: () => start(minutes)
      }))
    ])
  }

  if (summary) {
    return (
      <button
        className="editor-sprint editor-sprint--summary"
        title="Закрыть итог спринта"
        onClick={() => {
          setSummary(null)
          writeStored(projectId, {})
        }}
      >
        <Timer size={12} />
        Спринт: {signedWords(summary.words)} слов за {summary.durationMinutes} мин
      </button>
    )
  }

  if (!active) {
    return (
      <button className="editor-sprint" title="Начать спринт письма" onClick={openSprintMenu}>
        <Timer size={12} />
        Спринт
      </button>
    )
  }

  const secondsLeft = Math.max(0, Math.ceil((active.endAt - clock) / 1000))
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const delta = words - active.baselineWords

  return (
    <button
      className="editor-sprint editor-sprint--active"
      title="Спринт идёт. Клик — остановить"
      onClick={openSprintMenu}
    >
      <Timer size={12} />
      {minutes}:{String(seconds).padStart(2, '0')} · {signedWords(delta)} слов
    </button>
  )
}
