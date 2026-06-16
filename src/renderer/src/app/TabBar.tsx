import React from 'react'
import {
  X,
  Plus,
  Library,
  BookPlus,
  FileText,
  Users,
  LayoutDashboard,
  Clock3,
  Trash2,
  CircleHelp
} from 'lucide-react'
import { useStore } from '../store/store'
import { ThemeSwitcher } from './ThemeSwitcher'
import { openContextMenu, type MenuItem } from '../shared/ui/ContextMenu'
import { confirmDialog, promptText } from '../shared/ui/dialogs'
import { startHelpTour } from '../features/help/HelpTour'

export function TabBar(): React.JSX.Element {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, current, applyProject } = useStore()

  const addMenu = (e: React.MouseEvent): void => {
    const openBoard = (board: NonNullable<typeof current>['boards'][number]): void =>
      openTab({
        id: `board:${board.id}`,
        kind: 'board',
        title: board.title,
        boardId: board.id
      })

    const openTimeline = (timeline: NonNullable<typeof current>['timelines'][number]): void =>
      openTab({
        id: `timeline:${timeline.id}`,
        kind: 'timeline',
        title: timeline.title,
        timelineId: timeline.id
      })

    const deleteBoard = async (board: NonNullable<typeof current>['boards'][number]): Promise<void> => {
      if (!current) return
      const ok = await confirmDialog({
        title: `Удалить доску «${board.title}»?`,
        message: 'Все элементы и связи на этой доске будут удалены.',
        confirmLabel: 'Удалить',
        danger: true
      })
      if (!ok) return
      applyProject(await window.api.boards.delete({ projectId: current.id, boardId: board.id }))
      closeTab(`board:${board.id}`)
    }

    const deleteTimeline = async (timeline: NonNullable<typeof current>['timelines'][number]): Promise<void> => {
      if (!current) return
      const ok = await confirmDialog({
        title: `Удалить таймлайн «${timeline.title}»?`,
        message: 'Все события этого таймлайна будут удалены.',
        confirmLabel: 'Удалить',
        danger: true
      })
      if (!ok) return
      applyProject(await window.api.timelines.delete({ projectId: current.id, timelineId: timeline.id }))
      closeTab(`timeline:${timeline.id}`)
    }

    const items: MenuItem[] = [
      {
        label: 'Библиотека',
        icon: <Library size={15} />,
        onClick: () => openTab({ id: 'shelf', kind: 'shelf', title: 'Библиотека' })
      },
      {
        label: 'Новая история',
        icon: <BookPlus size={15} />,
        onClick: async () => {
          if (!current) return
          const title = await promptText({ title: 'Новая история', placeholder: 'Название' })
          if (!title) return
          applyProject(await window.api.stories.add({ projectId: current.id, title }))
          openTab({ id: 'shelf', kind: 'shelf', title: 'Библиотека' })
        }
      },
      {
        label: 'Персонажи',
        icon: <Users size={15} />,
        onClick: () => openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })
      },
      {
        label: 'Новый таймлайн',
        icon: <Clock3 size={15} />,
        onClick: async () => {
          if (!current) return
          const title = await promptText({
            title: 'Новый таймлайн',
            placeholder: 'Название таймлайна'
          })
          if (!title) return
          const project = await window.api.timelines.add({ projectId: current.id, title })
          applyProject(project)
          const timeline = project?.timelines[project.timelines.length - 1]
          if (timeline) {
            openTab({
              id: `timeline:${timeline.id}`,
              kind: 'timeline',
              title: timeline.title,
              timelineId: timeline.id
            })
          }
        }
      },
      {
        label: 'Новая доска',
        icon: <LayoutDashboard size={15} />,
        onClick: async () => {
          if (!current) return
          const title = await promptText({
            title: 'Новая доска',
            placeholder: 'Название доски'
          })
          if (!title) return
          const project = await window.api.boards.add({ projectId: current.id, title })
          applyProject(project)
          const board = project?.boards[project.boards.length - 1]
          if (board) {
            openTab({
              id: `board:${board.id}`,
              kind: 'board',
              title: board.title,
              boardId: board.id
            })
          }
        }
      },
      { type: 'label', label: 'Доски проекта' },
      ...(current?.boards.map((board) => ({
        label: board.title,
        icon: <LayoutDashboard size={15} />,
        submenu: [
          { label: 'Открыть', icon: <LayoutDashboard size={15} />, onClick: () => openBoard(board) },
          {
            label: 'Удалить',
            icon: <Trash2 size={15} />,
            danger: true,
            onClick: () => deleteBoard(board)
          }
        ]
      })) ?? []),
      { type: 'label', label: 'Таймлайны проекта' },
      ...(current?.timelines.map((timeline) => ({
        label: timeline.title,
        icon: <Clock3 size={15} />,
        submenu: [
          { label: 'Открыть', icon: <Clock3 size={15} />, onClick: () => openTimeline(timeline) },
          {
            label: 'Удалить',
            icon: <Trash2 size={15} />,
            danger: true,
            onClick: () => deleteTimeline(timeline)
          }
        ]
      })) ?? [])
    ]
    openContextMenu(e, items)
  }

  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={`tab ${activeTabId === t.id ? 'tab--active' : ''}`}
          onClick={() => setActiveTab(t.id)}
          onAuxClick={(e) => {
            if (e.button === 1) closeTab(t.id)
          }}
        >
          {t.kind === 'shelf' ? (
            <Library size={14} />
          ) : t.kind === 'characters' ? (
            <Users size={14} />
          ) : t.kind === 'board' ? (
            <LayoutDashboard size={14} />
          ) : t.kind === 'timeline' ? (
            <Clock3 size={14} />
          ) : (
            <FileText size={14} />
          )}
          <span className="truncate" style={{ flex: 1 }}>
            {t.title}
          </span>
          {t.kind !== 'shelf' && (
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(t.id)
              }}
              title="Закрыть вкладку"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}

      <button
        className="tab-close"
        data-tour="add-tab"
        style={{ width: 26, height: 26 }}
        onClick={addMenu}
        title="Добавить вкладку"
      >
        <Plus size={16} />
      </button>

      <div className="spacer" />
      <button
        className="tab-close"
        style={{ width: 26, height: 26 }}
        onClick={startHelpTour}
        title="Помощь"
      >
        <CircleHelp size={16} />
      </button>
      <ThemeSwitcher />
    </div>
  )
}
