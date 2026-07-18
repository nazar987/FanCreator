import { app } from 'electron'
import { promises as fs } from 'fs'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Project, ProjectSummary, SearchResult } from '@shared/types'
import {
  initDb,
  dbProjectCount,
  dbListProjects,
  dbReadProject,
  dbWriteProject,
  dbDeleteProject,
  dbSearchChapters
} from './db'

/** Активный бэкенд хранилища. SQLite по умолчанию, JSON — фолбэк при сбое инициализации БД. */
let backend: 'sqlite' | 'json' = 'json'

/** Корень данных приложения на диске пользователя. */
const ROOT = path.join(app.getPath('userData'), 'FanCreator')
const PROJECTS_DIR = path.join(ROOT, 'projects')

export const now = (): number => Date.now()
export const uid = (): string => randomUUID()

function projectDir(projectId: string): string {
  return path.join(PROJECTS_DIR, projectId)
}
function projectFile(projectId: string): string {
  return path.join(projectDir(projectId), 'project.json')
}
export function assetsDir(projectId: string): string {
  return path.join(projectDir(projectId), 'assets')
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/* ============================================================
   ФАЗА 25 (S-V1): история версий глав.
   Снапшоты лежат рядом с проектом: versions/<chapterId>/<ts>.json,
   каждый — самодостаточный ({ savedAt, wordCount, plainText,
   preview, content }); храним последние 20 на главу.
   ============================================================ */

const VERSIONS_KEEP = 20

function versionsDir(projectId: string, chapterId: string): string {
  return path.join(projectDir(projectId), 'versions', chapterId)
}

export interface ChapterVersionMeta {
  id: string
  savedAt: number
  wordCount: number
  preview: string
}

interface ChapterVersionRecord extends ChapterVersionMeta {
  plainText: string
  content: unknown
}

export async function snapshotChapter(
  projectId: string,
  chapter: { id: string; content: unknown; plainText?: string; wordCount?: number }
): Promise<void> {
  if (chapter.content == null) return
  const dir = versionsDir(projectId, chapter.id)
  await ensureDir(dir)
  const savedAt = now()
  const rec: ChapterVersionRecord = {
    id: String(savedAt),
    savedAt,
    wordCount: chapter.wordCount ?? 0,
    plainText: chapter.plainText ?? '',
    preview: (chapter.plainText ?? '').slice(0, 180),
    content: chapter.content
  }
  await fs.writeFile(path.join(dir, `${savedAt}.json`), JSON.stringify(rec), 'utf8')
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort()
  for (const f of files.slice(0, Math.max(0, files.length - VERSIONS_KEEP))) {
    await fs.unlink(path.join(dir, f)).catch(() => undefined)
  }
}

/** Время последнего снапшота главы (0 — снапшотов нет). Дёшево: только имена файлов. */
export async function lastSnapshotAt(projectId: string, chapterId: string): Promise<number> {
  try {
    const files = (await fs.readdir(versionsDir(projectId, chapterId)))
      .filter((f) => f.endsWith('.json'))
      .sort()
    const last = files.at(-1)
    return last ? Number(last.replace('.json', '')) || 0 : 0
  } catch {
    return 0
  }
}

export async function listChapterVersions(
  projectId: string,
  chapterId: string
): Promise<ChapterVersionMeta[]> {
  try {
    const dir = versionsDir(projectId, chapterId)
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse()
    const out: ChapterVersionMeta[] = []
    for (const f of files) {
      try {
        const rec = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as ChapterVersionRecord
        out.push({ id: rec.id, savedAt: rec.savedAt, wordCount: rec.wordCount, preview: rec.preview })
      } catch {
        // повреждённый снапшот пропускаем
      }
    }
    return out
  } catch {
    return []
  }
}

export async function readChapterVersion(
  projectId: string,
  chapterId: string,
  versionId: string
): Promise<{ content: unknown; plainText: string; wordCount: number } | null> {
  try {
    const raw = await fs.readFile(path.join(versionsDir(projectId, chapterId), `${versionId}.json`), 'utf8')
    const rec = JSON.parse(raw) as ChapterVersionRecord
    return { content: rec.content, plainText: rec.plainText ?? '', wordCount: rec.wordCount ?? 0 }
  } catch {
    return null
  }
}

export async function initStore(): Promise<void> {
  await ensureDir(PROJECTS_DIR)
  try {
    initDb()
    backend = 'sqlite'
    // одноразовый импорт существующих project.json в БД (json остаётся бэкапом на диске)
    if (dbProjectCount() === 0) {
      const ids = await fs.readdir(PROJECTS_DIR).catch(() => [])
      for (const id of ids) {
        const p = await jsonReadProject(id)
        if (p) dbWriteProject(normalizeProject(p))
      }
    }
  } catch (e) {
    backend = 'json'
    console.warn('[store] SQLite недоступен — использую JSON-файлы. Причина:', e)
  }
  await migrateFromLegacy()
}

/** Приводит проект к актуальной схеме (поля, появившиеся в новых версиях). */
function normalizeProject(project: Project): Project {
  project.folders ??= []
  for (const [index, folder] of project.folders.entries()) {
    folder.color ??= '#f0b84b'
    folder.order ??= index
  }
  for (const [index, story] of project.stories.entries()) {
    story.color ??= '#8b8cf0'
    story.order ??= index
  }
  project.characterFolders ??= []
  for (const [index, folder] of project.characterFolders.entries()) {
    folder.color ??= '#7aa2f7'
    folder.images ??= []
    folder.order ??= index
  }
  for (const [index, character] of project.characters.entries()) {
    character.folderId ??= null
    character.images ??= []
    character.order ??= index
  }
  project.boards ??= []
  for (const [index, board] of project.boards.entries()) board.order ??= index
  project.templates ??= []
  project.timelines ??= []
  for (const [index, timeline] of project.timelines.entries()) timeline.order ??= index
  project.hierarchies ??= []
  project.genealogies ??= []
  for (const [index, g] of project.genealogies.entries()) {
    g.order ??= index
    g.folderId ??= null
    g.nodes ??= []
    for (const [i, n] of g.nodes.entries()) n.order ??= i
  }
  normalizeBoardStickers(project)
  return project
}

/** Список всех проектов в виде лёгких сводок (без контента глав). */
export async function listProjects(): Promise<ProjectSummary[]> {
  return backend === 'sqlite' ? dbListProjects() : jsonListProjects()
}

export async function readProject(projectId: string): Promise<Project | null> {
  const p = backend === 'sqlite' ? dbReadProject(projectId) : await jsonReadProject(projectId)
  return p ? normalizeProject(p) : null
}

export async function writeProject(project: Project): Promise<Project> {
  project.updatedAt = now()
  if (backend === 'sqlite') {
    dbWriteProject(project)
    return project
  }
  return jsonWriteProject(project)
}

/** Полнотекстовый поиск по главам (FTS5 в SQLite, линейный скан в JSON-режиме). */
export async function searchChapters(query: string, projectId?: string): Promise<SearchResult[]> {
  if (backend === 'sqlite') {
    return dbSearchChapters(query, projectId).map((h) => ({
      type: 'chapter',
      projectId: h.projectId,
      storyId: h.storyId,
      chapterId: h.chapterId,
      title: `${h.storyTitle} — ${h.chapterTitle || 'Без названия'}`,
      snippet: h.snippet
    }))
  }
  // JSON-фолбэк: линейный поиск
  const q = query.trim().toLowerCase()
  if (!q) return []
  const summaries = await jsonListProjects()
  const ids = projectId ? [projectId] : summaries.map((s) => s.id)
  const out: SearchResult[] = []
  for (const id of ids) {
    const p = await jsonReadProject(id)
    if (!p) continue
    for (const s of p.stories)
      for (const c of s.chapters) {
        const idx = `${c.title}\n${c.plainText}`.toLowerCase().indexOf(q)
        if (idx >= 0)
          out.push({
            type: 'chapter',
            projectId: p.id,
            storyId: s.id,
            chapterId: c.id,
            title: `${s.title} — ${c.title || 'Без названия'}`,
            snippet: c.plainText.slice(Math.max(0, idx - 40), idx + q.length + 40)
          })
      }
  }
  return out
}

// ---- JSON-бэкенд (фолбэк) ----
async function jsonListProjects(): Promise<ProjectSummary[]> {
  await ensureDir(PROJECTS_DIR)
  const ids = await fs.readdir(PROJECTS_DIR).catch(() => [])
  const summaries: ProjectSummary[] = []
  for (const id of ids) {
    const p = await jsonReadProject(id)
    if (!p) continue
    const chapterCount = p.stories.reduce((n, s) => n + s.chapters.length, 0)
    summaries.push({
      id: p.id,
      title: p.title,
      coverPath: p.coverPath,
      description: p.description,
      tags: p.tags,
      storyCount: p.stories.length,
      chapterCount,
      updatedAt: p.updatedAt
    })
  }
  summaries.sort((a, b) => b.updatedAt - a.updatedAt)
  return summaries
}

async function jsonReadProject(projectId: string): Promise<Project | null> {
  try {
    const raw = await fs.readFile(projectFile(projectId), 'utf8')
    return JSON.parse(raw) as Project
  } catch {
    return null
  }
}

async function jsonWriteProject(project: Project): Promise<Project> {
  await ensureDir(projectDir(project.id))
  await fs.writeFile(projectFile(project.id), JSON.stringify(project, null, 2), 'utf8')
  return project
}

export async function deleteProject(projectId: string): Promise<boolean> {
  if (backend === 'sqlite') dbDeleteProject(projectId)
  // удаляем папку проекта на диске (assets + возможный бэкап project.json)
  const dir = projectDir(projectId)
  if (existsSync(dir)) await fs.rm(dir, { recursive: true, force: true })
  return true
}

/** Сохраняет бинарные данные картинки в assets проекта, возвращает имя файла. */
export async function saveAsset(
  projectId: string,
  data: Buffer,
  ext: string
): Promise<string> {
  const dir = assetsDir(projectId)
  await ensureDir(dir)
  const fileName = `${uid()}${ext.startsWith('.') ? ext : `.${ext}`}`
  await fs.writeFile(path.join(dir, fileName), data)
  return fileName
}

/** Преобразует имя файла ассета в безопасный URL для renderer. */
export function assetUrl(projectId: string, fileName: string): string {
  return `asset://${projectId}/${fileName}`
}

/** Разбирает asset://<projectId>/<file> в абсолютный путь на диске. */
export function resolveAssetUrl(url: string): string | null {
  const m = /^asset:\/\/([^/]+)\/(.+)$/.exec(url)
  if (!m) return null
  const [, projectId, file] = m
  // защита от выхода за пределы каталога assets
  const safe = path.normalize(file).replace(/^(\.\.[/\\])+/, '')
  return path.join(assetsDir(projectId), safe)
}

/**
 * Одноразовая миграция из старого electron-store (fanfic-data.json),
 * чтобы не потерять данные заказчицы при переходе на новую версию.
 */
async function migrateFromLegacy(): Promise<void> {
  const flag = path.join(ROOT, '.migrated-v1')
  if (existsSync(flag)) return

  const legacyFile = path.join(app.getPath('userData'), 'fanfic-data.json')
  // dev-вариант userData оканчивался на " (development)"
  const candidates = [
    legacyFile,
    path.join(`${app.getPath('userData')} (development)`, 'fanfic-data.json')
  ]

  for (const file of candidates) {
    if (!existsSync(file)) continue
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      const projectsMap = parsed?.projects
      if (!projectsMap) continue
      const list = Array.isArray(projectsMap) ? projectsMap : Object.values(projectsMap)
      for (const legacy of list as any[]) {
        if (!legacy?.id || existsSync(projectFile(legacy.id))) continue
        await writeProject(normalizeLegacyProject(legacy))
      }
    } catch {
      // повреждённый файл — пропускаем, не валим запуск
    }
  }

  await ensureDir(ROOT)
  await fs.writeFile(flag, String(now()), 'utf8')
}

function normalizeLegacyProject(legacy: any): Project {
  const project: Project = {
    id: legacy.id,
    title: legacy.title ?? 'Без названия',
    coverPath: legacy.coverPath ?? null,
    description: legacy.description ?? '',
    tags: Array.isArray(legacy.tags) ? legacy.tags : [],
    theme: null,
    createdAt: legacy.createdAt ?? now(),
    updatedAt: legacy.updatedAt ?? now(),
    stories: (legacy.stories ?? []).map((s: any, si: number) => ({
      id: s.id,
      color: s.color ?? '#8b8cf0',
      title: s.title ?? 'История',
      coverPath: s.coverPath ?? null,
      synopsis: s.synopsis ?? '',
      tags: Array.isArray(s.tags) ? s.tags : [],
      genres: Array.isArray(s.genres) ? s.genres : [],
      status: s.status ?? 'idea',
      order: s.order ?? si,
      createdAt: s.createdAt ?? now(),
      updatedAt: s.updatedAt ?? now(),
      chapters: (s.chapters ?? []).map((c: any, ci: number) => ({
        id: c.id,
        parentId: c.parentId ?? null,
        title: c.title ?? 'Глава',
        status: c.status ?? 'draft',
        content: c.content ?? null,
        plainText: c.plainText ?? '',
        wordCount: countWords(c.plainText ?? ''),
        order: c.order ?? ci,
        createdAt: c.createdAt ?? now(),
        updatedAt: c.updatedAt ?? now()
      }))
    })),
    characters: (legacy.characters ?? []).map((ch: any, index: number) => ({
      id: ch.id,
      order: ch.order ?? index,
      name: ch.name ?? 'Персонаж',
      role: ch.role ?? '',
      tags: Array.isArray(ch.tags) ? ch.tags : [],
      templateId: null,
      avatarPath: null,
      folderId: null,
      images: [],
      fields: [
        ...(ch.summary ? [{ id: uid(), label: 'Кратко', value: ch.summary }] : []),
        ...(ch.bio ? [{ id: uid(), label: 'Биография', value: ch.bio }] : [])
      ],
      createdAt: ch.createdAt ?? now(),
      updatedAt: ch.updatedAt ?? now()
    })),
    characterFolders: legacy.characterFolders ?? [],
    folders: (legacy.folders ?? []).map((folder: any) => ({
      ...folder,
      color: folder.color ?? '#f0b84b'
    })),
    boards: (legacy.boards ?? []).map((board: any, index: number) => ({
      ...board,
      order: board.order ?? index
    })),
    templates: legacy.templates ?? [],
    timelines: (legacy.timelines ?? []).map((timeline: any, timelineIndex: number) => ({
      ...timeline,
      order: timeline.order ?? timelineIndex,
      events: (timeline.events ?? []).map((event: any, index: number) => ({
        ...event,
        parentId: event.parentId ?? null,
        order: event.order ?? index
      }))
    })),
    hierarchies: (legacy.hierarchies ?? []).map((hierarchy: any) => ({
      id: hierarchy.id,
      title: hierarchy.title ?? 'Иерархия',
      orientation: hierarchy.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      nodes: (hierarchy.nodes ?? []).map((node: any) => ({
        id: node.id,
        parentId: node.parentId ?? null,
        title: node.title ?? 'Узел'
      }))
    })),
    genealogies: (legacy.genealogies ?? []).map((g: any, gi: number) => ({
      id: g.id,
      order: g.order ?? gi,
      title: g.title ?? 'Родословная',
      folderId: g.folderId ?? null,
      nodes: (g.nodes ?? []).map((n: any, ni: number) => ({
        id: n.id,
        parentId: n.parentId ?? null,
        characterId: n.characterId ?? null,
        title: n.title ?? '',
        order: n.order ?? ni
      }))
    }))
  }
  normalizeBoardStickers(project)
  return project
}

export function countWords(text: string): number {
  const t = (text || '').trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

function normalizeBoardStickers(project: Project): void {
  for (const board of project.boards) {
    for (const sticker of board.stickers) {
      sticker.kind ??= 'note'
    }
  }
}
