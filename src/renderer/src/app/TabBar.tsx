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
  CircleHelp
} from 'lucide-react'
import { useStore } from '../store/store'
import { ThemeSwitcher } from './ThemeSwitcher'
import { openContextMenu, type MenuItem } from '../shared/ui/ContextMenu'
import { promptText, promptStory } from '../shared/ui/dialogs'
import { startHelpTour } from '../features/help/HelpTour'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'

export function TabBar(): React.JSX.Element {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs, openTab, current, applyProject } = useStore()

  const onDragEnd = (result: DropResult): void => {
    if (!result.destination || result.source.index === result.destination.index) return
    reorderTabs(result.source.index, result.destination.index)
  }

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
          const res = await promptStory({
            title: 'Новая история',
            placeholder: 'Название истории',
            folders: current.folders ?? []
          })
          if (!res || !res.title) return
          applyProject(
            await window.api.stories.add({ projectId: current.id, title: res.title, folderId: res.folderId })
          )
          openTab({ id: 'shelf', kind: 'shelf', title: 'Библиотека' })
        }
      },
      {
        label: 'Новый персонаж',
        icon: <Users size={15} />,
        onClick: async () => {
          if (!current) return
          applyProject(await window.api.characters.add({ projectId: current.id }))
          openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })
        }
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
      }
    ]
    openContextMenu(e, items)
  }

  return (
    <div className="tabbar">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="workspace-tabs" direction="horizontal">
          {(dropProvided) => (
            <div className="tabs-scroll" ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
              {tabs.map((t, index) => (
                <Draggable key={t.id} draggableId={`tab:${t.id}`} index={index} isDragDisabled={t.id === 'shelf'}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className={`tab ${activeTabId === t.id ? 'tab--active' : ''} ${snapshot.isDragging ? 'tab--dragging' : ''}`}
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
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="tabbar-actions">
      <button
        className="tab-close"
        data-tour="add-tab"
        style={{ width: 26, height: 26 }}
        onClick={addMenu}
        title="Добавить вкладку"
      >
        <Plus size={16} />
      </button>

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
    </div>
  )
}
