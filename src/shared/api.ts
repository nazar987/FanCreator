import type {
  Project,
  ProjectSummary,
  Story,
  Chapter,
  Character,
  CharacterFolder,
  CharacterTemplate,
  SearchResult,
  ChapterStatus,
  ThemeName,
  BoardSticker,
  BoardArrow,
  TimelineEvent,
  Hierarchy,
  GenealogyNode
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
  folders: {
    add(input: { projectId: string; title: string; parentId?: string | null }): Promise<Project | null>
    rename(input: { projectId: string; folderId: string; title: string }): Promise<Project | null>
    setColor(input: { projectId: string; folderId: string; color: string }): Promise<Project | null>
    move(input: { projectId: string; folderId: string; parentId: string | null }): Promise<Project | null>
    reorder(input: { projectId: string; parentId?: string | null; order: string[] }): Promise<Project | null>
    delete(input: { projectId: string; folderId: string }): Promise<Project | null>
  }
  stories: {
    add(input: { projectId: string; title: string; folderId?: string | null }): Promise<Project | null>
    reorder(input: { projectId: string; folderId?: string | null; order: string[] }): Promise<Project | null>
    setFolder(input: {
      projectId: string
      storyId: string
      folderId: string | null
    }): Promise<Project | null>
    update(input: {
      projectId: string
      storyId: string
      patch: Partial<Pick<Story, 'title' | 'color' | 'synopsis' | 'tags' | 'genres' | 'status'>>
    }): Promise<Project | null>
    delete(input: { projectId: string; storyId: string }): Promise<Project | null>
    restore(input: { projectId: string; storyId: string }): Promise<Project | null>
    purge(input: { projectId: string; storyId: string }): Promise<Project | null>
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
    add(input: { projectId: string; storyId: string; title: string; parentId?: string | null }): Promise<Project | null>
    update(input: {
      projectId: string
      storyId: string
      chapterId: string
      patch: Partial<
        Pick<Chapter, 'title' | 'status' | 'content' | 'plainText' | 'wordCount'>
      >
    }): Promise<Project | null>
    delete(input: { projectId: string; storyId: string; chapterId: string }): Promise<Project | null>
    restore(input: { projectId: string; storyId: string; chapterId: string }): Promise<Project | null>
    purge(input: { projectId: string; storyId: string; chapterId: string }): Promise<Project | null>
    reorder(input: {
      projectId: string
      storyId: string
      parentId?: string | null
      order: string[]
    }): Promise<Project | null>
    setParent(input: {
      projectId: string
      storyId: string
      chapterId: string
      parentId: string | null
    }): Promise<Project | null>
    move(input: {
      projectId: string
      fromStoryId: string
      toStoryId: string
      chapterId: string
    }): Promise<Project | null>
  }
  trash: {
    empty(input: { projectId: string }): Promise<Project | null>
  }
  characters: {
    add(input: { projectId: string; name?: string; folderId?: string | null }): Promise<Project | null>
    update(input: {
      projectId: string
      characterId: string
      patch: Partial<
        Pick<
          Character,
          'name' | 'role' | 'tags' | 'fields' | 'templateId' | 'folderId' | 'images' | 'avatarPath' | 'color'
        >
      >
    }): Promise<Project | null>
    setFolder(input: {
      projectId: string
      characterId: string
      folderId: string | null
    }): Promise<Project | null>
    reorder(input: { projectId: string; folderId?: string | null; order: string[] }): Promise<Project | null>
    delete(input: { projectId: string; characterId: string }): Promise<Project | null>
    /** Применить шаблон к группе. characterIds=null → ко всем привязанным к шаблону. */
    applyTemplate(input: {
      projectId: string
      templateId: string
      characterIds: string[] | null
    }): Promise<Project | null>
  }
  /** Папки/локации персонажей (#16): группировка + описание локации и концепт-арты. */
  characterFolders: {
    add(input: { projectId: string; title: string; parentId?: string | null }): Promise<Project | null>
    update(input: {
      projectId: string
      folderId: string
      patch: Partial<Pick<CharacterFolder, 'title' | 'description' | 'color' | 'images'>>
    }): Promise<Project | null>
    move(input: { projectId: string; folderId: string; parentId: string | null }): Promise<Project | null>
    reorder(input: { projectId: string; parentId?: string | null; order: string[] }): Promise<Project | null>
    delete(input: { projectId: string; folderId: string }): Promise<Project | null>
  }
  templates: {
    add(input: { projectId: string; name: string }): Promise<Project | null>
    update(input: {
      projectId: string
      templateId: string
      patch: Partial<Pick<CharacterTemplate, 'name' | 'fieldLabels'>>
    }): Promise<Project | null>
    delete(input: { projectId: string; templateId: string }): Promise<Project | null>
  }
  boards: {
    add(input: { projectId: string; title: string }): Promise<Project | null>
    rename(input: { projectId: string; boardId: string; title: string }): Promise<Project | null>
    delete(input: { projectId: string; boardId: string }): Promise<Project | null>
    reorder(input: { projectId: string; order: string[] }): Promise<Project | null>
    save(input: {
      projectId: string
      boardId: string
      stickers: BoardSticker[]
      arrows: BoardArrow[]
    }): Promise<Project | null>
  }
  timelines: {
    add(input: { projectId: string; title: string }): Promise<Project | null>
    rename(input: { projectId: string; timelineId: string; title: string }): Promise<Project | null>
    delete(input: { projectId: string; timelineId: string }): Promise<Project | null>
    reorder(input: { projectId: string; order: string[] }): Promise<Project | null>
  }
  hierarchies: {
    add(input: { projectId: string; title: string }): Promise<Project | null>
    rename(input: { projectId: string; hierarchyId: string; title: string }): Promise<Project | null>
    delete(input: { projectId: string; hierarchyId: string }): Promise<Project | null>
    update(input: {
      projectId: string
      hierarchyId: string
      patch: Partial<Pick<Hierarchy, 'title' | 'orientation'>>
    }): Promise<Project | null>
  }
  hierarchyNodes: {
    add(input: { projectId: string; hierarchyId: string; parentId: string | null; title: string }): Promise<Project | null>
    update(input: { projectId: string; hierarchyId: string; nodeId: string; title: string }): Promise<Project | null>
    delete(input: { projectId: string; hierarchyId: string; nodeId: string }): Promise<Project | null>
    reorder(input: {
      projectId: string
      hierarchyId: string
      parentId: string | null
      order: string[]
    }): Promise<Project | null>
  }
  genealogies: {
    add(input: { projectId: string; title: string }): Promise<Project | null>
    rename(input: { projectId: string; genealogyId: string; title: string }): Promise<Project | null>
    delete(input: { projectId: string; genealogyId: string }): Promise<Project | null>
  }
  genealogyNodes: {
    add(input: {
      projectId: string
      genealogyId: string
      parentId?: string | null
      characterId?: string | null
      title?: string
    }): Promise<Project | null>
    update(input: {
      projectId: string
      genealogyId: string
      nodeId: string
      patch: Partial<Pick<GenealogyNode, 'characterId' | 'title' | 'parentId' | 'order'>>
    }): Promise<Project | null>
    delete(input: { projectId: string; genealogyId: string; nodeId: string }): Promise<Project | null>
  }
  timelineEvents: {
    add(input: { projectId: string; timelineId: string; title: string; parentId?: string | null }): Promise<Project | null>
    update(input: {
      projectId: string
      timelineId: string
      eventId: string
      patch: Partial<Pick<TimelineEvent, 'title' | 'note' | 'order'>>
    }): Promise<Project | null>
    delete(input: {
      projectId: string
      timelineId: string
      eventId: string
    }): Promise<Project | null>
    reorder(input: {
      projectId: string
      timelineId: string
      parentId?: string | null
      order: string[]
    }): Promise<Project | null>
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
  shell: {
    /** Открыть внешнюю ссылку (http/https) в браузере по умолчанию. */
    openExternal(url: string): Promise<void>
  }
  updates: {
    /** Проверить обновления вручную (в проде). */
    check(): void
    /** Перезапустить и установить загруженное обновление. */
    install(): void
    /** Подписка на статус обновления. Возвращает функцию отписки. */
    onStatus(cb: (status: UpdateStatus) => void): () => void
  }
}

/** Статус авто-обновления приложения (S-H). */
export interface UpdateStatus {
  state: 'checking' | 'available' | 'downloading' | 'ready' | 'none' | 'error'
  version?: string
  percent?: number
  message?: string
}

export type { ChapterStatus, ThemeName }
