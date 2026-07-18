import React from 'react'
import { Target } from 'lucide-react'
import type { Project } from '@shared/types'
import { useStore } from '../../store/store'
import { openContextMenu } from '../../shared/ui/ContextMenu'

/**
 * «Сегодня написано» + цель дня в статус-баре редактора (ФАЗА 24).
 * Считает дельту слов всего проекта от начала дня; клик — меню целей.
 * Хранение: localStorage per-проект { date, baseline, goal }. Ничего не
 * всплывает само: при достижении цели счётчик просто подсвечивается.
 */

interface DayState {
  date: string
  baseline: number
  goal: number | null
}

const todayKey = (projectId: string): string => `fancreator.today.${projectId}`

const localDate = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const projectWords = (p: Project): number =>
  p.stories.reduce(
    (sum, story) =>
      story.deletedAt
        ? sum
        : sum + story.chapters.reduce((a, c) => a + (c.deletedAt ? 0 : c.wordCount || 0), 0),
    0
  )

function readState(projectId: string, words: number): DayState {
  const today = localDate()
  try {
    const raw = localStorage.getItem(todayKey(projectId))
    if (raw) {
      const s = JSON.parse(raw) as Partial<DayState>
      if (s.date === today && typeof s.baseline === 'number') {
        return { date: today, baseline: s.baseline, goal: s.goal ?? null }
      }
      // новый день: отсчёт заново, цель сохраняем
      return { date: today, baseline: words, goal: s.goal ?? null }
    }
  } catch {
    /* localStorage недоступен — работаем без памяти */
  }
  return { date: today, baseline: words, goal: null }
}

export function TodayWords(): React.JSX.Element | null {
  const { current } = useStore()
  const [state, setState] = React.useState<DayState | null>(null)

  const words = current ? projectWords(current) : 0

  const save = React.useCallback(
    (s: DayState): void => {
      setState(s)
      if (!current) return
      try {
        localStorage.setItem(todayKey(current.id), JSON.stringify(s))
      } catch {
        /* ignore */
      }
    },
    [current]
  )

  // инициализация при смене проекта
  React.useEffect(() => {
    if (!current) {
      setState(null)
      return
    }
    save(readState(current.id, projectWords(current)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  // полночь посреди сессии: начинаем новый день
  React.useEffect(() => {
    if (state && current && state.date !== localDate()) {
      save({ date: localDate(), baseline: words, goal: state.goal })
    }
  }, [state, current, words, save])

  if (!current || !state) return null

  const delta = words - state.baseline
  const goal = state.goal
  const done = goal != null && delta >= goal
  const sign = delta > 0 ? '+' : ''

  const openGoalMenu = (e: React.MouseEvent): void => {
    const goals = [300, 500, 1000, 2000]
    openContextMenu(e, [
      { type: 'label', label: 'Цель на день' },
      ...goals.map((g) => ({
        label: `${goal === g ? '✓ ' : ''}${g} слов`,
        onClick: () => save({ ...state, goal: g })
      })),
      {
        label: `${goal === null ? '✓ ' : ''}Без цели`,
        onClick: () => save({ ...state, goal: null })
      },
      { type: 'sep' as const },
      {
        label: 'Начать отсчёт дня заново',
        onClick: () => save({ ...state, baseline: words })
      }
    ])
  }

  return (
    <button
      className={`editor-today ${done ? 'editor-today--done' : ''}`}
      title={
        done
          ? 'Цель дня достигнута! 🎉 Клик — изменить цель'
          : 'Написано сегодня во всём проекте. Клик — задать цель дня'
      }
      onClick={openGoalMenu}
    >
      <Target size={12} />
      сегодня {sign}
      {delta}
      {goal != null ? ` / ${goal}` : ''}
    </button>
  )
}
