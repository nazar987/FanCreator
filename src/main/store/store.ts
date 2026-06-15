import { app } from 'electron'
import { promises as fs } from 'fs'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Project, ProjectSummary } from '@shared/types'

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

export async function initStore(): Promise<void> {
  await ensureDir(PROJECTS_DIR)
  await migrateFromLegacy()
}

/** Список всех проектов в виде лёгких сводок (без контента глав). */
export async function listProjects(): Promise<ProjectSummary[]> {
  await ensureDir(PROJECTS_DIR)
  const ids = await fs.readdir(PROJECTS_DIR).catch(() => [])
  const summaries: ProjectSummary[] = []
  for (const id of ids) {
    const p = await readProject(id)
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

export async function readProject(projectId: string): Promise<Project | null> {
  const file = projectFile(projectId)
  try {
    const raw = await fs.readFile(file, 'utf8')
    return JSON.parse(raw) as Project
  } catch {
    return null
  }
}

export async function writeProject(project: Project): Promise<Project> {
  project.updatedAt = now()
  await ensureDir(projectDir(project.id))
  await fs.writeFile(projectFile(project.id), JSON.stringify(project, null, 2), 'utf8')
  return project
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const dir = projectDir(projectId)
  if (!existsSync(dir)) return false
  await fs.rm(dir, { recursive: true, force: true })
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
  return {
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
    characters: (legacy.characters ?? []).map((ch: any) => ({
      id: ch.id,
      name: ch.name ?? 'Персонаж',
      role: ch.role ?? '',
      tags: Array.isArray(ch.tags) ? ch.tags : [],
      templateId: null,
      avatarPath: null,
      fields: [
        ...(ch.summary ? [{ id: uid(), label: 'Кратко', value: ch.summary }] : []),
        ...(ch.bio ? [{ id: uid(), label: 'Биография', value: ch.bio }] : [])
      ],
      createdAt: ch.createdAt ?? now(),
      updatedAt: ch.updatedAt ?? now()
    }))
  }
}

export function countWords(text: string): number {
  const t = (text || '').trim()
  if (!t) return 0
  return t.split(/\s+/).length
}
