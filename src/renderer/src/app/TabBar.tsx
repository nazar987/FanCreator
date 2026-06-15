import React from 'react'
import { X, Plus, Library, BookPlus, FileText, Users, LayoutDashboard } from 'lucide-react'
import { useStore } from '../store/store'
import { ThemeSwitcher } from './ThemeSwitcher'
import { openContextMenu, type MenuItem } from '../shared/ui/ContextMenu'
import { promptText } from '../shared/ui/dialogs'

export function TabBar(): React.JSX.Element {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab, current, applyProject } = useStore()

  const addMenu = (e: React.MouseEvent): void => {
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
        label: 'Новая доска',
        icon: <LayoutDashboard size={15} />,
        onClick: async () => {
          if (!current) return
          const title = await promptText({ title: 'Новая доска', placeholder: 'Название доски' })
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
        onClick: () =>
          openTab({
            id: `board:${board.id}`,
            kind: 'board',
            title: board.title,
            boardId: board.id
          })
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
            if (e.button === 1) closeTab(t.id) // средняя кнопка закрывает
          }}
        >
          {t.kind === 'shelf' ? (
            <Library size={14} />
          ) : t.kind === 'characters' ? (
            <Users size={14} />
          ) : t.kind === 'board' ? (
            <LayoutDashboard size={14} />
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

      <button className="tab-close" style={{ width: 26, height: 26 }} onClick={addMenu} title="Добавить вкладку">
        <Plus size={16} />
      </button>

      <div className="spacer" />
      <ThemeSwitcher />
    </div>
  )
}
