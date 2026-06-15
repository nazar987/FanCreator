import type {
  Project,
  ProjectSummary,
  Story,
  Chapter,
  Character,
  SearchResult,
  ChapterStatus,
  ThemeName
} from './types'

/**
 * Контракт API, который main выставляет в renderer через preload (window.api).
 * Реализация хендлеров — в src/main/ipc/*. Обёртка в renderer типобезопасна.
 */
export interface FanCreatorApi {
  projects: {
    list(): Promise<ProjectSummary[]>
    get(projectId: string): Promise<Project | null>
    create(input: { title: string }): Promise<Project>
    update(input: {
      projectId: string
      patch: Partial<Pick<Project, 'title' | 'description' | 'tags' | 'theme'>>
    }): Promise<Project | null>
    delete(projectId: string): Promise<boolean>
    setCover(input: {
      projectId: string
      source: string
      isDataUrl?: boolean
    }): Promise<Project | null>
    pickCover(input: { projectId: string }): Promise<Project | null>
  }
  stories: {
    add(input: { projectId: string; title: string }): Promise<Project | null>
    update(input: {
      projectId: string
      storyId: string
      patch: Partial<Pick<Story, 'title' | 'synopsis' | 'tags' | 'genres' | 'status'>>
    }): Promise<Project | null>
    delete(input: { projectId: string; storyId: string }): Promise<Project | null>
    setCover(input: {
      projectId: string
      storyId: string
      /** Абсолютный путь к выбранному файлу, либо dataURL для drag&drop. */
      source: string
      isDataUrl?: boolean
    }): Promise<Project | null>
    pickCover(input: { projectId: string; storyId: string }): Promise<Project | null>
  }
  chapters: {
    add(input: { projectId: string; storyId: string; title: string }): Promise<Project | null>
    update(input: {
      projectId: string
      storyId: string
      chapterId: string
      patch: Partial<
        Pick<Chapter, 'title' | 'status' | 'content' | 'plainText' | 'wordCount'>
      >
    }): Promise<Project | null>
    delete(input: { projectId: string; storyId: string; chapterId: string }): Promise<Project | null>
    reorder(input: { projectId: string; storyId: string; order: string[] }): Promise<Project | null>
  }
  characters: {
    add(input: { projectId: string; name: string }): Promise<Project | null>
    update(input: {
      projectId: string
      characterId: string
      patch: Partial<Pick<Character, 'name' | 'role' | 'tags' | 'fields' | 'templateId'>>
    }): Promise<Project | null>
    delete(input: { projectId: string; characterId: string }): Promise<Project | null>
  }
  assets: {
    /** Сохраняет dataURL-картинку (например, перетащенную в редактор) в папку проекта. */
    saveImage(input: { projectId: string; dataUrl: string }): Promise<string>
  }
  search: {
    query(input: { query: string; projectId?: string }): Promise<SearchResult[]>
  }
  docx: {
    importToChapter(input: {
      projectId: string
      storyId: string
      chapterId: string
    }): Promise<Project | null>
    exportChapter(input: { title: string; html: string }): Promise<boolean>
  }
}

export type { ChapterStatus, ThemeName }
