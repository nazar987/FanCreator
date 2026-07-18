import type { Project } from '@shared/types'

export type AchievementId =
  | 'words-1000'
  | 'words-10000'
  | 'words-50000'
  | 'chapter-first'
  | 'chapters-10'
  | 'board-first'
  | 'tree-first'
  | 'character-first'
  | 'characters-10'
  | 'daily-goal-first'
  | 'daily-goals-5'
  | 'sprint-first'

export interface AchievementDefinition {
  id: AchievementId
  title: string
  hint: string
}

export type AchievementMap = Partial<Record<AchievementId, string>>

export const ACHIEVEMENTS_STORAGE_KEY = 'fancreator.achievements'
export const ACHIEVEMENTS_CHANGED_EVENT = 'fancreator:achievements-changed'

const DAILY_GOALS_STORAGE_KEY = 'fancreator.achievement-goal-days'

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'words-1000', title: 'Первые 1 000 слов', hint: 'Напишите 1 000 слов в одном проекте.' },
  { id: 'words-10000', title: 'Первые 10 000 слов', hint: 'Напишите 10 000 слов в одном проекте.' },
  { id: 'words-50000', title: 'Первые 50 000 слов', hint: 'Закончите дистанцию небольшого романа.' },
  { id: 'chapter-first', title: 'Первая глава', hint: 'Создайте первую главу истории.' },
  { id: 'chapters-10', title: '10 глав', hint: 'Соберите в проекте десять глав.' },
  { id: 'board-first', title: 'Первая доска', hint: 'Создайте доску для заметок и связей.' },
  { id: 'tree-first', title: 'Первое дерево', hint: 'Создайте дерево идей или событий.' },
  { id: 'character-first', title: 'Первый персонаж', hint: 'Добавьте первого героя проекта.' },
  { id: 'characters-10', title: '10 персонажей', hint: 'Соберите состав из десяти персонажей.' },
  { id: 'daily-goal-first', title: 'Цель дня достигнута', hint: 'Выполните установленную цель дня.' },
  { id: 'daily-goals-5', title: '5 целей дня', hint: 'Выполните цель дня пять раз.' },
  { id: 'sprint-first', title: 'Первый спринт', hint: 'Завершите один писательский спринт.' }
]

const byId = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]))
let memoryAchievements: AchievementMap = {}
let memoryGoalDays = new Set<string>()
const listeners = new Set<(achievements: AchievementDefinition[]) => void>()
const pendingNotifications: AchievementDefinition[] = []

export function readAchievements(): AchievementMap {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY) ?? '{}') as Record<
      string,
      unknown
    >
    const stored: AchievementMap = {}
    for (const achievement of ACHIEVEMENTS) {
      const earnedAt = parsed[achievement.id]
      if (typeof earnedAt === 'string') stored[achievement.id] = earnedAt
    }
    memoryAchievements = stored
  } catch {
    /* Используем память текущей сессии. */
  }
  return { ...memoryAchievements }
}

function notifyUnlocked(unlocked: AchievementDefinition[]): void {
  if (!unlocked.length) return
  if (listeners.size) listeners.forEach((listener) => listener(unlocked))
  else pendingNotifications.push(...unlocked)
  window.dispatchEvent(new Event(ACHIEVEMENTS_CHANGED_EVENT))
}

export function subscribeAchievementUnlocks(
  listener: (achievements: AchievementDefinition[]) => void
): () => void {
  listeners.add(listener)
  if (pendingNotifications.length) listener(pendingNotifications.splice(0))
  return () => listeners.delete(listener)
}

export function unlockAchievements(ids: readonly AchievementId[]): AchievementDefinition[] {
  const earned = readAchievements()
  const unlocked: AchievementDefinition[] = []
  const earnedAt = new Date().toISOString()

  for (const id of ids) {
    if (earned[id]) continue
    const definition = byId.get(id)
    if (!definition) continue
    earned[id] = earnedAt
    unlocked.push(definition)
  }
  if (!unlocked.length) return []

  memoryAchievements = earned
  try {
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(earned))
  } catch {
    /* Награды останутся в памяти до закрытия приложения. */
  }
  notifyUnlocked(unlocked)
  return unlocked
}

export function evaluateProjectAchievements(project: Project): void {
  const activeStories = project.stories.filter((story) => !story.deletedAt)
  const chapters = activeStories.flatMap((story) =>
    story.chapters.filter((chapter) => !chapter.deletedAt)
  )
  const words = chapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0)
  const ids: AchievementId[] = []

  if (words >= 1_000) ids.push('words-1000')
  if (words >= 10_000) ids.push('words-10000')
  if (words >= 50_000) ids.push('words-50000')
  if (chapters.length >= 1) ids.push('chapter-first')
  if (chapters.length >= 10) ids.push('chapters-10')
  if (project.boards.length >= 1) ids.push('board-first')
  if ((project.hierarchies ?? []).length >= 1) ids.push('tree-first')
  if (project.characters.length >= 1) ids.push('character-first')
  if (project.characters.length >= 10) ids.push('characters-10')

  unlockAchievements(ids)
}

function readGoalDays(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_GOALS_STORAGE_KEY) ?? '[]')
    if (Array.isArray(parsed)) {
      memoryGoalDays = new Set(
        parsed.filter((value): value is string => typeof value === 'string')
      )
    }
  } catch {
    /* Используем память текущей сессии. */
  }
  return new Set(memoryGoalDays)
}

export function recordDailyGoal(projectId: string, date: string): void {
  const days = readGoalDays()
  const key = `${projectId}:${date}`
  if (!days.has(key)) {
    days.add(key)
    memoryGoalDays = days
    try {
      localStorage.setItem(DAILY_GOALS_STORAGE_KEY, JSON.stringify([...days]))
    } catch {
      /* Счётчик останется в памяти до закрытия приложения. */
    }
  }
  unlockAchievements([
    'daily-goal-first',
    ...(days.size >= 5 ? (['daily-goals-5'] as const) : [])
  ])
}

export function recordSprintCompleted(): void {
  unlockAchievements(['sprint-first'])
}
