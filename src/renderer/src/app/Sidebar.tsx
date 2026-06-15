import React from 'react'
import {
  ChevronRight,
  Plus,
  Search,
  BookOpen,
  FileText,
  ArrowLeft,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Copy,
  CircleDot,
  Settings2,
  GripVertical
} from 'lucide-react'
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useStore } from '../store/store'
import { Button, Input, StatusBadge, Hashtags } from '../shared/ui/components'
import { promptText, confirmDialog } from '../shared/ui/dialogs'
import { openContextMenu, type MenuItem } from '../shared/ui/ContextMenu'
import type { Story, Chapter, ChapterStatus, SearchResult } from '@shared/types'
import { STATUS_LABEL } from '../shared/ui/components'
import { StoryProperties } from '../features/library/StoryProperties'

export function Sidebar(): React.JSX.Element {
  const { current, closeProject, applyProject, openTab, activeTabId } = useStore()
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [propertiesStory, setPropertiesStory] = React.useState<Story | null>(null)

  if (!current) return <aside className="sidebar" />

  const toggle = (id: string): void => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const doSearch = async (q: string): Promise<void> => {
    setSearch(q)
    if (!q.trim()) return setResults([])
    setResults(await window.api.search.query({ query: q, projectId: current.id }))
  }

  // ----- CRUD -----
  const addStory = async (): Promise<void> => {
    const title = await promptText({ title: 'Новая история', placeholder: 'Название истории' })
    if (!title) return
    applyProject(await window.api.stories.add({ projectId: current.id, title }))
  }

  const renameStory = async (s: Story): Promise<void> => {
    const title = await promptText({ title: 'Переименовать историю', initial: s.title })
    if (!title || title === s.title) return
    applyProject(
      await window.api.stories.update({ projectId: current.id, storyId: s.id, patch: { title } })
    )
  }

  const setStoryCover = async (s: Story): Promise<void> => {
    applyProject(await window.api.stories.pickCover({ projectId: current.id, storyId: s.id }))
  }

  const deleteStory = async (s: Story): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить историю «${s.title}»?`, danger: true }))) return
    applyProject(await window.api.stories.delete({ projectId: current.id, storyId: s.id }))
  }

  const addChapter = async (s: Story): Promise<void> => {
    const title = await promptText({ title: 'Новая глава', placeholder: 'Название главы' })
    if (!title) return
    const p = await window.api.chapters.add({ projectId: current.id, storyId: s.id, title })
    applyProject(p)
    setExpanded((e) => ({ ...e, [s.id]: true }))
  }

  const openChapter = (s: Story, c: Chapter): void => {
    openTab({
      id: `chapter:${c.id}`,
      kind: 'chapter',
      title: c.title || 'Без названия',
      storyId: s.id,
      chapterId: c.id
    })
  }

  const renameChapter = async (s: Story, c: Chapter): Promise<void> => {
    const title = await promptText({ title: 'Переименовать главу', initial: c.title })
    if (title === null || title === c.title) return
    applyProject(
      await window.api.chapters.update({
        projectId: current.id,
        storyId: s.id,
        chapterId: c.id,
        patch: { title }
      })
    )
  }

  const setChapterStatus = async (s: Story, c: Chapter, status: ChapterStatus): Promise<void> => {
    applyProject(
      await window.api.chapters.update({
        projectId: current.id,
        storyId: s.id,
        chapterId: c.id,
        patch: { status }
      })
    )
  }

  const duplicateChapter = async (s: Story, c: Chapter): Promise<void> => {
    const p = await window.api.chapters.add({
      projectId: current.id,
      storyId: s.id,
      title: `${c.title} (копия)`
    })
    if (!p) return
    const story = p.stories.find((x) => x.id === s.id)
    const created = story?.chapters[story.chapters.length - 1]
    if (created) {
      applyProject(
        await window.api.chapters.update({
          projectId: current.id,
          storyId: s.id,
          chapterId: created.id,
          patch: { content: c.content, plainText: c.plainText, wordCount: c.wordCount }
        })
      )
    } else {
      applyProject(p)
    }
  }

  const deleteChapter = async (s: Story, c: Chapter): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить главу «${c.title}»?`, danger: true }))) return
    applyProject(
      await window.api.chapters.delete({ projectId: current.id, storyId: s.id, chapterId: c.id })
    )
  }

  const reorderChapters = async (result: DropResult): Promise<void> => {
    const { source, destination } = result
    if (!destination || source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return

    const story = current.stories.find((item) => item.id === source.droppableId)
    if (!story) return
    const order = story.chapters.map((chapter) => chapter.id)
    const [moved] = order.splice(source.index, 1)
    order.splice(destination.index, 0, moved)
    applyProject(
      await window.api.chapters.reorder({
        projectId: current.id,
        storyId: story.id,
        order
      })
    )
  }

  const chapterMenu = (s: Story, c: Chapter): MenuItem[] => [
    { label: 'Открыть', icon: <FileText size={15} />, onClick: () => openChapter(s, c) },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameChapter(s, c) },
    { label: 'Копировать', icon: <Copy size={15} />, onClick: () => duplicateChapter(s, c) },
    {
      label: 'Статус',
      icon: <CircleDot size={15} />,
      submenu: (Object.keys(STATUS_LABEL) as ChapterStatus[]).map((st) => ({
        label: STATUS_LABEL[st],
        onClick: () => setChapterStatus(s, c, st)
      }))
    },
    { type: 'sep' },
    { label: 'Удалить', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteChapter(s, c) }
  ]

  const storyMenu = (s: Story): MenuItem[] => [
    { label: 'Добавить главу', icon: <Plus size={15} />, onClick: () => addChapter(s) },
    { label: 'Свойства', icon: <Settings2 size={15} />, onClick: () => setPropertiesStory(s) },
    { label: 'Загрузить обложку', icon: <ImageIcon size={15} />, onClick: () => setStoryCover(s) },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameStory(s) },
    { type: 'sep' },
    { label: 'Удалить историю', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteStory(s) }
  ]

  return (
    <>
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn--ghost btn--sm" onClick={closeProject}>
            <ArrowLeft size={16} /> Все проекты
          </button>
        </div>
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={17} />
          </span>
          <span className="truncate">{current.title}</span>
        </div>
        <Input
          icon={<Search size={16} />}
          placeholder="Поиск по проекту…"
          value={search}
          onChange={(e) => doSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-scroll">
        {results.length > 0 ? (
          <>
            <div className="tree-section-title">Найдено: {results.length}</div>
            {results.map((r, i) => (
              <button
                key={i}
                className="tree-row"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                onClick={() => {
                  if (r.chapterId && r.storyId) {
                    const s = current.stories.find((x) => x.id === r.storyId)
                    const c = s?.chapters.find((x) => x.id === r.chapterId)
                    if (s && c) openChapter(s, c)
                  }
                }}
              >
                <span className="faint" style={{ fontSize: 11 }}>
                  {r.type}
                </span>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                {r.snippet && (
                  <span className="dim truncate" style={{ fontSize: 12, maxWidth: 250 }}>
                    …{r.snippet}…
                  </span>
                )}
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between', padding: '4px 4px' }}>
              <div className="tree-section-title" style={{ padding: '8px 4px 4px' }}>
                Истории
              </div>
              <Button variant="ghost" size="sm" icon onClick={addStory} title="Добавить историю">
                <Plus size={16} />
              </Button>
            </div>

            {current.stories.length === 0 && (
              <div className="dim" style={{ padding: '8px 10px', fontSize: 13 }}>
                Пока нет историй. Нажмите «+», чтобы создать первую.
              </div>
            )}

            <DragDropContext onDragEnd={reorderChapters}>
            {current.stories.map((s) => (
              <div className="tree-node" key={s.id}>
                <div
                  className="tree-row"
                  onClick={() => toggle(s.id)}
                  onContextMenu={(e) => openContextMenu(e, storyMenu(s))}
                >
                  <span className={`chev ${expanded[s.id] ? 'chev--open' : ''}`}>
                    <ChevronRight size={15} />
                  </span>
                  <BookOpen size={15} />
                  <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
                    {s.title}
                  </span>
                  <span className="faint" style={{ fontSize: 12 }}>
                    {s.chapters.length}
                  </span>
                </div>
                {(s.tags.length > 0 || s.genres.length > 0) && (
                  <div style={{ padding: '0 8px 4px 30px' }}>
                    <Hashtags tags={[...s.tags, ...s.genres]} />
                  </div>
                )}

                {expanded[s.id] && (
                  <div className="tree-children">
                    <Droppable droppableId={s.id}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}>
                          {s.chapters.map((c, index) => (
                            <Draggable draggableId={c.id} index={index} key={c.id}>
                              {(dragProvided, snapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`tree-row tree-chapter ${
                                    activeTabId === `chapter:${c.id}` ? 'tree-row--active' : ''
                                  } ${snapshot.isDragging ? 'tree-chapter--dragging' : ''}`}
                                  onClick={() => openChapter(s, c)}
                                  onDoubleClick={() => openChapter(s, c)}
                                  onContextMenu={(e) => openContextMenu(e, chapterMenu(s, c))}
                                >
                                  <span
                                    className="tree-drag-handle"
                                    title="Изменить порядок главы"
                                    {...dragProvided.dragHandleProps}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <GripVertical size={14} />
                                  </span>
                                  <FileText size={14} />
                                  <span className="truncate" style={{ flex: 1 }}>
                                    {c.title || 'Без названия'}
                                  </span>
                                  <StatusBadge status={c.status} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                    <div
                      className="tree-row tree-chapter faint"
                      onClick={() => addChapter(s)}
                      style={{ fontSize: 13 }}
                    >
                      <Plus size={14} /> Глава
                    </div>
                  </div>
                )}
              </div>
            ))}
            </DragDropContext>
          </>
        )}
      </div>
    </aside>
    {propertiesStory && (
      <StoryProperties story={propertiesStory} onClose={() => setPropertiesStory(null)} />
    )}
    </>
  )
}
