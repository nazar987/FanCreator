import { ipcMain, dialog } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import { Document, Packer, Paragraph } from 'docx'
import type {
  Project,
  Story,
  Chapter,
  Character,
  SearchResult,
  Board
} from '@shared/types'
import {
  listProjects,
  readProject,
  writeProject,
  deleteProject,
  saveAsset,
  assetUrl,
  countWords,
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
      stories: [],
      characters: [],
      boards: []
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

  // ---------- Stories ----------
  ipcMain.handle('stories:add', (_e, { projectId, title }) =>
    mutate(projectId, (p) => {
      const story: Story = {
        id: uid(),
        title,
        coverPath: null,
        synopsis: '',
        tags: [],
        genres: [],
        status: 'idea',
        order: p.stories.length,
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

  ipcMain.handle('stories:delete', (_e, { projectId, storyId }) =>
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

  // ---------- Chapters ----------
  ipcMain.handle('chapters:add', (_e, { projectId, storyId, title }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (!s) return
      const chapter: Chapter = {
        id: uid(),
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

  ipcMain.handle('chapters:delete', (_e, { projectId, storyId, chapterId }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (!s) return
      s.chapters = s.chapters
        .filter((c) => c.id !== chapterId)
        .map((c, i) => ({ ...c, order: i }))
    })
  )

  ipcMain.handle('chapters:reorder', (_e, { projectId, storyId, order }) =>
    mutate(projectId, (p) => {
      const s = p.stories.find((s) => s.id === storyId)
      if (!s) return
      const byId = new Map(s.chapters.map((c) => [c.id, c]))
      s.chapters = order
        .map((id: string, i: number) => {
          const c = byId.get(id)
          return c ? { ...c, order: i } : null
        })
        .filter(Boolean) as Chapter[]
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
      toStory.chapters = [...toStory.chapters, { ...chapter, order: toStory.chapters.length }]
      fromStory.updatedAt = now()
      toStory.updatedAt = now()
    })
  )

  // ---------- Characters ----------
  ipcMain.handle('characters:add', (_e, { projectId, name }) =>
    mutate(projectId, (p) => {
      const character: Character = {
        id: uid(),
        name,
        role: '',
        tags: [],
        templateId: null,
        fields: [],
        avatarPath: null,
        createdAt: now(),
        updatedAt: now()
      }
      p.characters.push(character)
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

  // ---------- Boards ----------
  ipcMain.handle('boards:add', (_e, { projectId, title }) =>
    mutate(projectId, (p) => {
      const board: Board = {
        id: uid(),
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

  ipcMain.handle('boards:save', (_e, { projectId, boardId, stickers, arrows }) =>
    mutate(projectId, (p) => {
      const board = p.boards.find((item) => item.id === boardId)
      if (board) Object.assign(board, { stickers, arrows, updatedAt: now() })
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
        for (const c of s.chapters) {
          const hay = `${c.title}\n${c.plainText}`.toLowerCase()
          const idx = hay.indexOf(q)
          if (idx >= 0) {
            const around = c.plainText.slice(
              Math.max(0, idx - 40),
              idx + q.length + 40
            )
            results.push({
              type: 'chapter',
              projectId: p.id,
              storyId: s.id,
              chapterId: c.id,
              title: `${s.title} — ${c.title}`,
              snippet: around
            })
          }
        }
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
    const { value: html } = await mammoth.convertToHtml({ buffer })
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
    const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    const doc = new Document({
      sections: [{ children: text.split(/\n+/).map((t: string) => new Paragraph(t)) }]
    })
    const buffer = await Packer.toBuffer(doc)
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `${title || 'Глава'}.docx`,
      filters: [{ name: 'Word', extensions: ['docx'] }]
    })
    if (canceled || !filePath) return false
    await fs.writeFile(filePath, buffer)
    return true
  })
}
