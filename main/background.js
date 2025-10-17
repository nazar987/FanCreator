import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import Store from 'electron-store'
import { dialog } from 'electron'
import fs from 'fs'
import mammoth from 'mammoth'
import { Document, Packer, Paragraph } from 'docx'


const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

const store = new Store({
  name: 'fanfic-data',
  defaults: {
    projects: {} // id -> Project
  }
})

// ----------------- Utils -----------------
const now = () => Date.now()
const uid = () => (globalThis.crypto?.randomUUID?.() || `${now()}-${Math.random().toString(16).slice(2)}`)

function getProjectsMap() {
  return store.get('projects') || {}
}
function setProjectsMap(map) {
  store.set('projects', map)
}
function listProjects() {
  const map = getProjectsMap()
  return Object.values(map)
}
function getProject(id) {
  const map = getProjectsMap()
  return map[id] || null
}
function putProject(project) {
  const map = getProjectsMap()
  map[project.id] = project
  setProjectsMap(map)
  return project
}
// --- сразу после объявления store ---  (рядом с const store = new Store(...))
function normalizeStore() {
  const data = store.get('projects')
  if (Array.isArray(data)) {
    const map = {}
    for (const p of data) map[p.id] = p
    store.set('projects', map)
  } else if (data == null) {
    store.set('projects', {})
  }
}
normalizeStore()


// ----------------- IPC API -----------------

// Projects
ipcMain.handle('projects:list', async () => {
  return listProjects()
})
ipcMain.handle('projects:create', async (_e, { title }) => {
  const id = uid()
  const project = {
    id,
    title,
    description: '',
    tags: [],
    createdAt: now(),
    updatedAt: now(),
    stories: [],        // {id,title,synopsis,status,order,chapters:[]}
    characters: []      // {id,name,role,summary,appearance,motivation,bio,tags,relations,images}
  }
  return putProject(project)
})
ipcMain.handle('projects:get', async (_e, { id }) => {
  return getProject(id)
})
ipcMain.handle('projects:update', async (_e, { id, patch }) => {
  const p = getProject(id)
  if (!p) return null
  const updated = { ...p, ...patch, updatedAt: now() }
  return putProject(updated)
})
ipcMain.handle('projects:delete', async (_e, { projectId }) => {
  const map = getProjectsMap()
  if (map && map[projectId]) {
    delete map[projectId]
    setProjectsMap(map)
  }
  return true
})


// Stories
ipcMain.handle('stories:add', async (_e, { projectId, title }) => {
  const p = getProject(projectId)
  if (!p) return null
  const sId = uid()
  const story = {
    id: sId,
    title,
    synopsis: '',
    status: 'idea',
    order: (p.stories?.length || 0),
    createdAt: now(),
    updatedAt: now(),
    chapters: [] // {id,title,order,status,content,plainText,updatedAt}
  }
  p.stories = [...(p.stories || []), story]
  p.updatedAt = now()
  return putProject(p)
})
ipcMain.handle('stories:update', async (_e, { projectId, storyId, patch }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.stories = (p.stories || []).map(s => s.id === storyId ? { ...s, ...patch, updatedAt: now() } : s)
  p.updatedAt = now()
  return putProject(p)
})

// Chapters
ipcMain.handle('chapters:add', async (_e, { projectId, storyId, title }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.stories = (p.stories || []).map(s => {
    if (s.id !== storyId) return s
    const cId = uid()
    const ch = {
      id: cId,
      title,
      order: (s.chapters?.length || 0),
      status: 'draft',
      content: null, // tiptap JSON
      plainText: '',
      updatedAt: now()
    }
    return { ...s, chapters: [...(s.chapters || []), ch], updatedAt: now() }
  })
  p.updatedAt = now()
  return putProject(p)
})
ipcMain.handle('chapters:update', async (_e, { projectId, storyId, chapterId, patch }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.stories = (p.stories || []).map(s => {
    if (s.id !== storyId) return s
    const chapters = (s.chapters || []).map(c => c.id === chapterId ? { ...c, ...patch, updatedAt: now() } : c)
    return { ...s, chapters, updatedAt: now() }
  })
  p.updatedAt = now()
  return putProject(p)
})

// Characters
ipcMain.handle('characters:add', async (_e, { projectId, name }) => {
  const p = getProject(projectId)
  if (!p) return null
  const chId = uid()
  const character = {
    id: chId,
    name,
    role: '',
    summary: '',
    appearance: '',
    motivation: '',
    bio: '',
    tags: [],
    relations: [],
    images: [],
    updatedAt: now()
  }
  p.characters = [...(p.characters || []), character]
  p.updatedAt = now()
  return putProject(p)
})
ipcMain.handle('characters:update', async (_e, { projectId, characterId, patch }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.characters = (p.characters || []).map(ch => ch.id === characterId ? { ...ch, ...patch, updatedAt: now() } : ch)
  p.updatedAt = now()
  return putProject(p)
})

// Search (simple linear search for MVP)
ipcMain.handle('search:query', async (_e, { query, projectId = null }) => {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  const projects = projectId ? [getProject(projectId)].filter(Boolean) : listProjects()
  const results = []

  for (const p of projects) {
    if ((p.title || '').toLowerCase().includes(q)) {
      results.push({ type: 'project', projectId: p.id, title: p.title, snippet: p.description || '' })
    }
    for (const s of p.stories || []) {
      if ((s.title || '').toLowerCase().includes(q) || (s.synopsis || '').toLowerCase().includes(q)) {
        results.push({ type: 'story', projectId: p.id, storyId: s.id, title: s.title, snippet: s.synopsis || '' })
      }
      for (const c of s.chapters || []) {
        if ((c.title || '').toLowerCase().includes(q) || (c.plainText || '').toLowerCase().includes(q)) {
          const snippet = (c.plainText || '')
          const idx = snippet.toLowerCase().indexOf(q)
          const around = idx >= 0 ? snippet.slice(Math.max(0, idx - 30), idx + q.length + 30) : ''
          results.push({ type: 'chapter', projectId: p.id, storyId: s.id, chapterId: c.id, title: `${s.title} — ${c.title}`, snippet: around })
        }
      }
    }
    for (const ch of p.characters || []) {
      const blob = `${ch.name} ${ch.role} ${ch.summary} ${ch.bio}`.toLowerCase()
      if (blob.includes(q)) {
        results.push({ type: 'character', projectId: p.id, characterId: ch.id, title: ch.name, snippet: ch.summary || '' })
      }
    }
  }
  return results.slice(0, 50)
})



// Reorder chapters
ipcMain.handle('chapters:reorder', async (_e, { projectId, storyId, fromIndex, toIndex }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.stories = (p.stories || []).map(s => {
    if (s.id !== storyId) return s
    const chapters = [...(s.chapters || [])]
    const [moved] = chapters.splice(fromIndex, 1)
    chapters.splice(toIndex, 0, moved)
    // reassign order
    const re = chapters.map((c, i) => ({ ...c, order: i }))
    return { ...s, chapters: re, updatedAt: now() }
  })
  p.updatedAt = now()
  return putProject(p)
})


// Delete story
ipcMain.handle('stories:delete', async (_e, { projectId, storyId }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.stories = (p.stories || []).filter(s => s.id !== storyId)
  p.updatedAt = now()
  return putProject(p)
})

// Delete chapter
ipcMain.handle('chapters:delete', async (_e, { projectId, storyId, chapterId }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.stories = (p.stories || []).map(s => {
    if (s.id !== storyId) return s
    const filtered = (s.chapters || []).filter(c => c.id !== chapterId)
    // reassign order
    const re = filtered.map((c, i) => ({ ...c, order: i }))
    return { ...s, chapters: re, updatedAt: now() }
  })
  p.updatedAt = now()
  return putProject(p)
})

// Delete character
ipcMain.handle('characters:delete', async (_e, { projectId, characterId }) => {
  const p = getProject(projectId)
  if (!p) return null
  p.characters = (p.characters || []).filter(ch => ch.id !== characterId)
  p.updatedAt = now()
  return putProject(p)
})

ipcMain.handle('docx:import', async (_e, { projectId, storyId, chapterId }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Word', extensions: ['docx'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths[0]) return null
  const buffer = fs.readFileSync(filePaths[0])
  const { value: html } = await mammoth.convertToHtml({ buffer })
  // сохраним как HTML + обновим plainText (простейшее «очищение»)
  const plainText = html.replace(/<[^>]+>/g, ' ')
  return ipcMain.emit('chapters:update', null, { projectId, storyId, chapterId, patch: { content: html, plainText } })
})

ipcMain.handle('docx:export', async (_e, { title = 'Глава', html }) => {
  // очень простой экспорт: каждый абзац — Paragraph
  const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  const doc = new Document({ sections: [{ children: text.split(/\n+/).map(t => new Paragraph(t)) }] })
  const buffer = await Packer.toBuffer(doc)
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: `${title}.docx`,
    filters: [{ name: 'Word', extensions: ['docx'] }]
  })
  if (canceled || !filePath) return false
  fs.writeFileSync(filePath, buffer)
  return true
})
// --------------- Window boot ---------------
;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.setMenuBarVisibility(false) // ← меню не показывается даже по Alt

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})