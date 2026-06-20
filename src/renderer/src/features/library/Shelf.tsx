import React from 'react'
import {
  BookOpen,
  BookPlus,
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  FileText,
  Search,
  LayoutDashboard,
  Clock3,
  Plus,
  Trash2,
  Users
} from 'lucide-react'
import { useStore } from '../../store/store'
import { Button, Hashtags, Input, StatusBadge } from '../../shared/ui/components'
import { promptText, confirmDialog } from '../../shared/ui/dialogs'
import { CoverArt } from './CoverArt'
import type { Folder, Story } from '@shared/types'
import { ColorPalette } from '../../shared/ui/ColorPalette'
import { ContinueWriting } from './ContinueWriting'
import { pl, plural } from '../../shared/plural'

type SortMode = 'updated' | 'title'

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'только что'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${pl(minutes, 'минуту', 'минуты', 'минут')} назад`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${pl(hours, 'час', 'часа', 'часов')} назад`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${pl(days, 'день', 'дня', 'дней')} назад`
  const months = Math.floor(days / 30)
  if (months < 12) return `${pl(months, 'месяц', 'месяца', 'месяцев')} назад`
  const years = Math.max(1, Math.floor(days / 365))
  return `${pl(years, 'год', 'года', 'лет')} назад`
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function Shelf(): React.JSX.Element {
  const { current, applyProject, openTab, libraryFolderId, libraryFolderNonce } = useStore()
  const [folderId, setFolderId] = React.useState<string | null>(libraryFolderId)
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<SortMode>('updated')

  // S-F11: переход в папку из сайдбара («→ перейти»)
  React.useEffect(() => {
    setFolderId(libraryFolderId)
    setQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryFolderNonce])
  const [storiesOpen, setStoriesOpen] = React.useState(true)

  React.useEffect(() => setStoriesOpen(true), [query, folderId])

  if (!current) return <div />

  const activeStories = current.stories.filter((story) => !story.deletedAt)
  const folders = current.folders ?? []
  const selectedFolder = folders.find((folder) => folder.id === folderId) ?? null
  const childFolders = folders
    .filter((folder) => folder.parentId === folderId)
    .sort((a, b) => a.order - b.order)

  const folderPath = (): Folder[] => {
    const path: Folder[] = []
    const visited = new Set<string>()
    let cursor = selectedFolder
    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id)
      path.unshift(cursor)
      cursor = folders.find((folder) => folder.id === cursor?.parentId) ?? null
    }
    return path
  }

  const descendantIds = (rootId: string): Set<string> => {
    const ids = new Set<string>([rootId])
    let changed = true
    while (changed) {
      changed = false
      for (const folder of folders) {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id)
          changed = true
        }
      }
    }
    return ids
  }

  const storyCountInFolder = (id: string): number => {
    const ids = descendantIds(id)
    return activeStories.filter((story) => story.folderId && ids.has(story.folderId)).length
  }

  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const visibleStories = activeStories
    .filter((story) => {
      if (normalizedQuery) {
        return `${story.title} ${story.synopsis} ${story.tags.join(' ')} ${story.genres.join(' ')}`
          .toLocaleLowerCase('ru')
          .includes(normalizedQuery)
      }
      return folderId === null || (story.folderId ?? null) === folderId
    })
    .sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title, 'ru')
        : b.updatedAt - a.updatedAt
    )

  const addStory = async (): Promise<void> => {
    const title = await promptText({ title: 'Новая история', placeholder: 'Название истории' })
    if (!title) return
    applyProject(await window.api.stories.add({ projectId: current.id, title, folderId }))
  }

  const addFolder = async (): Promise<void> => {
    const title = await promptText({
      title: selectedFolder ? 'Новая подпапка' : 'Новая папка',
      placeholder: 'Название папки'
    })
    if (!title) return
    applyProject(await window.api.folders.add({ projectId: current.id, title, parentId: folderId }))
  }

  const dropCover = async (story: Story, dataUrl: string): Promise<void> => {
    applyProject(await window.api.stories.setCover({
      projectId: current.id,
      storyId: story.id,
      source: dataUrl,
      isDataUrl: true
    }))
  }

  const pickCover = async (story: Story): Promise<void> => {
    applyProject(await window.api.stories.pickCover({ projectId: current.id, storyId: story.id }))
  }

  const setStoryColor = async (story: Story, color: string): Promise<void> => {
    applyProject(await window.api.stories.update({
      projectId: current.id,
      storyId: story.id,
      patch: { color }
    }))
  }

  const setFolderColor = async (folder: Folder, color: string): Promise<void> => {
    applyProject(await window.api.folders.setColor({ projectId: current.id, folderId: folder.id, color }))
  }

  const openStory = async (story: Story): Promise<void> => {
    const active = story.chapters
      .filter((chapter) => !chapter.deletedAt)
      .sort((a, b) => a.order - b.order)
    // S-F2: открываем историю на последней просмотренной главе (контрольная точка истории)
    const lastId = localStorage.getItem(`fancreator.lastChapter.${story.id}`)
    const first = active.find((c) => c.id === lastId) ?? active[0]
    if (first) {
      openTab({
        id: `chapter:${first.id}`,
        kind: 'chapter',
        title: first.title || 'Без названия',
        storyId: story.id,
        chapterId: first.id
      })
      return
    }
    const project = await window.api.chapters.add({
      projectId: current.id,
      storyId: story.id,
      title: 'Глава 1'
    })
    applyProject(project)
    const chapter = project?.stories.find((item) => item.id === story.id)?.chapters.at(-1)
    if (chapter) {
      openTab({ id: `chapter:${chapter.id}`, kind: 'chapter', title: chapter.title, storyId: story.id, chapterId: chapter.id })
    }
  }

  // ----- Материалы проекта (доски / таймлайны / иерархии) -----
  const addBoard = async (): Promise<void> => {
    const title = await promptText({ title: 'Новая доска', placeholder: 'Название доски' })
    if (!title) return
    const p = await window.api.boards.add({ projectId: current.id, title })
    applyProject(p)
    const b = p?.boards.at(-1)
    if (b) openTab({ id: `board:${b.id}`, kind: 'board', title: b.title, boardId: b.id })
  }
  const addTimeline = async (): Promise<void> => {
    const title = await promptText({ title: 'Новый таймлайн', placeholder: 'Название таймлайна' })
    if (!title) return
    const p = await window.api.timelines.add({ projectId: current.id, title })
    applyProject(p)
    const t = p?.timelines.at(-1)
    if (t) openTab({ id: `timeline:${t.id}`, kind: 'timeline', title: t.title, timelineId: t.id })
  }
  const removeBoard = async (id: string, title: string): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить доску «${title}»?`, message: 'Все элементы и связи на доске будут удалены.', danger: true, confirmLabel: 'Удалить' }))) return
    applyProject(await window.api.boards.delete({ projectId: current.id, boardId: id }))
  }
  const removeTimeline = async (id: string, title: string): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить таймлайн «${title}»?`, message: 'Все события таймлайна будут удалены.', danger: true, confirmLabel: 'Удалить' }))) return
    applyProject(await window.api.timelines.delete({ projectId: current.id, timelineId: id }))
  }
  const totalWords = activeStories.reduce(
    (sum, story) => sum + story.chapters
      .filter((chapter) => !chapter.deletedAt)
      .reduce((chapterSum, chapter) => chapterSum + chapter.wordCount, 0),
    0
  )

  return (
    <div className="shelf library-workspace" data-tour="library">
      <div className="shelf-inner">
        <header className="library-header">
          <div>
            <div className="home-title">{current.title}</div>
            <div className="home-sub">Рабочая библиотека проекта</div>
          </div>
          <div className="library-header-actions">
            <Button variant="soft" onClick={addFolder}>
              <FolderPlus size={17} /> {selectedFolder ? 'Подпапка' : 'Папка'}
            </Button>
            <Button variant="primary" onClick={addStory}>
              <BookPlus size={17} /> Новая история
            </Button>
          </div>
        </header>

        <div className="library-summary">
          <div><strong>{activeStories.length}</strong><span>{plural(activeStories.length, 'история', 'истории', 'историй')}</span></div>
          <div><strong>{folders.length}</strong><span>{plural(folders.length, 'папка', 'папки', 'папок')}</span></div>
          <div><strong>{totalWords.toLocaleString('ru-RU')}</strong><span>{plural(totalWords, 'слово', 'слова', 'слов')}</span></div>
        </div>

        {!normalizedQuery && !selectedFolder && <ContinueWriting />}

        <div className="library-controls">
          <div className="library-breadcrumbs" aria-label="Путь к папке">
            <button className={!selectedFolder ? 'is-current' : ''} onClick={() => { setFolderId(null); setQuery('') }}>
              Библиотека
            </button>
            {folderPath().map((folder, index, path) => (
              <React.Fragment key={folder.id}>
                <ChevronRight size={14} />
                <button className={index === path.length - 1 ? 'is-current' : ''} onClick={() => { setFolderId(folder.id); setQuery('') }}>
                  {folder.title}
                </button>
              </React.Fragment>
            ))}
          </div>
          <div className="library-tools">
            <Input icon={<Search size={15} />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти историю…" />
            <select className="input library-sort" value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Сортировка">
              <option value="updated">Сначала недавние</option>
              <option value="title">По названию</option>
            </select>
          </div>
        </div>

        {!normalizedQuery && childFolders.length > 0 && (
          <section className="library-section">
            <h2>Папки</h2>
            <div className="library-folder-grid">
              {childFolders.map((folder) => (
                <div className="library-folder-card" role="button" tabIndex={0} key={folder.id}
                  onClick={() => setFolderId(folder.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setFolderId(folder.id) }}>
                  <span className="library-folder-icon" style={{ color: folder.color ?? '#f0b84b' }}>
                    <FolderIcon size={30} fill="currentColor" />
                  </span>
                  <span className="library-folder-copy">
                    <strong>{folder.title}</strong>
                    <small>{plural(storyCountInFolder(folder.id), 'история', 'истории', 'историй')}</small>
                  </span>
                  <ColorPalette value={folder.color ?? '#f0b84b'} title="Цвет папки" onChange={(color) => setFolderColor(folder, color)} />
                  <ChevronRight size={17} className="library-folder-arrow" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="library-section">
          <div className="library-section-head">
            <button
              className="library-section-toggle"
              aria-expanded={storiesOpen}
              onClick={() => setStoriesOpen((open) => !open)}
            >
              <ChevronRight size={15} className={storiesOpen ? 'is-open' : ''} />
              <h2>{normalizedQuery ? 'Результаты поиска' : selectedFolder ? 'Истории в папке' : 'Все истории'}</h2>
            </button>
            <span>{visibleStories.length}</span>
          </div>
          {storiesOpen && (visibleStories.length > 0 ? (
            <div className="library-story-grid">
              {visibleStories.map((story) => {
                const chapters = story.chapters.filter((chapter) => !chapter.deletedAt)
                const done = chapters.filter((chapter) => chapter.status === 'done').length
                const words = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
                return (
                  <article className="library-story-card" key={story.id}>
                    <div className="library-story-cover">
                      <CoverArt title={story.title} coverPath={story.coverPath} color={story.color}
                        onClick={() => openStory(story)} onDropImage={(data) => dropCover(story, data)} onPick={() => pickCover(story)} />
                    </div>
                    <div className="library-story-body">
                      <div className="library-story-heading">
                        <button onClick={() => openStory(story)}>{story.title}</button>
                        <ColorPalette value={story.color ?? '#8b8cf0'} title="Цвет книги" onChange={(color) => setStoryColor(story, color)} />
                      </div>
                      <StatusBadge status={story.status} />
                      <p>{story.synopsis || 'Добавьте краткое описание истории в свойствах.'}</p>
                      <Hashtags tags={[...story.tags, ...story.genres].slice(0, 4)} />
                      <div className="library-story-bento">
                        <div className="library-story-stat" title={`${chapters.length} ${plural(chapters.length, 'глава', 'главы', 'глав')}, готово: ${done}`}>
                          <BookOpen size={13} />
                          <span><strong>{chapters.length}</strong><small>{plural(chapters.length, 'глава', 'главы', 'глав')}</small></span>
                        </div>
                        <div className="library-story-stat" title={`${current.characters.length} ${plural(current.characters.length, 'персонаж', 'персонажа', 'персонажей')} в проекте`}>
                          <Users size={13} />
                          <span><strong>{current.characters.length}</strong><small>{plural(current.characters.length, 'персонаж', 'персонажа', 'персонажей')}</small></span>
                        </div>
                        <div className="library-story-stat" title={`${words.toLocaleString('ru-RU')} ${plural(words, 'слово', 'слова', 'слов')}`}>
                          <FileText size={13} />
                          <span><strong>{compactNumber(words)}</strong><small>слов</small></span>
                        </div>
                        <div className="library-story-stat" title={new Date(story.updatedAt).toLocaleString('ru-RU')}>
                          <Clock3 size={13} />
                          <span><strong>{relativeTime(story.updatedAt)}</strong><small>изменено</small></span>
                        </div>
                      </div>
                      <div className="library-story-progress">
                        <span style={{ width: `${chapters.length ? (done / chapters.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="library-empty">
              <BookOpen size={30} />
              <strong>{normalizedQuery ? 'Ничего не найдено' : 'Здесь пока нет историй'}</strong>
              <span>{normalizedQuery ? 'Попробуйте изменить запрос.' : 'Создайте новую историю или выберите другую папку.'}</span>
              {!normalizedQuery && <Button variant="primary" size="sm" onClick={addStory}><BookPlus size={15} /> Новая история</Button>}
            </div>
          ))}
        </section>

        {!normalizedQuery && (
          <section className="library-section">
            <div className="library-section-head">
              <h2>Материалы проекта</h2>
              <span>{current.boards.length + current.timelines.length}</span>
            </div>
            <MaterialGroup
              label="Доски"
              tone="board"
              icon={<LayoutDashboard size={15} />}
              items={current.boards.map((b) => ({ id: b.id, title: b.title }))}
              onCreate={addBoard}
              onOpen={(it) => openTab({ id: `board:${it.id}`, kind: 'board', title: it.title, boardId: it.id })}
              onDelete={(it) => removeBoard(it.id, it.title)}
            />
            <MaterialGroup
              label="Таймлайны"
              tone="timeline"
              icon={<Clock3 size={15} />}
              items={current.timelines.map((t) => ({ id: t.id, title: t.title }))}
              onCreate={addTimeline}
              onOpen={(it) => openTab({ id: `timeline:${it.id}`, kind: 'timeline', title: it.title, timelineId: it.id })}
              onDelete={(it) => removeTimeline(it.id, it.title)}
            />
          </section>
        )}
      </div>
    </div>
  )
}

interface MaterialItem {
  id: string
  title: string
}

function MaterialGroup({
  label,
  tone,
  icon,
  items,
  onCreate,
  onOpen,
  onDelete
}: {
  label: string
  tone: 'board' | 'timeline'
  icon: React.ReactNode
  items: MaterialItem[]
  onCreate: () => void
  onOpen: (item: MaterialItem) => void
  onDelete: (item: MaterialItem) => void
}): React.JSX.Element {
  return (
    <div className="library-material-group">
      <div className="library-material-head">
        <span className={`library-material-label library-material-label--${tone}`}>
          {icon} {label}
        </span>
        <Button variant="ghost" size="sm" icon title={`Создать: ${label}`} onClick={onCreate}>
          <Plus size={15} />
        </Button>
      </div>
      {items.length > 0 ? (
        <div className="library-material-grid">
          {items.map((it) => (
            <div
              className={`library-material-card library-material-card--${tone}`}
              key={it.id}
              role="button"
              tabIndex={0}
              title={it.title}
              onClick={() => onOpen(it)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onOpen(it)
              }}
            >
              <span className="library-material-icon">{icon}</span>
              <span className="library-material-title truncate">{it.title}</span>
              <button
                className="library-material-del"
                title="Удалить"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(it)
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="library-material-empty dim">Пока нет — создайте кнопкой «＋».</div>
      )}
    </div>
  )
}
