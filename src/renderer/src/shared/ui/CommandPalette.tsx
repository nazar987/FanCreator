import React from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  BookPlus,
  FolderPlus,
  Users,
  Clock3,
  LayoutDashboard,
  FileText,
  Library,
  BookOpen,
  CornerDownLeft
} from 'lucide-react'
import { useStore } from '../../store/store'
import { promptText } from './dialogs'
import './cmdk.css'

interface CmdItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  group: string
  keywords?: string
  run: () => void | Promise<void>
}

// Внешний опенер палитры (для кнопок-подсказок «⌘K» и т.п.).
let externalOpen: (() => void) | null = null
/** Открыть command palette программно (например, по клику на чип «⌘K»). */
export function openCommandPalette(): void {
  externalOpen?.()
}

/** Подсчёт релевантности: подстрока → позиция; иначе подпоследовательность; иначе -1. */
function matchScore(text: string, q: string): number {
  const idx = text.indexOf(q)
  if (idx >= 0) return idx
  let ti = 0
  for (const ch of q) {
    ti = text.indexOf(ch, ti)
    if (ti < 0) return -1
    ti++
  }
  return 500
}

/**
 * Command palette (Ctrl/⌘+K) — быстрый поиск и действия: создать историю/папку/
 * персонажа/таймлайн/доску, найти главу, открыть недавнее, перейти по разделам.
 * Вбирает в себя поиск (S-D2).
 */
export function CommandPalette(): React.JSX.Element | null {
  const { current, projects, openProject, openTab, applyProject } = useStore()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen((v) => (v ? false : v))
      }
    }
    window.addEventListener('keydown', onKey)
    externalOpen = () => setOpen(true)
    return () => {
      window.removeEventListener('keydown', onKey)
      externalOpen = null
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      const id = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [open])

  const close = (): void => setOpen(false)
  const exec = (item: CmdItem): void => {
    close()
    void item.run()
  }

  const items: CmdItem[] = React.useMemo(() => {
    if (!current) {
      return projects.map((p) => ({
        id: `proj:${p.id}`,
        title: p.title,
        subtitle: 'Открыть проект',
        group: 'Проекты',
        icon: <BookOpen size={16} />,
        run: () => openProject(p.id)
      }))
    }
    const pid = current.id
    const list: CmdItem[] = [
      {
        id: 'nav:shelf',
        title: 'Библиотека',
        group: 'Переход',
        icon: <Library size={16} />,
        run: () => openTab({ id: 'shelf', kind: 'shelf', title: 'Библиотека' })
      },
      {
        id: 'nav:characters',
        title: 'Персонажи',
        group: 'Переход',
        icon: <Users size={16} />,
        run: () => openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })
      },
      {
        id: 'new:story',
        title: 'Новая история',
        group: 'Создать',
        keywords: 'create story добавить книга',
        icon: <BookPlus size={16} />,
        run: async () => {
          const t = await promptText({ title: 'Новая история', placeholder: 'Название истории' })
          if (!t) return
          applyProject(await window.api.stories.add({ projectId: pid, title: t }))
          openTab({ id: 'shelf', kind: 'shelf', title: 'Библиотека' })
        }
      },
      {
        id: 'new:folder',
        title: 'Новая папка историй',
        group: 'Создать',
        keywords: 'folder папка',
        icon: <FolderPlus size={16} />,
        run: async () => {
          const t = await promptText({ title: 'Новая папка', placeholder: 'Название папки' })
          if (!t) return
          applyProject(await window.api.folders.add({ projectId: pid, title: t }))
        }
      },
      {
        id: 'new:character',
        title: 'Новый персонаж',
        group: 'Создать',
        keywords: 'character персонаж герой',
        icon: <Users size={16} />,
        run: async () => {
          applyProject(await window.api.characters.add({ projectId: pid, name: 'Новый персонаж' }))
          openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })
        }
      },
      {
        id: 'new:timeline',
        title: 'Новый таймлайн',
        group: 'Создать',
        keywords: 'timeline таймлайн события',
        icon: <Clock3 size={16} />,
        run: async () => {
          const t = await promptText({ title: 'Новый таймлайн', placeholder: 'Название таймлайна' })
          if (!t) return
          const p = await window.api.timelines.add({ projectId: pid, title: t })
          applyProject(p)
          const x = p?.timelines.at(-1)
          if (x) openTab({ id: `timeline:${x.id}`, kind: 'timeline', title: x.title, timelineId: x.id })
        }
      },
      {
        id: 'new:board',
        title: 'Новая доска',
        group: 'Создать',
        keywords: 'board доска',
        icon: <LayoutDashboard size={16} />,
        run: async () => {
          const t = await promptText({ title: 'Новая доска', placeholder: 'Название доски' })
          if (!t) return
          const p = await window.api.boards.add({ projectId: pid, title: t })
          applyProject(p)
          const x = p?.boards.at(-1)
          if (x) openTab({ id: `board:${x.id}`, kind: 'board', title: x.title, boardId: x.id })
        }
      }
    ]

    for (const s of current.stories.filter((st) => !st.deletedAt)) {
      for (const c of s.chapters.filter((ch) => !ch.deletedAt)) {
        list.push({
          id: `ch:${c.id}`,
          title: c.title || 'Без названия',
          subtitle: `Глава · ${s.title}`,
          group: 'Главы',
          keywords: s.title,
          icon: <FileText size={16} />,
          run: () =>
            openTab({
              id: `chapter:${c.id}`,
              kind: 'chapter',
              title: c.title || 'Без названия',
              storyId: s.id,
              chapterId: c.id
            })
        })
      }
    }
    for (const b of current.boards) {
      list.push({
        id: `b:${b.id}`,
        title: b.title,
        subtitle: 'Доска',
        group: 'Доски',
        icon: <LayoutDashboard size={16} />,
        run: () => openTab({ id: `board:${b.id}`, kind: 'board', title: b.title, boardId: b.id })
      })
    }
    for (const t of current.timelines) {
      list.push({
        id: `t:${t.id}`,
        title: t.title,
        subtitle: 'Таймлайн',
        group: 'Таймлайны',
        icon: <Clock3 size={16} />,
        run: () => openTab({ id: `timeline:${t.id}`, kind: 'timeline', title: t.title, timelineId: t.id })
      })
    }
    return list
  }, [current, projects, openProject, openTab, applyProject])

  const q = query.trim().toLowerCase()
  const filtered: CmdItem[] = React.useMemo(() => {
    if (!q) {
      const recents: CmdItem[] = current
        ? current.stories
            .filter((s) => !s.deletedAt)
            .flatMap((s) => s.chapters.filter((c) => !c.deletedAt).map((c) => ({ c, s })))
            .sort((a, b) => b.c.updatedAt - a.c.updatedAt)
            .slice(0, 5)
            .map(({ c, s }) => ({
              id: `recent:${c.id}`,
              title: c.title || 'Без названия',
              subtitle: `Недавнее · ${s.title}`,
              group: 'Недавнее',
              icon: <FileText size={16} />,
              run: () =>
                openTab({
                  id: `chapter:${c.id}`,
                  kind: 'chapter',
                  title: c.title || 'Без названия',
                  storyId: s.id,
                  chapterId: c.id
                })
            }))
        : []
      const base = items.filter(
        (i) => i.group === 'Создать' || i.group === 'Переход' || i.group === 'Проекты'
      )
      return [...recents, ...base]
    }
    return items
      .map((i) => ({ i, score: matchScore(`${i.title} ${i.subtitle ?? ''} ${i.keywords ?? ''}`.toLowerCase(), q) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.i)
      .slice(0, 50)
  }, [items, q, current, openTab])

  React.useEffect(() => setActive(0), [q])

  React.useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector('.cmdk-item.is-active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open, filtered.length])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const it = filtered[active]
      if (it) exec(it)
    }
  }

  const rows: React.ReactNode[] = []
  let lastGroup = ''
  filtered.forEach((it, i) => {
    if (it.group !== lastGroup) {
      rows.push(
        <div className="cmdk-group" key={`g:${it.group}:${i}`}>
          {it.group}
        </div>
      )
      lastGroup = it.group
    }
    rows.push(
      <button
        key={it.id}
        className={`cmdk-item ${i === active ? 'is-active' : ''}`}
        onMouseMove={() => setActive(i)}
        onClick={() => exec(it)}
      >
        <span className="cmdk-item-icon">{it.icon}</span>
        <span className="cmdk-item-text">
          <span className="cmdk-item-title">{it.title}</span>
          {it.subtitle && <span className="cmdk-item-sub">{it.subtitle}</span>}
        </span>
        {i === active && <CornerDownLeft size={14} className="cmdk-item-enter" />}
      </button>
    )
  })

  return createPortal(
    <div className="cmdk-overlay" onMouseDown={close}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={18} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Команда или поиск по проекту…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="cmdk-kbd">Esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {filtered.length === 0 ? <div className="cmdk-empty">Ничего не найдено</div> : rows}
        </div>
      </div>
    </div>,
    document.body
  )
}
