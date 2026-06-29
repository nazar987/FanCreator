import React from 'react'
import type { Project, ProjectSummary, ThemeName, Chapter } from '@shared/types'
import { confirmDialog } from '../shared/ui/dialogs'

/** Открытая вкладка рабочего стола (эфемерное UI-состояние, п.10). */
export interface OpenTab {
  id: string
  kind: 'shelf' | 'chapter' | 'characters' | 'character' | 'board' | 'timeline' | 'hierarchy'
  title: string
  storyId?: string
  chapterId?: string
  characterId?: string
  boardId?: string
  timelineId?: string
  hierarchyId?: string
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

  /** Целевая папка библиотеки (для перехода из сайдбара, S-F11). */
  libraryFolderId: string | null
  /** Счётчик «команд перехода» — Shelf реагирует на его изменение. */
  libraryFolderNonce: number
  goToLibraryFolder: (folderId: string | null) => void
  characterFolderId: string | null
  characterFolderNonce: number
  goToCharacterFolder: (folderId: string | null) => void
  genealogyTargetId: string | null
  genealogyNonce: number
  goToGenealogy: (genealogyId: string) => void
}

const Ctx = React.createContext<StoreValue | null>(null)

const THEME_KEY = 'fancreator.theme'
const SHELF_TAB: OpenTab = { id: 'shelf', kind: 'shelf', title: 'Библиотека' }

/** Существует ли сущность, на которую ссылается вкладка (не удалена/не в корзине). */
function isTabAlive(p: Project, tab: OpenTab): boolean {
  if (tab.kind === 'chapter' && tab.chapterId) {
    const story = p.stories.find((s) => s.id === tab.storyId)
    if (!story || story.deletedAt) return false
    const ch = story.chapters.find((c) => c.id === tab.chapterId)
    return !!ch && !ch.deletedAt
  }
  if (tab.kind === 'character' && tab.characterId) return p.characters.some((c) => c.id === tab.characterId)
  if (tab.kind === 'board' && tab.boardId) return p.boards.some((b) => b.id === tab.boardId)
  if (tab.kind === 'timeline' && tab.timelineId) return p.timelines.some((t) => t.id === tab.timelineId)
  if (tab.kind === 'hierarchy' && tab.hierarchyId)
    return (p.hierarchies ?? []).some((h) => h.id === tab.hierarchyId)
  return true
}

const sessionKey = (projectId: string): string => `fancreator.session.${projectId}`
function hasStoredTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) != null
  } catch {
    return false
  }
}

function loadSession(projectId: string): { tabs: OpenTab[]; activeTabId: string | null } | null {
  try {
    const raw = localStorage.getItem(sessionKey(projectId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = React.useState<ThemeName>(
    () => (localStorage.getItem(THEME_KEY) as ThemeName) || 'dark'
  )
  const [projects, setProjects] = React.useState<ProjectSummary[]>([])
  const [current, setCurrent] = React.useState<Project | null>(null)
  const [tabs, setTabs] = React.useState<OpenTab[]>([SHELF_TAB])
  const [activeTabId, setActiveTabId] = React.useState<string | null>('shelf')
  const activeTabIdRef = React.useRef(activeTabId)
  activeTabIdRef.current = activeTabId
  const [libraryFolderId, setLibraryFolderId] = React.useState<string | null>(null)
  const [libraryFolderNonce, setLibraryFolderNonce] = React.useState(0)
  const [characterFolderId, setCharacterFolderId] = React.useState<string | null>(null)
  const [characterFolderNonce, setCharacterFolderNonce] = React.useState(0)
  const [genealogyTargetId, setGenealogyTargetId] = React.useState<string | null>(null)
  const [genealogyNonce, setGenealogyNonce] = React.useState(0)

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // запоминаем открытые вкладки текущего проекта — для восстановления сессии
  React.useEffect(() => {
    if (!current) return
    try {
      localStorage.setItem(sessionKey(current.id), JSON.stringify({ tabs, activeTabId }))
    } catch {
      /* localStorage недоступен — не критично */
    }
  }, [current, tabs, activeTabId])

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
    // закрываем вкладки сущностей, которых больше нет (удалены/в корзине), и
    // подтягиваем актуальные заголовки (имя персонажа). Иначе при удалении главы
    // из левого меню её вкладка оставалась открытой.
    setTabs((openTabs) => {
      const pruned = openTabs.filter((tab) => isTabAlive(p, tab)).map((tab) => {
        if (tab.kind !== 'character' || !tab.characterId) return tab
        const character = p.characters.find((item) => item.id === tab.characterId)
        return character ? { ...tab, title: character.name || 'Без имени' } : tab
      })
      // если активная вкладка закрылась — переключаемся на последнюю/полку
      if (!pruned.some((t) => t.id === activeTabIdRef.current)) {
        setActiveTabId(pruned[pruned.length - 1]?.id ?? 'shelf')
      }
      return pruned
    })
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
      // bump-аем updatedAt локально, иначе «Продолжить писать» и сортировка
      // «Сначала недавние» не обновляются до перезапуска (S-F7)
      const ts = Date.now()
      setCurrent((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          updatedAt: ts,
          stories: prev.stories.map((s) =>
            s.id !== storyId
              ? s
              : {
                  ...s,
                  updatedAt: ts,
                  chapters: s.chapters.map((c) =>
                    c.id === chapterId ? { ...c, ...patch, updatedAt: ts } : c
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
      setCharacterFolderId(null)
      setCharacterFolderNonce(0)
      if (p.theme && !hasStoredTheme()) applyThemeLocal(p.theme)
      setTabs([SHELF_TAB])
      setActiveTabId('shelf')
      // восстановление вкладок прошлой сессии (как в браузере)
      const saved = loadSession(projectId)
      const restorable = (saved?.tabs ?? []).filter((t) => t.kind !== 'shelf' && isTabAlive(p, t))
      if (restorable.length) {
        const ok = await confirmDialog({
          title: 'Восстановить вкладки?',
          message: `Открыть ${restorable.length} вкладок из прошлой сессии?`,
          confirmLabel: 'Восстановить'
        })
        if (ok) {
          const next = [SHELF_TAB, ...restorable]
          setTabs(next)
          setActiveTabId(
            saved?.activeTabId && next.some((t) => t.id === saved.activeTabId)
              ? saved.activeTabId
              : next[next.length - 1].id
          )
        }
      }
    },
    [applyThemeLocal]
  )

  const closeProject = React.useCallback(() => {
    setCurrent(null)
    setCharacterFolderId(null)
    setCharacterFolderNonce(0)
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

  const goToLibraryFolder = React.useCallback((folderId: string | null) => {
    if (current) {
      const key = `fancreator.shelf.${current.id}`
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>
        localStorage.setItem(key, JSON.stringify({ ...saved, folderId }))
      } catch {
        localStorage.setItem(key, JSON.stringify({ folderId }))
      }
    }
    setLibraryFolderId(folderId)
    setLibraryFolderNonce((n) => n + 1)
    setActiveTabId('shelf')
  }, [current])

  const goToCharacterFolder = React.useCallback((folderId: string | null) => {
    if (current) {
      const key = `fancreator.characters.folder.${current.id}`
      try {
        if (folderId) localStorage.setItem(key, folderId)
        else localStorage.removeItem(key)
      } catch {
        // Команда навигации остаётся рабочей и без сохранения UI-состояния.
      }
    }
    setCharacterFolderId(folderId)
    setCharacterFolderNonce((nonce) => nonce + 1)
    setTabs((openTabs) =>
      openTabs.some((tab) => tab.id === 'characters')
        ? openTabs
        : [...openTabs, { id: 'characters', kind: 'characters', title: 'Персонажи' }]
    )
    setActiveTabId('characters')
  }, [current])

  // открыть конкретную родословную: открываем вкладку «Персонажи» и сигналим
  // менеджеру родословных (через nonce) переключиться на раздел и выбрать её
  const goToGenealogy = React.useCallback((genealogyId: string) => {
    setGenealogyTargetId(genealogyId)
    setGenealogyNonce((nonce) => nonce + 1)
    setTabs((openTabs) =>
      openTabs.some((tab) => tab.id === 'characters')
        ? openTabs
        : [...openTabs, { id: 'characters', kind: 'characters', title: 'Персонажи' }]
    )
    setActiveTabId('characters')
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
    setActiveTab: setActiveTabId,
    libraryFolderId,
    libraryFolderNonce,
    goToLibraryFolder,
    characterFolderId,
    characterFolderNonce,
    goToCharacterFolder,
    genealogyTargetId,
    genealogyNonce,
    goToGenealogy
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreValue {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
