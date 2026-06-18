/**
 * Общая модель данных FanCreator. Используется и в main-процессе (хранение на диске),
 * и в renderer (UI). Расширяет модель из старого main/background.js.
 */

export type ChapterStatus = 'idea' | 'draft' | 'editing' | 'done'

/** Тема оформления приложения (п.12 пожеланий). */
export type ThemeName = 'dark' | 'blue' | 'violet' | 'green' | 'orange' | 'rose'

/** Глава истории — содержит контент редактора (TipTap JSON). */
export interface Chapter {
  id: string
  parentId?: string | null
  title: string
  status: ChapterStatus
  /** Документ TipTap в формате JSON (ProseMirror doc). */
  content: unknown | null
  /** Очищенный текст — для поиска и подсчёта. */
  plainText: string
  wordCount: number
  order: number
  createdAt: number
  updatedAt: number
  /** Время удаления в корзину (п.30); null/undefined — активна. */
  deletedAt?: number | null
}

export interface TimelineEvent {
  id: string
  parentId?: string | null
  title: string
  note: string
  order: number
}

export interface Timeline {
  id: string
  title: string
  events: TimelineEvent[]
}

/** История внутри проекта. Может иметь обложку (п.19). */
export interface Story {
  id: string
  title: string
  /** Путь к файлу обложки в формате asset://<projectId>/<file>. */
  coverPath: string | null
  synopsis: string
  /** Хэштеги (п.3) и жанры/направления (п.19). */
  tags: string[]
  genres: string[]
  status: ChapterStatus
  order: number
  createdAt: number
  updatedAt: number
  chapters: Chapter[]
  /** Время удаления в корзину (п.30); null/undefined — активна. */
  deletedAt?: number | null
}

/** Одно поле анкеты персонажа (динамическое, под шаблоны — п.16). */
export interface CharacterField {
  id: string
  label: string
  value: string
}

export interface Character {
  id: string
  name: string
  role: string
  tags: string[]
  templateId: string | null
  fields: CharacterField[]
  avatarPath: string | null
  createdAt: number
  updatedAt: number
}

export interface CharacterTemplate {
  id: string
  name: string
  fieldLabels: string[]
}

export type StickerShape =
  | 'rect'
  | 'rounded'
  | 'circle'
  | 'note'
  | 'diamond'
  | 'triangle'
  | 'parallelogram'
  | 'hexagon'
export type StickerKind = 'note' | 'text' | 'shape' | 'image'
export type BoardStickerLinkKind = 'character' | 'story' | 'timeline'

export interface BoardStickerLink {
  kind: BoardStickerLinkKind
  id: string
}

export interface BoardSticker {
  id: string
  kind: StickerKind
  x: number
  y: number
  w: number
  h: number
  color: string
  shape: StickerShape
  text: string
  imagePath?: string
  link?: BoardStickerLink | null
}

export interface BoardArrow {
  id: string
  fromId: string
  toId: string
  color: string
  label?: string
}

export interface Board {
  id: string
  title: string
  stickers: BoardSticker[]
  arrows: BoardArrow[]
  createdAt: number
  updatedAt: number
}

/** Вкладка верхнего рабочего стола (п.2, п.10). */
export type WorkspaceTabKind =
  | 'chapter'
  | 'characters'
  | 'timeline'
  | 'relations'
  | 'notes'
  | 'cards'

export interface WorkspaceTab {
  id: string
  kind: WorkspaceTabKind
  title: string
  /** id целевой сущности (например, chapterId для kind='chapter'). */
  refId: string | null
  storyId: string | null
}

export interface Project {
  id: string
  title: string
  coverPath: string | null
  description: string
  tags: string[]
  theme: ThemeName | null
  createdAt: number
  updatedAt: number
  stories: Story[]
  characters: Character[]
  boards: Board[]
  templates: CharacterTemplate[]
  timelines: Timeline[]
}

/** Лёгкое представление проекта для списка (без тяжёлого контента глав). */
export interface ProjectSummary {
  id: string
  title: string
  coverPath: string | null
  description: string
  tags: string[]
  storyCount: number
  chapterCount: number
  updatedAt: number
}

export interface SearchResult {
  type: 'project' | 'story' | 'chapter' | 'character'
  projectId: string
  storyId?: string
  chapterId?: string
  characterId?: string
  title: string
  snippet: string
}
