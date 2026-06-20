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
  GripVertical,
  MoveRight,
  Folder as FolderIcon,
  FolderPlus,
  Users,
  Clock3,
  LayoutDashboard
} from 'lucide-react'
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult
} from '@hello-pangea/dnd'
import { useStore } from '../store/store'
import { Button, Input, StatusBadge, Hashtags } from '../shared/ui/components'
import { promptText, confirmDialog } from '../shared/ui/dialogs'
import { openContextMenu, type MenuItem } from '../shared/ui/ContextMenu'
import type { Story, Chapter, ChapterStatus, SearchResult, Folder } from '@shared/types'
import { STATUS_LABEL } from '../shared/ui/components'
import { StoryProperties } from '../features/library/StoryProperties'
import { TrashView } from '../features/library/TrashView'
import { ColorPalette } from '../shared/ui/ColorPalette'

export function Sidebar(): React.JSX.Element {
  const { current, closeProject, applyProject, openTab, activeTabId } = useStore()
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [propertiesStory, setPropertiesStory] = React.useState<Story | null>(null)
  const [trashOpen, setTrashOpen] = React.useState(false)

  if (!current) return <aside className="sidebar" />

  const toggle = (id: string): void => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const doSearch = async (q: string): Promise<void> => {
    setSearch(q)
    if (!q.trim()) return setResults([])
    setResults(await window.api.search.query({ query: q, projectId: current.id }))
  }

  // ----- CRUD -----
  const addStory = async (folderId: string | null = null): Promise<void> => {
    const title = await promptText({ title: 'Новая история', placeholder: 'Название истории' })
    if (!title) return
    applyProject(await window.api.stories.add({ projectId: current.id, title, folderId }))
    if (folderId) setExpanded((e) => ({ ...e, [`folder:${folderId}`]: true }))
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

  const setStoryColor = async (s: Story, color: string): Promise<void> => {
    applyProject(
      await window.api.stories.update({ projectId: current.id, storyId: s.id, patch: { color } })
    )
  }

  const deleteStory = async (s: Story): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить историю «${s.title}»?`, danger: true }))) return
    applyProject(await window.api.stories.delete({ projectId: current.id, storyId: s.id }))
  }

  // ----- Папки (S-8, #10) -----
  const addFolder = async (parentId: string | null = null): Promise<void> => {
    const title = await promptText({
      title: parentId ? 'Новая подпапка' : 'Новая папка',
      placeholder: 'Название папки'
    })
    if (!title) return
    applyProject(await window.api.folders.add({ projectId: current.id, parentId, title }))
    if (parentId) setExpanded((e) => ({ ...e, [`folder:${parentId}`]: true }))
  }

  const renameFolder = async (f: Folder): Promise<void> => {
    const title = await promptText({ title: 'Переименовать папку', initial: f.title })
    if (!title || title === f.title) return
    applyProject(await window.api.folders.rename({ projectId: current.id, folderId: f.id, title }))
  }

  const setFolderColor = async (f: Folder, color: string): Promise<void> => {
    applyProject(await window.api.folders.setColor({ projectId: current.id, folderId: f.id, color }))
  }

  const deleteFolder = async (f: Folder): Promise<void> => {
    if (
      !(await confirmDialog({
        title: `Удалить папку «${f.title}»?`,
        message: 'Папка удалится вместе с подпапками; истории внутри отправятся в Корзину.',
        danger: true,
        confirmLabel: 'Удалить'
      }))
    )
      return
    applyProject(await window.api.folders.delete({ projectId: current.id, folderId: f.id }))
  }

  const moveStoryToFolder = async (s: Story, folderId: string | null): Promise<void> => {
    applyProject(await window.api.stories.setFolder({ projectId: current.id, storyId: s.id, folderId }))
    if (folderId) setExpanded((e) => ({ ...e, [`folder:${folderId}`]: true }))
  }

  const addChapter = async (s: Story, parentId: string | null = null): Promise<void> => {
    const title = await promptText({
      title: parentId ? 'Новая подглава' : 'Новая глава',
      placeholder: parentId ? 'Название подглавы' : 'Название главы'
    })
    if (!title) return
    const p = await window.api.chapters.add({ projectId: current.id, storyId: s.id, title, parentId })
    applyProject(p)
    setExpanded((e) => ({ ...e, [s.id]: true, ...(parentId ? { [`chapter:${parentId}`]: true } : {}) }))
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
      title: `${c.title} (копия)`,
      parentId: c.parentId ?? null
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

  const activeStories = (): Story[] =>
    current.stories.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order)

  const childFolders = (parentId: string | null): Folder[] =>
    (current.folders ?? [])
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => a.order - b.order)

  const folderStories = (folderId: string | null): Story[] =>
    activeStories().filter((s) => (s.folderId ?? null) === folderId)

  const chapterDropId = (storyId: string, parentId: string | null): string =>
    `chapters:${storyId}:${parentId ?? 'root'}`

  const parseChapterDropId = (droppableId: string): { storyId: string; parentId: string | null } | null => {
    const [, storyId, parentId] = droppableId.split(':')
    if (!droppableId.startsWith('chapters:') || !storyId) return null
    return { storyId, parentId: parentId === 'root' ? null : parentId }
  }

  const reorderSidebarItems = async (result: DropResult): Promise<void> => {
    const { source, destination } = result
    if (!destination || source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return

    if (source.droppableId === 'stories') {
      // Перетаскиваем только истории в корне; внутри папок порядок задаётся через меню.
      const rootOrder = folderStories(null).map((story) => story.id)
      const [moved] = rootOrder.splice(source.index, 1)
      rootOrder.splice(destination.index, 0, moved)
      // Сохраняем хвост (истории внутри папок) в их прежнем относительном порядке.
      const order = [...rootOrder, ...activeStories().filter((s) => (s.folderId ?? null) !== null).map((s) => s.id)]
      applyProject(await window.api.stories.reorder({ projectId: current.id, order }))
      return
    }

    const chapterDrop = parseChapterDropId(source.droppableId)
    if (!chapterDrop) return
    const story = current.stories.find((item) => item.id === chapterDrop.storyId)
    if (!story) return
    const order = childChapters(story, chapterDrop.parentId).map((chapter) => chapter.id)
    const [moved] = order.splice(source.index, 1)
    order.splice(destination.index, 0, moved)
    applyProject(
      await window.api.chapters.reorder({
        projectId: current.id,
        storyId: story.id,
        parentId: chapterDrop.parentId,
        order
      })
    )
  }

  const moveChapter = async (fromStory: Story, toStory: Story, chapter: Chapter): Promise<void> => {
    applyProject(
      await window.api.chapters.move({
        projectId: current.id,
        fromStoryId: fromStory.id,
        toStoryId: toStory.id,
        chapterId: chapter.id
      })
    )
    setExpanded((items) => ({ ...items, [toStory.id]: true }))
  }

  const chapterMenu = (s: Story, c: Chapter): MenuItem[] => {
    const otherStories = current.stories.filter((story) => story.id !== s.id)
    return [
      { label: 'Открыть', icon: <FileText size={15} />, onClick: () => openChapter(s, c) },
      { label: 'Добавить подглаву', icon: <Plus size={15} />, onClick: () => addChapter(s, c.id) },
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
      ...(otherStories.length
        ? [
            {
              label: 'Переместить',
              icon: <MoveRight size={15} />,
              submenu: otherStories.map((story) => ({
                label: story.title,
                onClick: () => moveChapter(s, story, c)
              }))
            }
          ]
        : []),
      { type: 'sep' },
      { label: 'Удалить', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteChapter(s, c) }
    ]
  }

  // Плоский список папок с отступами по глубине — для подменю «Переместить в папку».
  const folderOptions = (): { folder: Folder; depth: number }[] => {
    const out: { folder: Folder; depth: number }[] = []
    const walk = (parentId: string | null, depth: number): void => {
      for (const folder of childFolders(parentId)) {
        out.push({ folder, depth })
        walk(folder.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }

  const storyMenu = (s: Story): MenuItem[] => [
    { label: 'Добавить главу', icon: <Plus size={15} />, onClick: () => addChapter(s) },
    {
      label: 'Переместить в папку',
      icon: <FolderIcon size={15} />,
      submenu: [
        {
          label: 'В корень',
          disabled: (s.folderId ?? null) === null,
          onClick: () => moveStoryToFolder(s, null)
        },
        ...folderOptions().map(({ folder, depth }) => ({
          label: `${'  '.repeat(depth)}${folder.title}`,
          disabled: (s.folderId ?? null) === folder.id,
          onClick: () => moveStoryToFolder(s, folder.id)
        }))
      ]
    },
    { label: 'Свойства', icon: <Settings2 size={15} />, onClick: () => setPropertiesStory(s) },
    { label: 'Загрузить обложку', icon: <ImageIcon size={15} />, onClick: () => setStoryCover(s) },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameStory(s) },
    { type: 'sep' },
    { label: 'Удалить историю', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteStory(s) }
  ]

  const folderMenu = (f: Folder): MenuItem[] => [
    { label: 'Новая подпапка', icon: <FolderPlus size={15} />, onClick: () => addFolder(f.id) },
    { label: 'Новая история здесь', icon: <Plus size={15} />, onClick: () => addStory(f.id) },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameFolder(f) },
    { type: 'sep' },
    { label: 'Удалить папку', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteFolder(f) }
  ]

  const activeChapters = (s: Story): Chapter[] => s.chapters.filter((c) => !c.deletedAt)

  const childChapters = (s: Story, parentId: string | null): Chapter[] =>
    activeChapters(s)
      .filter((c) => (c.parentId ?? null) === parentId)
      .sort((a, b) => a.order - b.order)

  const renderDraggableChapterRow = (
    s: Story,
    c: Chapter,
    depth: number,
    dragHandleProps: DraggableProvidedDragHandleProps | null | undefined,
    isDragging: boolean
  ): React.JSX.Element => {
    const children = childChapters(s, c.id)
    const key = `chapter:${c.id}`
    const isOpen = expanded[key] ?? true
    return (
      <>
        <div
          className={`tree-row tree-chapter ${
            activeTabId === `chapter:${c.id}` ? 'tree-row--active' : ''
          } ${isDragging ? 'tree-chapter--dragging' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => openChapter(s, c)}
          onDoubleClick={() => openChapter(s, c)}
          onContextMenu={(e) => openContextMenu(e, chapterMenu(s, c))}
        >
          <span
            className={`chev ${children.length > 0 && isOpen ? 'chev--open' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              if (children.length > 0) toggle(key)
            }}
          >
            {children.length > 0 ? <ChevronRight size={15} /> : <span style={{ width: 15 }} />}
          </span>
          <span
            className="tree-drag-handle"
            title="Изменить порядок главы"
            {...dragHandleProps}
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
        {children.length > 0 && isOpen && (
          <div className="tree-subchapters">{renderDraggableChapterGroup(s, c.id, depth + 1)}</div>
        )}
      </>
    )
  }

  const renderDraggableChapterGroup = (s: Story, parentId: string | null, depth: number): React.JSX.Element => {
    const chapters = childChapters(s, parentId)
    return (
      <Droppable droppableId={chapterDropId(s.id, parentId)} type="chapter">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {chapters.map((c, index) => (
              <Draggable draggableId={c.id} index={index} key={c.id}>
                {(dragProvided, snapshot) => (
                  <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="tree-chapter-node">
                    {renderDraggableChapterRow(s, c, depth, dragProvided.dragHandleProps, snapshot.isDragging)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    )
  }

  // Тело истории (строка + главы) — переиспользуется в корне (draggable) и внутри папок (статично).
  const renderStoryBody = (
    s: Story,
    storyDragHandle: DraggableProvidedDragHandleProps | null | undefined
  ): React.JSX.Element => (
    <>
      <div
        className="tree-row"
        onClick={() => toggle(s.id)}
        onContextMenu={(e) => openContextMenu(e, storyMenu(s))}
      >
        {storyDragHandle && (
          <span
            className="tree-drag-handle"
            title="Изменить порядок истории"
            {...storyDragHandle}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical size={14} />
          </span>
        )}
        <span className={`chev ${expanded[s.id] ? 'chev--open' : ''}`}>
          <ChevronRight size={15} />
        </span>
        <BookOpen size={15} style={{ color: s.color ?? '#8b8cf0' }} />
        <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
          {s.title}
        </span>
        <ColorPalette
          className="tree-color-picker"
          value={s.color ?? '#8b8cf0'}
          title="Цвет книги"
          onChange={(color) => setStoryColor(s, color)}
        />
        <span className="faint" style={{ fontSize: 12 }}>
          {s.chapters.filter((c) => !c.deletedAt).length}
        </span>
      </div>
      {(s.tags.length > 0 || s.genres.length > 0) && (
        <div style={{ padding: '0 8px 4px 30px' }}>
          <Hashtags tags={[...s.tags, ...s.genres]} />
        </div>
      )}
      {expanded[s.id] && (
        <div className="tree-children">
          <Droppable droppableId={chapterDropId(s.id, null)} type="chapter">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {childChapters(s, null).map((c, index) => (
                  <React.Fragment key={c.id}>
                    <Draggable draggableId={c.id} index={index}>
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
                    {childChapters(s, c.id).length > 0 && (expanded[`chapter:${c.id}`] ?? true) && (
                      <div className="tree-subchapters">{renderDraggableChapterGroup(s, c.id, 1)}</div>
                    )}
                  </React.Fragment>
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
    </>
  )

  const renderFolder = (f: Folder, depth: number): React.JSX.Element => {
    const key = `folder:${f.id}`
    const isOpen = expanded[key] ?? false
    const subfolders = childFolders(f.id)
    const stories = folderStories(f.id)
    return (
      <div className="tree-node" key={f.id}>
        <div
          className="tree-row"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => toggle(key)}
          onContextMenu={(e) => openContextMenu(e, folderMenu(f))}
        >
          <span className={`chev ${isOpen ? 'chev--open' : ''}`}>
            <ChevronRight size={15} />
          </span>
          <FolderIcon size={15} fill={f.color ?? '#f0b84b'} style={{ color: f.color ?? '#f0b84b' }} />
          <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
            {f.title}
          </span>
          <ColorPalette
            className="tree-color-picker"
            value={f.color ?? '#f0b84b'}
            title="Цвет папки"
            onChange={(color) => setFolderColor(f, color)}
          />
          <span className="faint" style={{ fontSize: 12 }}>
            {stories.length}
          </span>
        </div>
        {isOpen && (
          <div className="tree-children">
            {subfolders.map((sf) => renderFolder(sf, depth + 1))}
            {stories.map((s) => (
              <div className="tree-node" key={s.id}>
                {renderStoryBody(s, null)}
              </div>
            ))}
            {subfolders.length === 0 && stories.length === 0 && (
              <div className="dim" style={{ padding: '4px 10px', fontSize: 12 }}>
                Папка пуста
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // S-D4: аддитивная сворачиваемая навигация по разделам проекта (под деревом историй)
  const renderNavSection = (
    key: string,
    label: string,
    icon: React.JSX.Element,
    items: { id: string; title: string }[],
    open: (item: { id: string; title: string }) => void,
    activePrefix: string
  ): React.JSX.Element => {
    const isOpen = expanded[key] ?? false
    return (
      <div className="tree-node" key={key}>
        <div className="tree-row" onClick={() => toggle(key)}>
          <span className={`chev ${isOpen ? 'chev--open' : ''}`}>
            <ChevronRight size={15} />
          </span>
          {icon}
          <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
            {label}
          </span>
          <span className="faint" style={{ fontSize: 12 }}>
            {items.length}
          </span>
        </div>
        {isOpen && (
          <div className="tree-children">
            {items.map((it) => (
              <div
                key={it.id}
                className={`tree-row tree-chapter ${
                  activeTabId === `${activePrefix}${it.id}` ? 'tree-row--active' : ''
                }`}
                onClick={() => open(it)}
              >
                <FileText size={14} />
                <span className="truncate" style={{ flex: 1 }}>
                  {it.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <aside className="sidebar" data-tour="tree">
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
              <div className="row" style={{ gap: 2 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  onClick={() => addFolder(null)}
                  title="Новая папка"
                >
                  <FolderPlus size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  onClick={() => addStory(null)}
                  title="Добавить историю"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {current.stories.filter((s) => !s.deletedAt).length === 0 && (
              <div className="dim" style={{ padding: '8px 10px', fontSize: 13 }}>
                Пока нет историй. Нажмите «+», чтобы создать первую.
              </div>
            )}

            <DragDropContext onDragEnd={reorderSidebarItems}>
              {childFolders(null).map((f) => renderFolder(f, 0))}
              <Droppable droppableId="stories" type="story">
                {(storyDrop) => (
                  <div ref={storyDrop.innerRef} {...storyDrop.droppableProps}>
                    {folderStories(null).map((s, storyIndex) => (
                      <Draggable draggableId={s.id} index={storyIndex} key={s.id}>
                        {(storyDrag, storySnapshot) => (
                          <div
                            ref={storyDrag.innerRef}
                            {...storyDrag.draggableProps}
                            className={`tree-node ${storySnapshot.isDragging ? 'tree-node--dragging' : ''}`}
                          >
                            {renderStoryBody(s, storyDrag.dragHandleProps)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {storyDrop.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="tree-section-title" style={{ marginTop: 8 }}>
              Разделы проекта
            </div>
            <div
              className={`tree-row ${activeTabId === 'characters' ? 'tree-row--active' : ''}`}
              onClick={() => openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })}
            >
              <span style={{ width: 15 }} />
              <Users size={15} />
              <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
                Персонажи
              </span>
              <span className="faint" style={{ fontSize: 12 }}>
                {current.characters.length}
              </span>
            </div>
            {current.timelines.length > 0 &&
              renderNavSection(
                'sec:timelines',
                'Таймлайны',
                <Clock3 size={15} />,
                current.timelines.map((t) => ({ id: t.id, title: t.title })),
                (t) => openTab({ id: `timeline:${t.id}`, kind: 'timeline', title: t.title, timelineId: t.id }),
                'timeline:'
              )}
            {current.boards.length > 0 &&
              renderNavSection(
                'sec:boards',
                'Доски',
                <LayoutDashboard size={15} />,
                current.boards.map((b) => ({ id: b.id, title: b.title })),
                (b) => openTab({ id: `board:${b.id}`, kind: 'board', title: b.title, boardId: b.id }),
                'board:'
              )}
          </>
        )}
      </div>
      <div className="sidebar-foot">
        <button className="btn btn--ghost btn--sm" onClick={() => setTrashOpen(true)}>
          <Trash2 size={16} /> Корзина
        </button>
      </div>
    </aside>
    {propertiesStory && (
      <StoryProperties story={propertiesStory} onClose={() => setPropertiesStory(null)} />
    )}
    {trashOpen && <TrashView onClose={() => setTrashOpen(false)} />}
    </>
  )
}
