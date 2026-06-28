import React from 'react'
import { createPortal } from 'react-dom'
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
  Waypoints,
  LayoutGrid,
  Palette,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  UserRound,
  UserPlus,
  Trees,
  Network
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
import { promptText, confirmDialog, promptStory } from '../shared/ui/dialogs'
import { openContextMenu, type MenuItem } from '../shared/ui/ContextMenu'
import type { Story, Chapter, ChapterStatus, SearchResult, Folder } from '@shared/types'
import { STATUS_LABEL } from '../shared/ui/components'
import { StoryProperties } from '../features/library/StoryProperties'
import { TrashView } from '../features/library/TrashView'
import { openColorPicker } from '../shared/ui/ColorPalette'

export function Sidebar(): React.JSX.Element {
  const {
    current,
    closeProject,
    applyProject,
    openTab,
    activeTabId,
    goToLibraryFolder,
    goToCharacterFolder,
    goToGenealogy
  } = useStore()
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [propertiesStory, setPropertiesStory] = React.useState<Story | null>(null)
  const [trashOpen, setTrashOpen] = React.useState(false)

  const activeChapterTrail = React.useMemo(() => {
    const empty = {
      storyId: null as string | null,
      folderIds: new Set<string>(),
      chapterIds: new Set<string>()
    }
    if (!current || !activeTabId?.startsWith('chapter:')) return empty
    const chapterId = activeTabId.slice('chapter:'.length)
    const story = current.stories.find((item) => item.chapters.some((chapter) => chapter.id === chapterId))
    const chapter = story?.chapters.find((item) => item.id === chapterId)
    if (!story || !chapter) return empty

    const folderIds = new Set<string>()
    const chapterIds = new Set<string>()
    const visitedFolders = new Set<string>()
    const visitedChapters = new Set<string>()

    let folderCursor = story.folderId ?? null
    while (folderCursor && !visitedFolders.has(folderCursor)) {
      visitedFolders.add(folderCursor)
      folderIds.add(folderCursor)
      folderCursor = current.folders.find((folder) => folder.id === folderCursor)?.parentId ?? null
    }

    let chapterCursor = chapter.parentId ?? null
    while (chapterCursor && !visitedChapters.has(chapterCursor)) {
      visitedChapters.add(chapterCursor)
      chapterIds.add(chapterCursor)
      chapterCursor = story.chapters.find((item) => item.id === chapterCursor)?.parentId ?? null
    }

    return { storyId: story.id, folderIds, chapterIds }
  }, [activeTabId, current])

  React.useEffect(() => {
    if (!current || !activeChapterTrail.storyId) return
    setExpanded((prev) => {
      let changed = false
      const next = { ...prev, [activeChapterTrail.storyId!]: true }
      if (!prev[activeChapterTrail.storyId!]) changed = true

      activeChapterTrail.folderIds.forEach((id) => {
        const key = `folder:${id}`
        if (!prev[key]) changed = true
        next[key] = true
      })
      activeChapterTrail.chapterIds.forEach((id) => {
        const key = `chapter:${id}`
        if (!prev[key]) changed = true
        next[key] = true
      })

      return changed ? next : prev
    })
  }, [activeChapterTrail, current])

  if (!current) return <aside className="sidebar" />

  const dragPortal = typeof document === 'undefined' ? null : document.body
  const renderDragPortal = (node: React.JSX.Element, isDragging: boolean): React.ReactNode =>
    isDragging && dragPortal ? createPortal(node, dragPortal) : node

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

  // верхняя «+»: спросить название + папку (S-G1)
  const addStoryWithPicker = async (): Promise<void> => {
    const res = await promptStory({
      title: 'Новая история',
      placeholder: 'Название истории',
      folders: current.folders ?? []
    })
    if (!res || !res.title) return
    applyProject(
      await window.api.stories.add({ projectId: current.id, title: res.title, folderId: res.folderId })
    )
    if (res.folderId) setExpanded((e) => ({ ...e, [`folder:${res.folderId}`]: true }))
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

  const storyDropId = (folderId: string | null): string => `stories:${folderId ?? 'root'}`
  const folderDropId = (parentId: string | null): string => `folders:${parentId ?? 'root'}`
  const characterFolderDropId = (parentId: string | null): string => `character-folders:${parentId ?? 'root'}`
  const characterDropId = (folderId: string | null): string => `characters:${folderId ?? 'root'}`

  const parseFolderDropId = (
    droppableId: string
  ): { kind: 'story' | 'character'; parentId: string | null } | null => {
    if (droppableId.startsWith('character-folders:')) {
      const parentId = droppableId.slice('character-folders:'.length)
      return { kind: 'character', parentId: parentId === 'root' ? null : parentId }
    }
    if (droppableId.startsWith('folders:')) {
      const parentId = droppableId.slice('folders:'.length)
      return { kind: 'story', parentId: parentId === 'root' ? null : parentId }
    }
    return null
  }

  const parseChapterDropId = (droppableId: string): { storyId: string; parentId: string | null } | null => {
    const [, storyId, parentId] = droppableId.split(':')
    if (!droppableId.startsWith('chapters:') || !storyId) return null
    return { storyId, parentId: parentId === 'root' ? null : parentId }
  }

  const parseStoryDropId = (droppableId: string): { folderId: string | null } | null => {
    if (!droppableId.startsWith('stories:')) return null
    const folderId = droppableId.slice('stories:'.length)
    return { folderId: folderId === 'root' ? null : folderId }
  }

  const parseCharacterDropId = (droppableId: string): { folderId: string | null } | null => {
    if (!droppableId.startsWith('characters:')) return null
    const folderId = droppableId.slice('characters:'.length)
    return { folderId: folderId === 'root' ? null : folderId }
  }

  const reorderSidebarItems = async (result: DropResult): Promise<void> => {
    const { source, destination } = result
    if (!destination || source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return

    const storyDrop = parseStoryDropId(source.droppableId)
    if (storyDrop) {
      const order = folderStories(storyDrop.folderId).map((story) => story.id)
      const [moved] = order.splice(source.index, 1)
      order.splice(destination.index, 0, moved)
      applyProject(
        await window.api.stories.reorder({
          projectId: current.id,
          folderId: storyDrop.folderId,
          order
        })
      )
      return
    }

    const folderDrop = parseFolderDropId(source.droppableId)
    if (folderDrop) {
      const siblings =
        folderDrop.kind === 'story'
          ? childFolders(folderDrop.parentId)
          : childCharacterFolders(folderDrop.parentId)
      const order = siblings.map((folder) => folder.id)
      const [moved] = order.splice(source.index, 1)
      order.splice(destination.index, 0, moved)
      applyProject(
        folderDrop.kind === 'story'
          ? await window.api.folders.reorder({ projectId: current.id, parentId: folderDrop.parentId, order })
          : await window.api.characterFolders.reorder({
              projectId: current.id,
              parentId: folderDrop.parentId,
              order
            })
      )
      return
    }

    const characterDrop = parseCharacterDropId(source.droppableId)
    if (characterDrop) {
      const order = charsInFolder(characterDrop.folderId).map((character) => character.id)
      const [moved] = order.splice(source.index, 1)
      order.splice(destination.index, 0, moved)
      applyProject(
        await window.api.characters.reorder({
          projectId: current.id,
          folderId: characterDrop.folderId,
          order
        })
      )
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

  const shiftedOrder = <T extends { id: string }>(items: T[], id: string, offset: -1 | 1): string[] | null => {
    const order = items.map((item) => item.id)
    const index = order.indexOf(id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= order.length) return null
    ;[order[index], order[target]] = [order[target], order[index]]
    return order
  }

  const moveStoryInFolder = async (story: Story, offset: -1 | 1): Promise<void> => {
    const order = shiftedOrder(folderStories(story.folderId ?? null), story.id, offset)
    if (!order) return
    applyProject(
      await window.api.stories.reorder({
        projectId: current.id,
        folderId: story.folderId ?? null,
        order
      })
    )
  }

  const moveFolderAmongSiblings = async (folder: Folder, offset: -1 | 1): Promise<void> => {
    const order = shiftedOrder(childFolders(folder.parentId ?? null), folder.id, offset)
    if (!order) return
    applyProject(
      await window.api.folders.reorder({ projectId: current.id, parentId: folder.parentId ?? null, order })
    )
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
    {
      label: 'Цвет книги',
      icon: <Palette size={15} />,
      onClick: () =>
        openColorPicker({ value: s.color ?? '#8b8cf0', title: 'Цвет книги', onChange: (c) => setStoryColor(s, c) })
    },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameStory(s) },
    {
      label: 'Выше',
      icon: <ArrowUp size={15} />,
      disabled: folderStories(s.folderId ?? null)[0]?.id === s.id,
      onClick: () => moveStoryInFolder(s, -1)
    },
    {
      label: 'Ниже',
      icon: <ArrowDown size={15} />,
      disabled: folderStories(s.folderId ?? null).at(-1)?.id === s.id,
      onClick: () => moveStoryInFolder(s, 1)
    },
    { type: 'sep' },
    { label: 'Удалить историю', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteStory(s) }
  ]

  const folderMenu = (f: Folder): MenuItem[] => [
    { label: 'Открыть в библиотеке', icon: <ArrowRight size={15} />, onClick: () => goToLibraryFolder(f.id) },
    { label: 'Новая подпапка', icon: <FolderPlus size={15} />, onClick: () => addFolder(f.id) },
    { label: 'Новая история здесь', icon: <Plus size={15} />, onClick: () => addStory(f.id) },
    {
      label: 'Цвет папки',
      icon: <Palette size={15} />,
      onClick: () =>
        openColorPicker({ value: f.color ?? '#f0b84b', title: 'Цвет папки', onChange: (c) => setFolderColor(f, c) })
    },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameFolder(f) },
    {
      label: 'Выше',
      icon: <ArrowUp size={15} />,
      disabled: childFolders(f.parentId ?? null)[0]?.id === f.id,
      onClick: () => moveFolderAmongSiblings(f, -1)
    },
    {
      label: 'Ниже',
      icon: <ArrowDown size={15} />,
      disabled: childFolders(f.parentId ?? null).at(-1)?.id === f.id,
      onClick: () => moveFolderAmongSiblings(f, 1)
    },
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
          } ${activeChapterTrail.chapterIds.has(c.id) ? 'tree-row--ancestor' : ''} ${
            isDragging ? 'tree-chapter--dragging' : ''
          }`}
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

  // Тело истории (строка + главы) переиспользуется в корне и внутри папок.
  const renderStoryBody = (
    s: Story,
    storyDragHandle: DraggableProvidedDragHandleProps | null | undefined,
    isDragging = false
  ): React.JSX.Element => (
    <>
      <div
        className={`tree-row ${activeChapterTrail.storyId === s.id ? 'tree-row--ancestor' : ''}`}
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
        <span className="faint" style={{ fontSize: 12 }}>
          {s.chapters.filter((c) => !c.deletedAt).length}
        </span>
      </div>
      {(s.tags.length > 0 || s.genres.length > 0) && (
        <div style={{ padding: '0 8px 4px 30px' }}>
          <Hashtags tags={[...s.tags, ...s.genres]} />
        </div>
      )}
      {expanded[s.id] && !isDragging && (
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
                          } ${activeChapterTrail.chapterIds.has(c.id) ? 'tree-row--ancestor' : ''} ${
                            snapshot.isDragging ? 'tree-chapter--dragging' : ''
                          }`}
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

  const renderStoryGroup = (folderId: string | null): React.JSX.Element => (
    <Droppable droppableId={storyDropId(folderId)} type="story">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {folderStories(folderId).map((story, index) => (
            <Draggable draggableId={`story:${story.id}`} index={index} key={story.id}>
              {(storyDrag, storySnapshot) => {
                const node = (
                  <div
                    ref={storyDrag.innerRef}
                    {...storyDrag.draggableProps}
                    className={`tree-node ${storySnapshot.isDragging ? 'tree-node--dragging' : ''}`}
                  >
                    {renderStoryBody(story, storyDrag.dragHandleProps, storySnapshot.isDragging)}
                  </div>
                )
                return renderDragPortal(node, storySnapshot.isDragging)
              }}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )

  const renderFolder = (
    f: Folder,
    depth: number,
    dragHandleProps: DraggableProvidedDragHandleProps | null | undefined,
    isDragging: boolean
  ): React.JSX.Element => {
    const key = `folder:${f.id}`
    const isOpen = expanded[key] ?? false
    const subfolders = childFolders(f.id)
    const stories = folderStories(f.id)
    return (
      <div className="tree-node" key={f.id}>
        <div
          className={`tree-row ${activeChapterTrail.folderIds.has(f.id) ? 'tree-row--ancestor' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => toggle(key)}
          onContextMenu={(e) => openContextMenu(e, folderMenu(f))}
        >
          <span
            className="tree-drag-handle"
            title="Изменить порядок папки"
            {...dragHandleProps}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical size={14} />
          </span>
          <span className={`chev ${isOpen ? 'chev--open' : ''}`}>
            <ChevronRight size={15} />
          </span>
          <FolderIcon size={15} fill={f.color ?? '#f0b84b'} style={{ color: f.color ?? '#f0b84b' }} />
          <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
            {f.title}
          </span>
          <button
            className="tree-goto"
            title="Открыть папку в библиотеке"
            onClick={(e) => {
              e.stopPropagation()
              goToLibraryFolder(f.id)
            }}
          >
            <ArrowRight size={14} />
          </button>
          <span className="faint" style={{ fontSize: 12 }}>
            {stories.length}
          </span>
        </div>
        {isOpen && !isDragging && (
          <div className="tree-children">
            {renderFolderGroup(f.id, depth + 1)}
            {renderStoryGroup(f.id)}
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

  const renderFolderGroup = (parentId: string | null, depth: number): React.JSX.Element => (
    <Droppable droppableId={folderDropId(parentId)} type="folder">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {childFolders(parentId).map((folder, index) => (
            <Draggable draggableId={`folder:${folder.id}`} index={index} key={folder.id}>
              {(dragProvided, snapshot) => {
                const node = (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    className={snapshot.isDragging ? 'tree-node--dragging' : undefined}
                  >
                    {renderFolder(folder, depth, dragProvided.dragHandleProps, snapshot.isDragging)}
                  </div>
                )
                return renderDragPortal(node, snapshot.isDragging)
              }}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )

  // S-F8: дерево персонажей по папкам в сайдбаре
  const childCharacterFolders = (parentId: string | null): Folder[] =>
    ((current.characterFolders ?? []) as Folder[])
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => a.order - b.order)
  const charsInFolder = (folderId: string | null): typeof current.characters =>
    current.characters
      .filter((c) => (c.folderId ?? null) === folderId)
      .sort((a, b) => a.order - b.order)

  const moveCharacterAmongSiblings = async (
    character: (typeof current.characters)[number],
    offset: -1 | 1
  ): Promise<void> => {
    const folderId = character.folderId ?? null
    const order = shiftedOrder(charsInFolder(folderId), character.id, offset)
    if (!order) return
    applyProject(await window.api.characters.reorder({ projectId: current.id, folderId, order }))
  }

  const moveCharacterFolderAmongSiblings = async (folder: Folder, offset: -1 | 1): Promise<void> => {
    const parentId = folder.parentId ?? null
    const order = shiftedOrder(childCharacterFolders(parentId), folder.id, offset)
    if (!order) return
    applyProject(await window.api.characterFolders.reorder({ projectId: current.id, parentId, order }))
  }
  const openCharacterPage = (c: (typeof current.characters)[number]): void =>
    openTab({ id: `character:${c.id}`, kind: 'character', title: c.name || 'Без имени', characterId: c.id })

  // ----- Родословные (в дереве персонажей, внутри папок) -----
  const genealogiesIn = (folderId: string | null): typeof current.genealogies =>
    (current.genealogies ?? []).filter((g) => (g.folderId ?? null) === folderId)
  const addGenealogyToFolder = async (folderId: string | null): Promise<void> => {
    const title = await promptText({ title: 'Новая родословная', placeholder: 'Например: род Морейн' })
    if (!title) return
    const p = await window.api.genealogies.add({ projectId: current.id, title, folderId })
    applyProject(p)
    const created = p?.genealogies[p.genealogies.length - 1]
    if (created) goToGenealogy(created.id)
  }
  const renderGenealogyRows = (folderId: string | null, depth: number): React.JSX.Element[] =>
    genealogiesIn(folderId).map((g) => (
      <div
        key={g.id}
        className="tree-row tree-chapter"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => goToGenealogy(g.id)}
        onContextMenu={(event) =>
          openContextMenu(event, [
            {
              label: 'Переименовать',
              icon: <Pencil size={15} />,
              onClick: async () => {
                const title = await promptText({ title: 'Переименовать родословную', initial: g.title })
                if (title && title !== g.title)
                  applyProject(
                    await window.api.genealogies.rename({ projectId: current.id, genealogyId: g.id, title })
                  )
              }
            },
            {
              label: 'Удалить',
              icon: <Trash2 size={15} />,
              danger: true,
              onClick: async () => {
                if (!(await confirmDialog({ title: `Удалить родословную «${g.title}»?`, danger: true }))) return
                applyProject(await window.api.genealogies.delete({ projectId: current.id, genealogyId: g.id }))
              }
            }
          ])
        }
      >
        <span style={{ width: 15 }} />
        <Trees size={14} style={{ color: '#5ec8a0' }} />
        <span className="truncate" style={{ flex: 1 }}>
          {g.title}
        </span>
      </div>
    ))

  const renameCharacter = async (c: (typeof current.characters)[number]): Promise<void> => {
    if (!current) return
    const name = await promptText({ title: 'Переименовать персонажа', initial: c.name })
    if (name == null || !name.trim()) return
    applyProject(
      await window.api.characters.update({
        projectId: current.id,
        characterId: c.id,
        patch: { name: name.trim() }
      })
    )
  }
  const deleteCharacter = async (c: (typeof current.characters)[number]): Promise<void> => {
    if (!current) return
    if (!(await confirmDialog({ title: `Удалить персонажа «${c.name || 'Без имени'}»?`, danger: true }))) return
    applyProject(await window.api.characters.delete({ projectId: current.id, characterId: c.id }))
  }
  const addCharacterToFolder = async (folderId: string | null): Promise<void> => {
    if (!current) return
    const name = await promptText({ title: 'Новый персонаж', placeholder: 'Имя' })
    if (name == null) return
    const p = await window.api.characters.add({
      projectId: current.id,
      name: name.trim() || 'Новый персонаж',
      folderId
    })
    applyProject(p)
    const created = p?.characters[p.characters.length - 1]
    if (created) openCharacterPage(created)
  }
  const renameCharacterFolder = async (f: Folder): Promise<void> => {
    if (!current) return
    const title = await promptText({ title: 'Переименовать папку', initial: f.title })
    if (!title || !title.trim()) return
    applyProject(
      await window.api.characterFolders.update({
        projectId: current.id,
        folderId: f.id,
        patch: { title: title.trim() }
      })
    )
  }
  const deleteCharacterFolder = async (f: Folder): Promise<void> => {
    if (!current) return
    if (
      !(await confirmDialog({
        title: `Удалить папку «${f.title}»?`,
        message: 'Персонажи из папки не удаляются — они останутся без папки.',
        confirmLabel: 'Удалить',
        danger: true
      }))
    )
      return
    applyProject(await window.api.characterFolders.delete({ projectId: current.id, folderId: f.id }))
  }

  const renderCharacterRow = (
    c: (typeof current.characters)[number],
    depth: number,
    dragHandleProps: DraggableProvidedDragHandleProps | null | undefined
  ): React.JSX.Element => (
    <div
      key={c.id}
      className={`tree-row tree-chapter ${activeTabId === `character:${c.id}` ? 'tree-row--active' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => openCharacterPage(c)}
      onContextMenu={(event) =>
        openContextMenu(event, [
          {
            label: 'Выше',
            icon: <ArrowUp size={15} />,
            disabled: charsInFolder(c.folderId ?? null)[0]?.id === c.id,
            onClick: () => moveCharacterAmongSiblings(c, -1)
          },
          {
            label: 'Ниже',
            icon: <ArrowDown size={15} />,
            disabled: charsInFolder(c.folderId ?? null).at(-1)?.id === c.id,
            onClick: () => moveCharacterAmongSiblings(c, 1)
          },
          { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameCharacter(c) },
          { label: 'Удалить', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteCharacter(c) }
        ])
      }
    >
      <span
        className="tree-drag-handle"
        title="Изменить порядок персонажа"
        {...dragHandleProps}
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical size={14} />
      </span>
      <UserRound size={14} style={{ color: c.color ?? '#7aa2f7' }} />
      <span className="truncate" style={{ flex: 1 }}>
        {c.name || 'Без имени'}
      </span>
    </div>
  )

  const renderCharacterGroup = (folderId: string | null, depth: number): React.JSX.Element => (
    <Droppable droppableId={characterDropId(folderId)} type="character">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {charsInFolder(folderId).map((character, index) => (
            <Draggable draggableId={`character:${character.id}`} index={index} key={character.id}>
              {(dragProvided, snapshot) => (
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  className={snapshot.isDragging ? 'tree-node--dragging' : undefined}
                >
                  {renderCharacterRow(character, depth, dragProvided.dragHandleProps)}
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )

  const renderCharacterFolder = (
    f: Folder,
    depth: number,
    dragHandleProps: DraggableProvidedDragHandleProps | null | undefined,
    isDragging: boolean
  ): React.JSX.Element => {
    const key = `cfolder:${f.id}`
    const isOpen = expanded[key] ?? false
    const subs = childCharacterFolders(f.id)
    const chars = charsInFolder(f.id)
    return (
      <div className="tree-node" key={f.id}>
        <div
          className="tree-row"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => toggle(key)}
          onContextMenu={(event) =>
            openContextMenu(event, [
              {
                label: 'Добавить персонажа',
                icon: <UserPlus size={15} />,
                onClick: () => addCharacterToFolder(f.id)
              },
              {
                label: 'Добавить родословную',
                icon: <Trees size={15} />,
                onClick: () => addGenealogyToFolder(f.id)
              },
              {
                label: 'Выше',
                icon: <ArrowUp size={15} />,
                disabled: childCharacterFolders(f.parentId ?? null)[0]?.id === f.id,
                onClick: () => moveCharacterFolderAmongSiblings(f, -1)
              },
              {
                label: 'Ниже',
                icon: <ArrowDown size={15} />,
                disabled: childCharacterFolders(f.parentId ?? null).at(-1)?.id === f.id,
                onClick: () => moveCharacterFolderAmongSiblings(f, 1)
              },
              { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameCharacterFolder(f) },
              {
                label: 'Удалить папку',
                icon: <Trash2 size={15} />,
                danger: true,
                onClick: () => deleteCharacterFolder(f)
              }
            ])
          }
        >
          <span
            className="tree-drag-handle"
            title="Изменить порядок папки персонажей"
            {...dragHandleProps}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical size={14} />
          </span>
          <span className={`chev ${isOpen ? 'chev--open' : ''}`}>
            <ChevronRight size={15} />
          </span>
          <FolderIcon size={15} fill={f.color ?? '#f0b84b'} style={{ color: f.color ?? '#f0b84b' }} />
          <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
            {f.title}
          </span>
          <button
            className="tree-goto"
            title="Открыть папку персонажей"
            onClick={(event) => {
              event.stopPropagation()
              goToCharacterFolder(f.id)
            }}
          >
            <ArrowRight size={14} />
          </button>
          <span className="faint" style={{ fontSize: 12 }}>
            {chars.length}
          </span>
        </div>
        {isOpen && !isDragging && (
          <div className="tree-children">
            {renderCharacterFolderGroup(f.id, depth + 1)}
            {renderCharacterGroup(f.id, depth + 1)}
            {renderGenealogyRows(f.id, depth + 1)}
          </div>
        )}
      </div>
    )
  }

  const renderCharacterFolderGroup = (parentId: string | null, depth: number): React.JSX.Element => (
    <Droppable droppableId={characterFolderDropId(parentId)} type="character-folder">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          {childCharacterFolders(parentId).map((folder, index) => (
            <Draggable draggableId={`character-folder:${folder.id}`} index={index} key={folder.id}>
              {(dragProvided, snapshot) => (
                <div
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  className={snapshot.isDragging ? 'tree-node--dragging' : undefined}
                >
                  {renderCharacterFolder(folder, depth, dragProvided.dragHandleProps, snapshot.isDragging)}
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )

  // S-D4: аддитивная сворачиваемая навигация по разделам проекта (под деревом историй)
  const renderNavSection = (
    key: string,
    label: string,
    icon: React.JSX.Element,
    items: { id: string; title: string }[],
    open: (item: { id: string; title: string }) => void,
    activePrefix: string,
    move: (item: { id: string; title: string }, offset: -1 | 1) => void
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
                onContextMenu={(event) =>
                  openContextMenu(event, [
                    {
                      label: 'Выше',
                      icon: <ArrowUp size={15} />,
                      disabled: items[0]?.id === it.id,
                      onClick: () => move(it, -1)
                    },
                    {
                      label: 'Ниже',
                      icon: <ArrowDown size={15} />,
                      disabled: items.at(-1)?.id === it.id,
                      onClick: () => move(it, 1)
                    }
                  ])
                }
              >
                {icon}
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

  const orderedTimelines = [...current.timelines].sort((a, b) => a.order - b.order)
  const orderedBoards = [...current.boards].sort((a, b) => a.order - b.order)

  // Раздел «Деревья» (Hierarchy) — вынесен из таймлайна, отдельная сущность
  const renderHierarchySection = (): React.JSX.Element | null => {
    const items = current.hierarchies ?? []
    if (!items.length) return null
    const isOpen = expanded['sec:hierarchies'] ?? false
    return (
      <div className="tree-node" key="sec:hierarchies">
        <div className="tree-row" onClick={() => toggle('sec:hierarchies')}>
          <span className={`chev ${isOpen ? 'chev--open' : ''}`}>
            <ChevronRight size={15} />
          </span>
          <Network size={15} />
          <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
            Деревья
          </span>
          <span className="faint" style={{ fontSize: 12 }}>
            {items.length}
          </span>
        </div>
        {isOpen && (
          <div className="tree-children">
            {items.map((h) => (
              <div
                key={h.id}
                className={`tree-row tree-chapter ${activeTabId === `hierarchy:${h.id}` ? 'tree-row--active' : ''}`}
                onClick={() =>
                  openTab({ id: `hierarchy:${h.id}`, kind: 'hierarchy', title: h.title, hierarchyId: h.id })
                }
                onContextMenu={(e) =>
                  openContextMenu(e, [
                    {
                      label: 'Переименовать',
                      icon: <Pencil size={15} />,
                      onClick: async () => {
                        const title = await promptText({ title: 'Переименовать дерево', initial: h.title })
                        if (title && title !== h.title)
                          applyProject(
                            await window.api.hierarchies.rename({ projectId: current.id, hierarchyId: h.id, title })
                          )
                      }
                    },
                    {
                      label: 'Удалить',
                      icon: <Trash2 size={15} />,
                      danger: true,
                      onClick: async () => {
                        if (!(await confirmDialog({ title: `Удалить дерево «${h.title}»?`, danger: true }))) return
                        applyProject(
                          await window.api.hierarchies.delete({ projectId: current.id, hierarchyId: h.id })
                        )
                      }
                    }
                  ])
                }
              >
                <Network size={14} />
                <span className="truncate" style={{ flex: 1 }}>
                  {h.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const moveTimeline = async (item: { id: string }, offset: -1 | 1): Promise<void> => {
    const order = shiftedOrder(orderedTimelines, item.id, offset)
    if (!order) return
    applyProject(await window.api.timelines.reorder({ projectId: current.id, order }))
  }

  const moveBoard = async (item: { id: string }, offset: -1 | 1): Promise<void> => {
    const order = shiftedOrder(orderedBoards, item.id, offset)
    if (!order) return
    applyProject(await window.api.boards.reorder({ projectId: current.id, order }))
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
                  onClick={addStoryWithPicker}
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
              {renderFolderGroup(null, 0)}
              {renderStoryGroup(null)}
            </DragDropContext>

            <div className="tree-section-title" style={{ marginTop: 8 }}>
              Разделы проекта
            </div>
            <div className="tree-node">
              <div className="tree-row" onClick={() => toggle('sec:characters')}>
                <span className={`chev ${expanded['sec:characters'] ? 'chev--open' : ''}`}>
                  <ChevronRight size={15} />
                </span>
                <Users size={15} />
                <span className="truncate" style={{ flex: 1, fontWeight: 600 }}>
                  Персонажи
                </span>
                <button
                  className="tree-goto"
                  title="Открыть раздел персонажей"
                  onClick={(e) => {
                    e.stopPropagation()
                    openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })
                  }}
                >
                  <ArrowRight size={14} />
                </button>
                <span className="faint" style={{ fontSize: 12 }}>
                  {current.characters.length}
                </span>
              </div>
              {expanded['sec:characters'] && (
                <div className="tree-children">
                  <DragDropContext onDragEnd={reorderSidebarItems}>
                    {renderCharacterFolderGroup(null, 0)}
                    {renderCharacterGroup(null, 0)}
                    {renderGenealogyRows(null, 0)}
                    {current.characters.length === 0 && (
                      <div className="dim" style={{ padding: '4px 10px', fontSize: 12 }}>
                        Пока нет персонажей.
                      </div>
                    )}
                  </DragDropContext>
                </div>
              )}
            </div>
            {current.timelines.length > 0 &&
              renderNavSection(
                'sec:timelines',
                'Таймлайны',
                <Waypoints size={15} />,
                orderedTimelines.map((t) => ({ id: t.id, title: t.title })),
                (t) => openTab({ id: `timeline:${t.id}`, kind: 'timeline', title: t.title, timelineId: t.id }),
                'timeline:',
                moveTimeline
              )}
            {current.boards.length > 0 &&
              renderNavSection(
                'sec:boards',
                'Доски',
                <LayoutGrid size={15} />,
                orderedBoards.map((b) => ({ id: b.id, title: b.title })),
                (b) => openTab({ id: `board:${b.id}`, kind: 'board', title: b.title, boardId: b.id }),
                'board:',
                moveBoard
              )}
            {renderHierarchySection()}
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
