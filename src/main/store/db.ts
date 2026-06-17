import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import type { Project, ProjectSummary } from '@shared/types'

/**
 * SQLite-бэкенд хранилища (S-J). Проект хранится документом в строке + денормализованные
 * колонки для списка, плюс FTS5-индекс глав для быстрого поиска. Доступ — транзакционный.
 * Слой store.ts использует это с фолбэком на JSON, если БД не инициализируется.
 */

let db: Database.Database | null = null

export function initDb(): void {
  const file = path.join(app.getPath('userData'), 'FanCreator', 'fancreator.db')
  const instance = new Database(file)
  instance.pragma('journal_mode = WAL')
  instance.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT,
      cover_path TEXT,
      description TEXT,
      tags TEXT,
      story_count INTEGER,
      chapter_count INTEGER,
      updated_at INTEGER,
      data TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
      project_id UNINDEXED,
      story_id UNINDEXED,
      chapter_id UNINDEXED,
      story_title,
      chapter_title,
      body
    );
  `)
  db = instance
}

function ensure(): Database.Database {
  if (!db) throw new Error('SQLite не инициализирован')
  return db
}

export function dbProjectCount(): number {
  return (ensure().prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number }).c
}

export function dbListProjects(): ProjectSummary[] {
  const rows = ensure()
    .prepare(
      'SELECT id, title, cover_path, description, tags, story_count, chapter_count, updated_at FROM projects ORDER BY updated_at DESC'
    )
    .all() as Record<string, unknown>[]
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    coverPath: (r.cover_path as string) ?? null,
    description: (r.description as string) ?? '',
    tags: JSON.parse((r.tags as string) || '[]'),
    storyCount: (r.story_count as number) ?? 0,
    chapterCount: (r.chapter_count as number) ?? 0,
    updatedAt: (r.updated_at as number) ?? 0
  }))
}

export function dbReadProject(id: string): Project | null {
  const row = ensure().prepare('SELECT data FROM projects WHERE id = ?').get(id) as
    | { data: string }
    | undefined
  return row ? (JSON.parse(row.data) as Project) : null
}

export function dbWriteProject(project: Project): void {
  const d = ensure()
  const activeStories = project.stories.filter((s) => !s.deletedAt)
  const chapterCount = activeStories.reduce(
    (n, s) => n + s.chapters.filter((c) => !c.deletedAt).length,
    0
  )
  const tx = d.transaction(() => {
    d.prepare(
      `INSERT INTO projects (id, title, cover_path, description, tags, story_count, chapter_count, updated_at, data)
       VALUES (@id, @title, @cover, @desc, @tags, @sc, @cc, @ua, @data)
       ON CONFLICT(id) DO UPDATE SET
         title=@title, cover_path=@cover, description=@desc, tags=@tags,
         story_count=@sc, chapter_count=@cc, updated_at=@ua, data=@data`
    ).run({
      id: project.id,
      title: project.title,
      cover: project.coverPath,
      desc: project.description,
      tags: JSON.stringify(project.tags),
      sc: activeStories.length,
      cc: chapterCount,
      ua: project.updatedAt,
      data: JSON.stringify(project)
    })
    // FTS глав переписываем целиком для этого проекта — индекс всегда консистентен
    d.prepare('DELETE FROM chapters_fts WHERE project_id = ?').run(project.id)
    const ins = d.prepare(
      'INSERT INTO chapters_fts (project_id, story_id, chapter_id, story_title, chapter_title, body) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const s of project.stories) {
      if (s.deletedAt) continue
      for (const c of s.chapters) {
        if (c.deletedAt) continue
        ins.run(project.id, s.id, c.id, s.title, c.title || '', c.plainText || '')
      }
    }
  })
  tx()
}

export function dbDeleteProject(id: string): void {
  const d = ensure()
  const tx = d.transaction(() => {
    d.prepare('DELETE FROM projects WHERE id = ?').run(id)
    d.prepare('DELETE FROM chapters_fts WHERE project_id = ?').run(id)
  })
  tx()
}

export interface ChapterHit {
  projectId: string
  storyId: string
  chapterId: string
  storyTitle: string
  chapterTitle: string
  snippet: string
}

/** Полнотекстовый поиск по главам через FTS5. Пустой результат при ошибке синтаксиса. */
export function dbSearchChapters(query: string, projectId?: string): ChapterHit[] {
  const q = query.trim().replace(/"/g, '""')
  if (!q) return []
  const match = `"${q}"*`
  try {
    const sql = projectId
      ? 'SELECT project_id, story_id, chapter_id, story_title, chapter_title, snippet(chapters_fts, 5, "", "", "…", 12) AS snip FROM chapters_fts WHERE chapters_fts MATCH ? AND project_id = ? LIMIT 100'
      : 'SELECT project_id, story_id, chapter_id, story_title, chapter_title, snippet(chapters_fts, 5, "", "", "…", 12) AS snip FROM chapters_fts WHERE chapters_fts MATCH ? LIMIT 100'
    const rows = (projectId
      ? ensure().prepare(sql).all(match, projectId)
      : ensure().prepare(sql).all(match)) as Record<string, unknown>[]
    return rows.map((r) => ({
      projectId: r.project_id as string,
      storyId: r.story_id as string,
      chapterId: r.chapter_id as string,
      storyTitle: r.story_title as string,
      chapterTitle: r.chapter_title as string,
      snippet: (r.snip as string) ?? ''
    }))
  } catch {
    return []
  }
}
