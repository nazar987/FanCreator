import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import { importDocxToHtml } from '../docx/importDocx'
import HTMLtoDOCX from 'html-to-docx'
import { backupFileName, exportProjectBackup, importProjectBackup } from '../store/backup'
import type { ProjectBackupResult } from '@shared/api'
import type {
  Project,
  Story,
  Chapter,
  Character,
  CharacterFolder,
  SearchResult,
  Board,
  CharacterTemplate,
  Timeline,
  TimelineEvent,
  Hierarchy,
  Genealogy
} from '@shared/types'
import {
  listProjects,
  readProject,
  writeProject,
  deleteProject,
  saveAsset,
  assetUrl,
  resolveAssetUrl,
  countWords,
  searchChapters,
  now,
  uid
} from '../store/store'

/** Обновляет проект функцией-мутатором и сохраняет на диск. */
async function mutate(
  projectId: string,
  fn: (p: Project) => void
): Promise<Project | null> {
  const p = await readProject(projectId)
  if (!p) return null
  fn(p)
  return writeProject(p)
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; ext: string } {
  const m = /^data:(image\/([a-zA-Z0-9.+-]+));base64,(.*)$/.exec(dataUrl)
  if (!m) throw new Error('Неверный формат dataURL')
  const ext = m[2].replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  return { buffer: Buffer.from(m[3], 'base64'), ext }
}

export function registerIpc(): void {
  // ---------- System ----------
  // открыть внешнюю ссылку в браузере по умолчанию (только http/https — безопасно)
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url)
    return Promise.resolve()
  })

  // проверка орфографии: замена слова с ошибкой / добавление в словарь
  // (варианты исправления приходят в renderer событием spell:context из main/index.ts)
  ipcMain.handle('spell:replace', (e, suggestion: string) => {
    if (typeof suggestion === 'string' && suggestion) e.sender.replaceMisspelling(suggestion)
  })
  ipcMain.handle('spell:add', (e, word: string) => {
    if (typeof word === 'string' && word) e.sender.session.addWordToSpellCheckerDictionary(word)
  })

  // ---------- Projects ----------
  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:get', (_e, projectId: string) => readProject(projectId))

  ipcMain.handle('projects:create', async (_e, { title }: { title: string }) => {
    const project: Project = {
      id: uid(),
      title,
      coverPath: null,
      description: '',
      tags: [],
      theme: null,
      createdAt: now(),
      updatedAt: now(),
      folders: [],
      stories: [],
      characters: [],
      characterFolders: [],
      boards: [],
      templates: [],
      timelines: [],
      hierarchies: [],
      genealogies: []
    }
    return writeProject(project)
  })

  ipcMain.handle('projects:update', (_e, { projectId, patch }) =>
    mutate(projectId, (p) => Object.assign(p, patch))
  )
  ipcMain.handle('projects:delete', (_e, projectId: string) => deleteProject(projectId))

  ipcMain.handle('projects:setCover', async (_e, { projectId, source, isDataUrl }) => {
    let fileName: string
    if (isDataUrl) {
      const { buffer, ext } = dataUrlToBuffer(source)
      fileName = await saveAsset(projectId, buffer, ext)
    } else {
      const buffer = await fs.readFile(source)
      fileName = await saveAsset(projectId, buffer, path.extname(source) || '.png')
    }
    return mutate(projectId, (p) => {
      p.coverPath = assetUrl(projectId, fileName)
    })
  })

  ipcMain.handle('projects:pickCover', async (_e, { projectId }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Выберите обложку проекта',
      filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return readProject(projectId)
    const buffer = await fs.readFile(filePaths[0])
    const fileName = await saveAsset(projectId, buffer, path.extname(filePaths[0]) || '.png')
    return mutate(projectId, (p) => {
      p.coverPath = assetUrl(projectId, fileName)
    })
  })

  ipcMain.handle(
    'projects:exportBackup',
    async (_e, { projectId }: { projectId: string }): Promise<ProjectBackupResult> => {
      const project = await readProject(projectId)
      if (!project) return { status: 'error', message: 'Проект не найден.' }
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Создать резервную копию',
        defaultPath: backupFileName(project.title),
        filters: [{ name: 'Резервная копия FanCreator', extensions: ['fancreator'] }]
      })
      if (canceled || !filePath) return { status: 'cancelled' }
      try {
        const destination = filePath.toLowerCase().endsWith('.fancreator')
          ? filePath
          : `${filePath}.fancreator`
        await exportProjectBackup(projectId, destination)
        return { status: 'success' }
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Не удалось создать резервную копию.'
        }
      }
    }
  )

  ipcMain.handle('projects:importBackup', async (): Promise<ProjectBackupResult> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Восстановить проект из копии',
      filters: [{ name: 'Резервная копия FanCreator', extensions: ['fancreator'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { status: 'cancelled' }
    try {
      return { status: 'success', project: await importProjectBackup(filePaths[0]) }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Не удалось восстановить проект.'
      }
    }
  })

  // ---------- Stories ----------
  ipcMain.handle('stories:add', (_e, { projectId, title, folderId }) =>
    mutate(projectId, (p) => {
      const story: Story = {
        id: uid(),
        folderId: folderId ?? null,
        title,
        color: '#8b8cf0',
        coverPath: null,
        synopsis: '',
        tags: [],
        genres: [],
        status: 'idea',
        order:
          Math.max(
            -1,
            ...p.stories
              .filter((story) => !story.deletedAt && (story.folderId ?? null) === (folderId ?? null))
              .map((story) => story.order)
          ) + 1,
        createdAt: now(),
        updatedAt: now(),
        chapters: []
      }
      p.stories.push(story)
    })
  )

  ipcMain.handle('stories:update', (_e, { projectId, storyId, patch }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (s) Object.assign(s, patch, { updatedAt: now() })
    })
  )

  ipcMain.handle('stories:reorder', (_e, { projectId, folderId, order }) =>
    mutate(projectId, (p) => {
      const parentKey = folderId ?? null
      const byId = new Map(p.stories.map((story) => [story.id, story]))
      const reordered = order
        .map((id: string, index: number) => {
          const story = byId.get(id)
          return story && !story.deletedAt && (story.folderId ?? null) === parentKey
            ? { ...story, order: index }
            : null
        })
        .filter(Boolean) as Story[]
      const byReorderedId = new Map(reordered.map((story) => [story.id, story]))
      let nextOrder = reordered.length
      p.stories = p.stories.map((story) => {
        const replacement = byReorderedId.get(story.id)
        if (replacement) return replacement
        if (!story.deletedAt && (story.folderId ?? null) === parentKey) return { ...story, order: nextOrder++ }
        return story
      })
    })
  )

  // Удаление = в корзину (мягко, п.30). Восстановление/окончательное удаление — отдельно.
  ipcMain.handle('stories:delete', (_e, { projectId, storyId }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (s) s.deletedAt = now()
    })
  )
  ipcMain.handle('stories:restore', (_e, { projectId, storyId }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (s) s.deletedAt = null
    })
  )
  ipcMain.handle('stories:purge', (_e, { projectId, storyId }) =>
    mutate(projectId, (p) => {
      p.stories = p.stories.filter((s) => s.id !== storyId)
    })
  )

  // Установка обложки истории: по dataURL (drag&drop) или по пути к файлу.
  ipcMain.handle('stories:setCover', async (_e, { projectId, storyId, source, isDataUrl }) => {
    let fileName: string
    if (isDataUrl) {
      const { buffer, ext } = dataUrlToBuffer(source)
      fileName = await saveAsset(projectId, buffer, ext)
    } else {
      const buffer = await fs.readFile(source)
      fileName = await saveAsset(projectId, buffer, path.extname(source) || '.png')
    }
    return mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (s) s.coverPath = assetUrl(projectId, fileName)
    })
  })

  ipcMain.handle('stories:pickCover', async (_e, { projectId, storyId }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Выберите обложку',
      filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return readProject(projectId)
    const buffer = await fs.readFile(filePaths[0])
    const fileName = await saveAsset(projectId, buffer, path.extname(filePaths[0]) || '.png')
    return mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (s) s.coverPath = assetUrl(projectId, fileName)
    })
  })

  // ---------- Folders (#10) ----------
  ipcMain.handle('folders:add', (_e, { projectId, title, parentId }) =>
    mutate(projectId, (p) => {
      p.folders ??= []
      p.folders.push({
        id: uid(),
        parentId: parentId ?? null,
        title,
        color: '#f0b84b',
        order:
          Math.max(
            -1,
            ...p.folders
              .filter((folder) => (folder.parentId ?? null) === (parentId ?? null))
              .map((folder) => folder.order)
          ) + 1
      })
    })
  )
  ipcMain.handle('folders:rename', (_e, { projectId, folderId, title }) =>
    mutate(projectId, (p) => {
      const f = p.folders?.find((x) => x.id === folderId)
      if (f) f.title = title
    })
  )
  ipcMain.handle('folders:setColor', (_e, { projectId, folderId, color }) =>
    mutate(projectId, (p) => {
      const f = p.folders?.find((x) => x.id === folderId)
      if (f) f.color = color
    })
  )
  ipcMain.handle('folders:move', (_e, { projectId, folderId, parentId }) =>
    mutate(projectId, (p) => {
      const f = p.folders?.find((x) => x.id === folderId)
      if (!f || folderId === parentId) return
      // защита от цикла: нельзя вложить папку в собственного потомка
      let cursor: string | null = parentId ?? null
      while (cursor) {
        if (cursor === folderId) return
        cursor = p.folders.find((x) => x.id === cursor)?.parentId ?? null
      }
      f.parentId = parentId ?? null
      f.order =
        Math.max(
          -1,
          ...p.folders
            .filter((x) => (x.parentId ?? null) === (parentId ?? null) && x.id !== f.id)
            .map((x) => x.order)
        ) + 1
    })
  )
  ipcMain.handle('folders:reorder', (_e, { projectId, parentId, order }) =>
    mutate(projectId, (p) => {
      const parentKey = parentId ?? null
      const positions = new Map<string, number>(order.map((id: string, index: number) => [id, index]))
      let nextOrder = positions.size
      for (const folder of p.folders) {
        if ((folder.parentId ?? null) !== parentKey) continue
        folder.order = positions.get(folder.id) ?? nextOrder++
      }
    })
  )
  ipcMain.handle('folders:delete', (_e, { projectId, folderId }) =>
    mutate(projectId, (p) => {
      if (!p.folders?.some((x) => x.id === folderId)) return
      // удаляем папку вместе с содержимым: собираем папку и все подпапки рекурсивно
      const ids = new Set<string>([folderId])
      let changed = true
      while (changed) {
        changed = false
        for (const f of p.folders) {
          if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
            ids.add(f.id)
            changed = true
          }
        }
      }
      // истории внутри — в корзину (soft-delete, восстановимы), папки убираем
      for (const s of p.stories) if (s.folderId && ids.has(s.folderId)) s.deletedAt = now()
      p.folders = p.folders.filter((x) => !ids.has(x.id))
    })
  )
  ipcMain.handle('stories:setFolder', (_e, { projectId, storyId, folderId }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((x) => x.id === storyId)
      if (s) {
        const targetFolder = folderId ?? null
        s.folderId = targetFolder
        s.order =
          Math.max(
            -1,
            ...p.stories
              .filter(
                (story) => story.id !== s.id && !story.deletedAt && (story.folderId ?? null) === targetFolder
              )
              .map((story) => story.order)
          ) + 1
      }
    })
  )

  // ---------- Chapters ----------
  ipcMain.handle('chapters:add', (_e, { projectId, storyId, title, parentId }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (!s) return
      const parent = parentId ? s.chapters.find((c) => c.id === parentId && !c.deletedAt) : null
      const chapter: Chapter = {
        id: uid(),
        parentId: parent?.id ?? null,
        title,
        status: 'draft',
        content: null,
        plainText: '',
        wordCount: 0,
        order: s.chapters.length,
        createdAt: now(),
        updatedAt: now()
      }
      s.chapters.push(chapter)
      s.updatedAt = now()
    })
  )

  ipcMain.handle('chapters:setParent', (_e, { projectId, storyId, chapterId, parentId }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      const c = s?.chapters.find((c) => c.id === chapterId)
      if (!s || !c || parentId === chapterId) return
      if (parentId) {
        const parent = s.chapters.find((item) => item.id === parentId && !item.deletedAt)
        if (!parent) return
        let cursor: string | null | undefined = parent.parentId
        while (cursor) {
          if (cursor === chapterId) return
          cursor = s.chapters.find((item) => item.id === cursor)?.parentId
        }
      }
      c.parentId = parentId ?? null
      c.updatedAt = now()
      s.updatedAt = now()
    })
  )

  ipcMain.handle('chapters:update', (_e, { projectId, storyId, chapterId, patch }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      const c = s?.chapters.find((c) => c.id === chapterId)
      if (!c || !s) return
      if (typeof patch.plainText === 'string' && patch.wordCount === undefined) {
        patch.wordCount = countWords(patch.plainText)
      }
      Object.assign(c, patch, { updatedAt: now() })
      s.updatedAt = now()
    })
  )

  // Удаление главы = в корзину (мягко, п.30)
  ipcMain.handle('chapters:delete', (_e, { projectId, storyId, chapterId }) =>
    mutate(projectId, (p) => {
      const c = p.stories.find((s) => s.id === storyId)?.chapters.find((c) => c.id === chapterId)
      if (c) c.deletedAt = now()
    })
  )
  ipcMain.handle('chapters:restore', (_e, { projectId, storyId, chapterId }) =>
    mutate(projectId, (p) => {
      const c = p.stories.find((s) => s.id === storyId)?.chapters.find((c) => c.id === chapterId)
      if (c) c.deletedAt = null
    })
  )
  ipcMain.handle('chapters:purge', (_e, { projectId, storyId, chapterId }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (!s) return
      s.chapters = s.chapters.filter((c) => c.id !== chapterId)
    })
  )

  ipcMain.handle('chapters:reorder', (_e, { projectId, storyId, parentId, order }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (!s) return
      const parentKey = parentId ?? null
      const byId = new Map(s.chapters.map((c) => [c.id, c]))
      const reordered = order
        .map((id: string, i: number) => {
          const c = byId.get(id)
          return c && !c.deletedAt && (c.parentId ?? null) === parentKey ? { ...c, order: i } : null
        })
        .filter(Boolean) as Chapter[]
      const byReorderedId = new Map(reordered.map((c) => [c.id, c]))
      let nextOrder = reordered.length
      s.chapters = s.chapters.map((c) => {
        const replacement = byReorderedId.get(c.id)
        if (replacement) return replacement
        if (!c.deletedAt && (c.parentId ?? null) === parentKey) {
          return { ...c, order: nextOrder++ }
        }
        return c
      })
      s.updatedAt = now()
    })
  )

  ipcMain.handle('chapters:move', (_e, { projectId, fromStoryId, toStoryId, chapterId }) =>
    mutate(projectId, (p) => {
      if (fromStoryId === toStoryId) return
      const fromStory = p.stories.find((s) => s.id === fromStoryId)
      const toStory = p.stories.find((s) => s.id === toStoryId)
      const chapter = fromStory?.chapters.find((c) => c.id === chapterId)
      if (!fromStory || !toStory || !chapter) return

      fromStory.chapters = fromStory.chapters
        .filter((c) => c.id !== chapterId)
        .map((c, index) => ({ ...c, order: index }))
      toStory.chapters = [...toStory.chapters, { ...chapter, parentId: null, order: toStory.chapters.length }]
      fromStory.updatedAt = now()
      toStory.updatedAt = now()
    })
  )

  ipcMain.handle('trash:empty', (_e, { projectId }) =>
    mutate(projectId, (p) => {
      p.stories = p.stories
        .filter((story) => !story.deletedAt)
        .map((story) => ({
          ...story,
          chapters: story.chapters.filter((chapter) => !chapter.deletedAt)
        }))
    })
  )

  // ---------- Characters ----------
  ipcMain.handle('characters:add', (_e, { projectId, name, folderId }) =>
    mutate(projectId, (p) => {
      const character: Character = {
        id: uid(),
        order:
          Math.max(
            -1,
            ...p.characters
              .filter((item) => (item.folderId ?? null) === (folderId ?? null))
              .map((item) => item.order)
          ) + 1,
        name: name ?? '',
        role: '',
        tags: [],
        templateId: null,
        fields: [],
        avatarPath: null,
        folderId: folderId ?? null,
        images: [],
        createdAt: now(),
        updatedAt: now()
      }
      p.characters.push(character)
    })
  )

  ipcMain.handle('characters:setFolder', (_e, { projectId, characterId, folderId }) =>
    mutate(projectId, (p) => {
      const ch = p.characters.find((c) => c.id === characterId)
      if (ch) {
        const targetFolder = folderId ?? null
        ch.folderId = targetFolder
        ch.order =
          Math.max(
            -1,
            ...p.characters
              .filter((character) => character.id !== ch.id && (character.folderId ?? null) === targetFolder)
              .map((character) => character.order)
          ) + 1
        ch.updatedAt = now()
      }
    })
  )

  ipcMain.handle('characters:reorder', (_e, { projectId, folderId, order }) =>
    mutate(projectId, (p) => {
      const folderKey = folderId ?? null
      const positions = new Map<string, number>(order.map((id: string, index: number) => [id, index]))
      let nextOrder = positions.size
      for (const character of p.characters) {
        if ((character.folderId ?? null) !== folderKey) continue
        character.order = positions.get(character.id) ?? nextOrder++
      }
    })
  )

  ipcMain.handle('characters:update', (_e, { projectId, characterId, patch }) =>
    mutate(projectId, (p) => {
      const ch = p.characters.find((c) => c.id === characterId)
      if (ch) Object.assign(ch, patch, { updatedAt: now() })
    })
  )

  ipcMain.handle('characters:delete', (_e, { projectId, characterId }) =>
    mutate(projectId, (p) => {
      p.characters = p.characters.filter((c) => c.id !== characterId)
    })
  )

  // Применить шаблон к группе персонажей: добавляет недостающие поля (по label,
  // без учёта регистра), не трогая уже заполненные; проставляет templateId.
  // characterIds = null → применить ко всем персонажам, уже привязанным к этому
  // шаблону (распространение правок шаблона).
  ipcMain.handle('characters:applyTemplate', (_e, { projectId, templateId, characterIds }) =>
    mutate(projectId, (p) => {
      const template = p.templates.find((t) => t.id === templateId)
      if (!template) return
      const targets: Character[] = characterIds
        ? p.characters.filter((c) => characterIds.includes(c.id))
        : p.characters.filter((c) => c.templateId === templateId)
      for (const ch of targets) {
        const existing = new Set(ch.fields.map((f) => f.label.trim().toLowerCase()))
        const added = template.fieldLabels
          .filter((label) => label.trim() && !existing.has(label.trim().toLowerCase()))
          .map((label) => ({ id: uid(), label, value: '' }))
        ch.fields = [...ch.fields, ...added]
        ch.templateId = templateId
        ch.updatedAt = now()
      }
    })
  )

  // ---------- Character folders / локации ----------
  ipcMain.handle('characterFolders:add', (_e, { projectId, title, parentId }) =>
    mutate(projectId, (p) => {
      p.characterFolders ??= []
      const folder: CharacterFolder = {
        id: uid(),
        parentId: parentId ?? null,
        title,
        description: '',
        color: '#7aa2f7',
        images: [],
        order:
          Math.max(
            -1,
            ...p.characterFolders
              .filter((folder) => (folder.parentId ?? null) === (parentId ?? null))
              .map((folder) => folder.order)
          ) + 1
      }
      p.characterFolders.push(folder)
    })
  )
  ipcMain.handle('characterFolders:update', (_e, { projectId, folderId, patch }) =>
    mutate(projectId, (p) => {
      const f = p.characterFolders?.find((x) => x.id === folderId)
      if (f) Object.assign(f, patch)
    })
  )
  ipcMain.handle('characterFolders:move', (_e, { projectId, folderId, parentId }) =>
    mutate(projectId, (p) => {
      const f = p.characterFolders?.find((x) => x.id === folderId)
      if (!f || folderId === parentId) return
      let cursor: string | null = parentId ?? null
      while (cursor) {
        if (cursor === folderId) return
        cursor = p.characterFolders.find((x) => x.id === cursor)?.parentId ?? null
      }
      f.parentId = parentId ?? null
      f.order =
        Math.max(
          -1,
          ...p.characterFolders
            .filter((folder) => folder.id !== f.id && (folder.parentId ?? null) === (parentId ?? null))
            .map((folder) => folder.order)
        ) + 1
    })
  )
  ipcMain.handle('characterFolders:reorder', (_e, { projectId, parentId, order }) =>
    mutate(projectId, (p) => {
      const parentKey = parentId ?? null
      const positions = new Map<string, number>(order.map((id: string, index: number) => [id, index]))
      let nextOrder = positions.size
      for (const folder of p.characterFolders) {
        if ((folder.parentId ?? null) !== parentKey) continue
        folder.order = positions.get(folder.id) ?? nextOrder++
      }
    })
  )
  ipcMain.handle('characterFolders:delete', (_e, { projectId, folderId }) =>
    mutate(projectId, (p) => {
      if (!p.characterFolders?.some((x) => x.id === folderId)) return
      // удаляем папку вместе с содержимым (папка + подпапки рекурсивно)
      const ids = new Set<string>([folderId])
      let changed = true
      while (changed) {
        changed = false
        for (const f of p.characterFolders) {
          if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
            ids.add(f.id)
            changed = true
          }
        }
      }
      // у персонажей нет корзины — удаляем безвозвратно
      p.characters = p.characters.filter((c) => !(c.folderId && ids.has(c.folderId)))
      p.characterFolders = p.characterFolders.filter((x) => !ids.has(x.id))
    })
  )

  // ---------- Character templates ----------
  ipcMain.handle('templates:add', (_e, { projectId, name }) =>
    mutate(projectId, (p) => {
      const template: CharacterTemplate = {
        id: uid(),
        name,
        fieldLabels: []
      }
      p.templates.push(template)
    })
  )

  ipcMain.handle('templates:update', (_e, { projectId, templateId, patch }) =>
    mutate(projectId, (p) => {
      const template = p.templates.find((item) => item.id === templateId)
      if (template) Object.assign(template, patch)
    })
  )

  ipcMain.handle('templates:delete', (_e, { projectId, templateId }) =>
    mutate(projectId, (p) => {
      p.templates = p.templates.filter((item) => item.id !== templateId)
    })
  )

  // ---------- Boards ----------
  ipcMain.handle('boards:add', (_e, { projectId, title }) =>
    mutate(projectId, (p) => {
      const board: Board = {
        id: uid(),
        order: p.boards.length,
        title,
        stickers: [],
        arrows: [],
        createdAt: now(),
        updatedAt: now()
      }
      p.boards.push(board)
    })
  )

  ipcMain.handle('boards:rename', (_e, { projectId, boardId, title }) =>
    mutate(projectId, (p) => {
      const board = p.boards.find((item) => item.id === boardId)
      if (board) Object.assign(board, { title, updatedAt: now() })
    })
  )

  ipcMain.handle('boards:delete', (_e, { projectId, boardId }) =>
    mutate(projectId, (p) => {
      p.boards = p.boards.filter((item) => item.id !== boardId)
    })
  )

  ipcMain.handle('boards:reorder', (_e, { projectId, order }) =>
    mutate(projectId, (p) => {
      const positions = new Map<string, number>(order.map((id: string, index: number) => [id, index]))
      p.boards.forEach((board, index) => {
        board.order = positions.get(board.id) ?? order.length + index
      })
    })
  )

  ipcMain.handle('boards:save', (_e, { projectId, boardId, stickers, arrows }) =>
    mutate(projectId, (p) => {
      const board = p.boards.find((item) => item.id === boardId)
      if (board) Object.assign(board, { stickers, arrows, updatedAt: now() })
    })
  )

  // ---------- Timelines ----------
  ipcMain.handle('timelines:add', (_e, { projectId, title }) =>
    mutate(projectId, (p) => {
      const timeline: Timeline = {
        id: uid(),
        order: p.timelines.length,
        title,
        events: []
      }
      p.timelines.push(timeline)
    })
  )

  ipcMain.handle('timelines:rename', (_e, { projectId, timelineId, title }) =>
    mutate(projectId, (p) => {
      const timeline = p.timelines.find((item) => item.id === timelineId)
      if (timeline) timeline.title = title
    })
  )

  ipcMain.handle('timelines:delete', (_e, { projectId, timelineId }) =>
    mutate(projectId, (p) => {
      p.timelines = p.timelines.filter((item) => item.id !== timelineId)
    })
  )

  ipcMain.handle('timelines:reorder', (_e, { projectId, order }) =>
    mutate(projectId, (p) => {
      const positions = new Map<string, number>(order.map((id: string, index: number) => [id, index]))
      p.timelines.forEach((timeline, index) => {
        timeline.order = positions.get(timeline.id) ?? order.length + index
      })
    })
  )

  // ---------- Hierarchies ----------
  ipcMain.handle('hierarchies:add', (_e, { projectId, title }) =>
    mutate(projectId, (p) => {
      const hierarchy: Hierarchy = {
        id: uid(),
        title,
        orientation: 'vertical',
        nodes: []
      }
      p.hierarchies ??= []
      p.hierarchies.push(hierarchy)
    })
  )

  ipcMain.handle('hierarchies:rename', (_e, { projectId, hierarchyId, title }) =>
    mutate(projectId, (p) => {
      const hierarchy = p.hierarchies?.find((item) => item.id === hierarchyId)
      if (hierarchy) hierarchy.title = title
    })
  )

  ipcMain.handle('hierarchies:update', (_e, { projectId, hierarchyId, patch }) =>
    mutate(projectId, (p) => {
      const hierarchy = p.hierarchies?.find((item) => item.id === hierarchyId)
      if (hierarchy) Object.assign(hierarchy, patch)
    })
  )

  ipcMain.handle('hierarchies:delete', (_e, { projectId, hierarchyId }) =>
    mutate(projectId, (p) => {
      p.hierarchies = (p.hierarchies ?? []).filter((item) => item.id !== hierarchyId)
    })
  )

  ipcMain.handle('hierarchyNodes:add', (_e, { projectId, hierarchyId, parentId, title }) =>
    mutate(projectId, (p) => {
      const hierarchy = p.hierarchies?.find((item) => item.id === hierarchyId)
      if (!hierarchy) return
      const parent = parentId ? hierarchy.nodes.find((item) => item.id === parentId) : null
      hierarchy.nodes.push({ id: uid(), parentId: parent?.id ?? null, title })
    })
  )

  ipcMain.handle('hierarchyNodes:update', (_e, { projectId, hierarchyId, nodeId, patch }) =>
    mutate(projectId, (p) => {
      const node = p.hierarchies?.find((item) => item.id === hierarchyId)?.nodes.find((item) => item.id === nodeId)
      if (node) Object.assign(node, patch)
    })
  )

  ipcMain.handle('hierarchyNodes:delete', (_e, { projectId, hierarchyId, nodeId }) =>
    mutate(projectId, (p) => {
      const hierarchy = p.hierarchies?.find((item) => item.id === hierarchyId)
      if (!hierarchy) return
      const remove = new Set<string>([nodeId])
      let changed = true
      while (changed) {
        changed = false
        for (const node of hierarchy.nodes) {
          if (node.parentId && remove.has(node.parentId) && !remove.has(node.id)) {
            remove.add(node.id)
            changed = true
          }
        }
      }
      hierarchy.nodes = hierarchy.nodes.filter((node) => !remove.has(node.id))
    })
  )

  ipcMain.handle('hierarchyNodes:reorder', (_e, { projectId, hierarchyId, parentId, order }) =>
    mutate(projectId, (p) => {
      const hierarchy = p.hierarchies?.find((item) => item.id === hierarchyId)
      if (!hierarchy) return
      const parentKey = parentId ?? null
      const byId = new Map(hierarchy.nodes.map((node) => [node.id, node]))
      const reordered = order
        .map((id: string) => {
          const node = byId.get(id)
          return node && node.parentId === parentKey ? node : null
        })
        .filter(Boolean) as Hierarchy['nodes']
      const inOrder = new Set(reordered.map((node) => node.id))
      hierarchy.nodes = [
        ...hierarchy.nodes.filter((node) => node.parentId !== parentKey),
        ...reordered,
        ...hierarchy.nodes.filter((node) => node.parentId === parentKey && !inOrder.has(node.id))
      ]
    })
  )

  // ---------- Genealogies (родословные, в разделе «Персонажи») ----------
  ipcMain.handle('genealogies:add', (_e, { projectId, title, folderId }) =>
    mutate(projectId, (p) => {
      const g: Genealogy = {
        id: uid(),
        order: p.genealogies.length,
        title,
        folderId: folderId ?? null,
        nodes: []
      }
      p.genealogies.push(g)
    })
  )
  ipcMain.handle('genealogies:rename', (_e, { projectId, genealogyId, title }) =>
    mutate(projectId, (p) => {
      const g = p.genealogies.find((x) => x.id === genealogyId)
      if (g) g.title = title
    })
  )
  ipcMain.handle('genealogies:delete', (_e, { projectId, genealogyId }) =>
    mutate(projectId, (p) => {
      p.genealogies = p.genealogies.filter((x) => x.id !== genealogyId)
    })
  )
  ipcMain.handle('genealogyNodes:add', (_e, { projectId, genealogyId, parentId, characterId, title }) =>
    mutate(projectId, (p) => {
      const g = p.genealogies.find((x) => x.id === genealogyId)
      if (!g) return
      const siblings = g.nodes.filter((n) => (n.parentId ?? null) === (parentId ?? null))
      g.nodes.push({
        id: uid(),
        parentId: parentId ?? null,
        characterId: characterId ?? null,
        title: title ?? '',
        order: siblings.length
      })
    })
  )
  ipcMain.handle('genealogyNodes:update', (_e, { projectId, genealogyId, nodeId, patch }) =>
    mutate(projectId, (p) => {
      const node = p.genealogies.find((x) => x.id === genealogyId)?.nodes.find((n) => n.id === nodeId)
      if (node) Object.assign(node, patch)
    })
  )
  ipcMain.handle('genealogyNodes:delete', (_e, { projectId, genealogyId, nodeId }) =>
    mutate(projectId, (p) => {
      const g = p.genealogies.find((x) => x.id === genealogyId)
      if (!g) return
      const remove = new Set<string>([nodeId])
      let changed = true
      while (changed) {
        changed = false
        for (const n of g.nodes) {
          if (n.parentId && remove.has(n.parentId) && !remove.has(n.id)) {
            remove.add(n.id)
            changed = true
          }
        }
      }
      g.nodes = g.nodes.filter((n) => !remove.has(n.id))
    })
  )

  ipcMain.handle('timelineEvents:add', (_e, { projectId, timelineId, title, parentId }) =>
    mutate(projectId, (p) => {
      const timeline = p.timelines.find((item) => item.id === timelineId)
      if (!timeline) return
      const parent = parentId ? timeline.events.find((item) => item.id === parentId) : null
      const event: TimelineEvent = {
        id: uid(),
        parentId: parent?.id ?? null,
        title,
        note: '',
        order: timeline.events.length
      }
      timeline.events.push(event)
    })
  )

  ipcMain.handle('timelineEvents:update', (_e, { projectId, timelineId, eventId, patch }) =>
    mutate(projectId, (p) => {
      const timeline = p.timelines.find((item) => item.id === timelineId)
      const event = timeline?.events.find((item) => item.id === eventId)
      if (event) Object.assign(event, patch)
    })
  )

  ipcMain.handle('timelineEvents:delete', (_e, { projectId, timelineId, eventId }) =>
    mutate(projectId, (p) => {
      const timeline = p.timelines.find((item) => item.id === timelineId)
      if (!timeline) return
      const remove = new Set<string>([eventId])
      let changed = true
      while (changed) {
        changed = false
        for (const item of timeline.events) {
          if (item.parentId && remove.has(item.parentId) && !remove.has(item.id)) {
            remove.add(item.id)
            changed = true
          }
        }
      }
      timeline.events = timeline.events
        .filter((item) => !remove.has(item.id))
        .map((item, index) => ({ ...item, order: index }))
    })
  )

  ipcMain.handle('timelineEvents:reorder', (_e, { projectId, timelineId, parentId, order }) =>
    mutate(projectId, (p) => {
      const timeline = p.timelines.find((item) => item.id === timelineId)
      if (!timeline) return
      const parentKey = parentId ?? null
      const byId = new Map(timeline.events.map((item) => [item.id, item]))
      const reordered = order
        .map((id: string, index: number) => {
          const event = byId.get(id)
          return event && (event.parentId ?? null) === parentKey ? { ...event, order: index } : null
        })
        .filter(Boolean) as TimelineEvent[]
      const byReorderedId = new Map(reordered.map((event) => [event.id, event]))
      let nextOrder = reordered.length
      timeline.events = timeline.events.map((event) => {
        const replacement = byReorderedId.get(event.id)
        if (replacement) return replacement
        if ((event.parentId ?? null) === parentKey) return { ...event, order: nextOrder++ }
        return event
      })
    })
  )

  // ---------- Assets (картинки в редакторе, п.13) ----------
  ipcMain.handle('assets:saveImage', async (_e, { projectId, dataUrl }) => {
    const { buffer, ext } = dataUrlToBuffer(dataUrl)
    const fileName = await saveAsset(projectId, buffer, ext)
    return assetUrl(projectId, fileName)
  })

  // ---------- Search (п.4) ----------
  ipcMain.handle('search:query', async (_e, { query, projectId }) => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return [] as SearchResult[]
    const summaries = await listProjects()
    const ids = projectId ? [projectId] : summaries.map((s) => s.id)
    const results: SearchResult[] = []
    for (const id of ids) {
      const p = await readProject(id)
      if (!p) continue
      if (p.title.toLowerCase().includes(q))
        results.push({ type: 'project', projectId: p.id, title: p.title, snippet: p.description })
      for (const s of p.stories) {
        if (s.title.toLowerCase().includes(q) || s.synopsis.toLowerCase().includes(q))
          results.push({
            type: 'story',
            projectId: p.id,
            storyId: s.id,
            title: s.title,
            snippet: s.synopsis
          })
      }
      for (const ch of p.characters) {
        const blob = `${ch.name} ${ch.role} ${ch.fields.map((f) => f.value).join(' ')}`.toLowerCase()
        if (blob.includes(q))
          results.push({
            type: 'character',
            projectId: p.id,
            characterId: ch.id,
            title: ch.name,
            snippet: ch.role
          })
      }
    }
    // главы — через FTS (SQLite) либо линейный поиск (JSON-фолбэк)
    results.push(...(await searchChapters(query, projectId)))
    return results.slice(0, 100)
  })

  // ---------- DOCX (перенос из старого background.js) ----------
  ipcMain.handle('docx:importToChapter', async (_e, { projectId, storyId, chapterId }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Word', extensions: ['docx'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return readProject(projectId)
    const buffer = await fs.readFile(filePaths[0])
    // S-G7: импорт с сохранением форматирования (свой OOXML-парсер).
    let html = ''
    try {
      html = await importDocxToHtml(buffer as Buffer, async (buf, ext) =>
        assetUrl(projectId, await saveAsset(projectId, buf, ext))
      )
    } catch {
      html = ''
    }
    if (!html.trim()) {
      // фоллбэк: mammoth (структура без точных шрифтов) + чистка пустых абзацев
      const res = await mammoth.convertToHtml(
        { buffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const imgBuffer = await image.read()
            const ext = `.${(image.contentType || 'image/png').split('/')[1].replace('jpeg', 'jpg')}`
            const fileName = await saveAsset(projectId, imgBuffer as Buffer, ext)
            return { src: assetUrl(projectId, fileName) }
          })
        }
      )
      html = res.value
        .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
        .replace(/<p[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi, '')
        .replace(/\s(?:font-size|font-family|line-height)\s*:\s*[^;"']*;?/gi, '')
    }
    const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      const c = s?.chapters.find((c) => c.id === chapterId)
      if (c) {
        // сохраняем как HTML-строку; редактор умеет принять HTML при загрузке
        c.content = { html }
        c.plainText = plainText
        c.wordCount = countWords(plainText)
        c.updatedAt = now()
      }
    })
  })

  ipcMain.handle('docx:exportChapter', async (_e, { title, html }) => {
    // полноценный экспорт: HTML редактора → docx (заголовки, жирный/курсив, списки,
    // выравнивание, шрифты, отступы, интервал, картинки). Картинки asset:// встраиваем base64.
    const inlined = await inlineAssetImages(html)
    const out = await HTMLtoDOCX(`<!DOCTYPE html><html><body>${inlined}</body></html>`, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false
    })
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `${title || 'Глава'}.docx`,
      filters: [{ name: 'Word', extensions: ['docx'] }]
    })
    if (canceled || !filePath) return false
    await fs.writeFile(filePath, Buffer.from(out as ArrayBuffer))
    return true
  })

  // ФАЗА 25: экспорт всей истории одним .docx — главы с заголовками
  // и разрывом страницы между ними
  ipcMain.handle('docx:exportStory', async (_e, { title, chapters }) => {
    const body = (chapters as { title: string; html: string }[])
      .map(
        (ch) =>
          `<h1>${escapeHtml(ch.title || 'Глава')}</h1>${ch.html}`
      )
      .join('<div class="page-break" style="page-break-after: always;"></div>')
    const inlined = await inlineAssetImages(body)
    const out = await HTMLtoDOCX(`<!DOCTYPE html><html><body>${inlined}</body></html>`, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: true
    })
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `${title || 'История'}.docx`,
      filters: [{ name: 'Word', extensions: ['docx'] }]
    })
    if (canceled || !filePath) return false
    await fs.writeFile(filePath, Buffer.from(out as ArrayBuffer))
    return true
  })

  // ФАЗА 25: экспорт в PDF — печатаем аккуратный книжный HTML в скрытом окне
  ipcMain.handle('pdf:exportHtml', async (_e, { title, bodyHtml }) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `${title || 'Документ'}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return false

    const inlined = await inlineAssetImages(bodyHtml)
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt;
             line-height: 1.55; color: #171512; margin: 0; }
      h1.fc-export-chapter { font-size: 19pt; margin: 0 0 14pt; page-break-before: always; }
      h1.fc-export-chapter:first-of-type { page-break-before: auto; }
      h1, h2, h3 { line-height: 1.25; }
      p { margin: 0 0 7pt; }
      img { max-width: 100%; height: auto; }
      table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
      td, th { border: 1px solid #8a8a8a; padding: 4pt 6pt; vertical-align: top; }
      blockquote { margin: 8pt 0 8pt 16pt; padding-left: 10pt; border-left: 2pt solid #999; }
      ul, ol { margin: 0 0 7pt; }
    </style></head><body>${inlined}</body></html>`

    const tmp = path.join(app.getPath('temp'), `fancreator-export-${Date.now()}.html`)
    await fs.writeFile(tmp, doc, 'utf8')
    const win = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { sandbox: true, contextIsolation: true }
    })
    try {
      await win.loadFile(tmp)
      // дождаться загрузки картинок, иначе printToPDF снимет их пустыми
      await win.webContents.executeJavaScript(
        `Promise.all([...document.images].map((img) => img.complete
           ? Promise.resolve()
           : new Promise((res) => { img.onload = img.onerror = res })))`,
        true
      )
      const pdf = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0.79, bottom: 0.79, left: 0.71, right: 0.71 }
      })
      await fs.writeFile(filePath, pdf)
      return true
    } finally {
      win.destroy()
      fs.unlink(tmp).catch(() => undefined)
    }
  })
}

/** Экранирование текста для вставки в HTML (заголовки глав при экспорте). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Встраивает картинки asset:// в HTML как base64 — чтобы они попали в экспортируемый docx. */
async function inlineAssetImages(html: string): Promise<string> {
  const urls = [...html.matchAll(/"(asset:\/\/[^"]+)"/g)].map((m) => m[1])
  let out = html
  for (const url of Array.from(new Set(urls))) {
    const filePath = resolveAssetUrl(url)
    if (!filePath) continue
    try {
      const buf = await fs.readFile(filePath)
      const ext = (path.extname(filePath).slice(1) || 'png').toLowerCase().replace('jpg', 'jpeg')
      const dataUri = `data:image/${ext};base64,${buf.toString('base64')}`
      out = out.split(`"${url}"`).join(`"${dataUri}"`)
    } catch {
      // файл недоступен — пропускаем
    }
  }
  return out
}
