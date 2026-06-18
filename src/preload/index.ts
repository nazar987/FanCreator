import { contextBridge, ipcRenderer } from 'electron'
import type { FanCreatorApi } from '@shared/api'

const invoke = ipcRenderer.invoke.bind(ipcRenderer)

const api: FanCreatorApi = {
  projects: {
    list: () => invoke('projects:list'),
    get: (projectId) => invoke('projects:get', projectId),
    create: (input) => invoke('projects:create', input),
    update: (input) => invoke('projects:update', input),
    delete: (projectId) => invoke('projects:delete', projectId),
    setCover: (input) => invoke('projects:setCover', input),
    pickCover: (input) => invoke('projects:pickCover', input)
  },
  stories: {
    add: (input) => invoke('stories:add', input),
    reorder: (input) => invoke('stories:reorder', input),
    update: (input) => invoke('stories:update', input),
    delete: (input) => invoke('stories:delete', input),
    restore: (input) => invoke('stories:restore', input),
    purge: (input) => invoke('stories:purge', input),
    setCover: (input) => invoke('stories:setCover', input),
    pickCover: (input) => invoke('stories:pickCover', input)
  },
  chapters: {
    add: (input) => invoke('chapters:add', input),
    update: (input) => invoke('chapters:update', input),
    delete: (input) => invoke('chapters:delete', input),
    restore: (input) => invoke('chapters:restore', input),
    purge: (input) => invoke('chapters:purge', input),
    reorder: (input) => invoke('chapters:reorder', input),
    setParent: (input) => invoke('chapters:setParent', input),
    move: (input) => invoke('chapters:move', input)
  },
  characters: {
    add: (input) => invoke('characters:add', input),
    update: (input) => invoke('characters:update', input),
    delete: (input) => invoke('characters:delete', input),
    applyTemplate: (input) => invoke('characters:applyTemplate', input)
  },
  templates: {
    add: (input) => invoke('templates:add', input),
    update: (input) => invoke('templates:update', input),
    delete: (input) => invoke('templates:delete', input)
  },
  boards: {
    add: (input) => invoke('boards:add', input),
    rename: (input) => invoke('boards:rename', input),
    delete: (input) => invoke('boards:delete', input),
    save: (input) => invoke('boards:save', input)
  },
  timelines: {
    add: (input) => invoke('timelines:add', input),
    rename: (input) => invoke('timelines:rename', input),
    delete: (input) => invoke('timelines:delete', input)
  },
  hierarchies: {
    add: (input) => invoke('hierarchies:add', input),
    rename: (input) => invoke('hierarchies:rename', input),
    delete: (input) => invoke('hierarchies:delete', input),
    update: (input) => invoke('hierarchies:update', input)
  },
  hierarchyNodes: {
    add: (input) => invoke('hierarchyNodes:add', input),
    update: (input) => invoke('hierarchyNodes:update', input),
    delete: (input) => invoke('hierarchyNodes:delete', input),
    reorder: (input) => invoke('hierarchyNodes:reorder', input)
  },
  timelineEvents: {
    add: (input) => invoke('timelineEvents:add', input),
    update: (input) => invoke('timelineEvents:update', input),
    delete: (input) => invoke('timelineEvents:delete', input),
    reorder: (input) => invoke('timelineEvents:reorder', input)
  },
  assets: {
    saveImage: (input) => invoke('assets:saveImage', input)
  },
  search: {
    query: (input) => invoke('search:query', input)
  },
  docx: {
    importToChapter: (input) => invoke('docx:importToChapter', input),
    exportChapter: (input) => invoke('docx:exportChapter', input)
  },
  updates: {
    check: () => ipcRenderer.send('updates:check'),
    install: () => ipcRenderer.send('updates:install'),
    onStatus: (cb) => {
      const handler = (_e: unknown, status: Parameters<typeof cb>[0]): void => cb(status)
      ipcRenderer.on('updates:status', handler as never)
      return () => ipcRenderer.removeListener('updates:status', handler as never)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
