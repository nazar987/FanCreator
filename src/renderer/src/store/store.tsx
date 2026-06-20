import React from 'react'
import type { Project, ProjectSummary, ThemeName, Chapter } from '@shared/types'

/** Открытая вкладка рабочего стола (эфемерное UI-состояние, п.10). */
export interface OpenTab {
  id: string
  kind: 'shelf' | 'chapter' | 'characters' | 'character' | 'board' | 'timeline'
  title: string
  storyId?: string
  chapterId?: string
  characterId?: string
  boardId?: string
  timelineId?: string
}

interface StoreValue {
  theme: ThemeName
  setTheme: (t: ThemeName) => void

  projects: ProjectSummary[]
  refreshProjects: () => Promise<ProjectSummary[]>

  current: Project | null
  openProject: (projectId: string) => Promise<void>
  closeProject: () => void
  reloadCurrent: () => Promise<Project | null>
  /** Применяет вернувшийся с бэкенда проект как текущий + обновляет список. */
  applyProject: (p: Project | null) => void
  /** Локально обновляет главу в текущем проекте (без round-trip за всем проектом). */
  patchChapter: (
    storyId: string,
    chapterId: string,
    patch: Partial<Pick<Chapter, 'content' | 'plainText' | 'wordCount' | 'title' | 'status'>>
  ) => void

  tabs: OpenTab[]
  activeTabId: string | null
  openTab: (tab: Omit<OpenTab, 'id'> & { id?: string }) => void
  closeTab: (id: string) => void
  reorderTabs: (from: number, to: number) => void
  setActiveTab: (id: string) => void
}

const Ctx = React.createContext<StoreValue | null>(null)

const THEME_KEY = 'fancreator.theme'
const SHELF_TAB: OpenTab = { id: 'shelf', kind: 'shelf', title: 'Библиотека' }

export function StoreProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = React.useState<ThemeName>(
    () => (localStorage.getItem(THEME_KEY) as ThemeName) || 'dark'
  )
  const [projects, setProjects] = React.useState<ProjectSummary[]>([])
  const [current, setCurrent] = React.useState<Project | null>(null)
  const [tabs, setTabs] = React.useState<OpenTab[]>([SHELF_TAB])
  const [activeTabId, setActiveTabId] = React.useState<string | null>('shelf')

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const applyThemeLocal = React.useCallback((t: ThemeName) => {
    setThemeState(t)
    localStorage.setItem(THEME_KEY, t)
  }, [])

  const refreshProjects = React.useCallback(async () => {
    const list = await window.api.projects.list()
    setProjects(list)
    return list
  }, [])

  React.useEffect(() => {
    refreshProjects()
  }, [refreshProjects])

  const applyProject = React.useCallback((p: Project | null) => {
    if (!p) return
    setCurrent(p)
    // обновляем сводку в списке без полной перезагрузки
    setProjects((prev) =>
      prev
        .map((s) =>
          s.id === p.id
            ? {
                ...s,
                title: p.title,
                coverPath: p.coverPath,
                description: p.description,
                tags: p.tags,
                storyCount: p.stories.length,
                chapterCount: p.stories.reduce((n, st) => n + st.chapters.length, 0),
                updatedAt: p.updatedAt
              }
            : s
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)
    )
  }, [])

  const patchChapter = React.useCallback<StoreValue['patchChapter']>(
    (storyId, chapterId, patch) => {
      setCurrent((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          stories: prev.stories.map((s) =>
            s.id !== storyId
              ? s
              : {
                  ...s,
                  chapters: s.chapters.map((c) =>
                    c.id === chapterId ? { ...c, ...patch } : c
                  )
                }
          )
        }
      })
    },
    []
  )

  const setTheme = React.useCallback(
    (t: ThemeName) => {
      applyThemeLocal(t)
      if (current) {
        window.api.projects
          .update({ projectId: current.id, patch: { theme: t } })
          .then(applyProject)
      }
    },
    [current, applyProject, applyThemeLocal]
  )

  const reloadCurrent = React.useCallback(async () => {
    if (!current) return null
    const p = await window.api.projects.get(current.id)
    if (p) applyProject(p)
    return p
  }, [current, applyProject])

  const openProject = React.useCallback(
    async (projectId: string) => {
      const p = await window.api.projects.get(projectId)
      if (!p) return
      setCurrent(p)
      if (p.theme) applyThemeLocal(p.theme)
      setTabs([SHELF_TAB])
      setActiveTabId('shelf')
    },
    [applyThemeLocal]
  )

  const closeProject = React.useCallback(() => {
    setCurrent(null)
    setTabs([SHELF_TAB])
    setActiveTabId('shelf')
    refreshProjects()
  }, [refreshProjects])

  const openTab = React.useCallback((tab: Omit<OpenTab, 'id'> & { id?: string }) => {
    const id =
      tab.id ??
      `${tab.kind}:${tab.chapterId ?? tab.characterId ?? tab.storyId ?? tab.boardId ?? tab.timelineId ?? Math.random()}`
    setTabs((prev) => (prev.some((t) => t.id === id) ? prev : [...prev, { ...tab, id }]))
    setActiveTabId(id)
  }, [])

  const closeTab = React.useCallback((id: string) => {
    if (id === 'shelf') return
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const next = prev.filter((t) => t.id !== id)
      setActiveTabId((cur) => {
        if (cur !== id) return cur
        const fallback = next[Math.max(0, idx - 1)] ?? next[0]
        return fallback?.id ?? 'shelf'
      })
      return next.length ? next : [SHELF_TAB]
    })
  }, [])

  const reorderTabs = React.useCallback((from: number, to: number) => {
    setTabs((currentTabs) => {
      const moving = currentTabs[from]
      if (!moving || moving.id === 'shelf') return currentTabs
      const next = [...currentTabs]
      next.splice(from, 1)
      next.splice(Math.max(1, Math.min(to, next.length)), 0, moving)
      return next
    })
  }, [])

  const value: StoreValue = {
    theme,
    setTheme,
    projects,
    refreshProjects,
    current,
    openProject,
    closeProject,
    reloadCurrent,
    applyProject,
    patchChapter,
    tabs,
    activeTabId,
    openTab,
    closeTab,
    reorderTabs,
    setActiveTab: setActiveTabId
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreValue {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
