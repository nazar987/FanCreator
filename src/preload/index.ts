import { contextBridge, ipcRenderer } from 'electron'
import type { FanCreatorApi } from '@shared/api'

const invoke = ipcRenderer.invoke.bind(ipcRenderer)

const api: FanCreatorApi = {
  projects: {
    list: () => invoke('projects:list'),
    get: (projectId) => invoke('projects:get', projectId),
    create: (input) => invoke('projects:create', input),
    update: (input) => invoke('projects:update', input),
    delete: (projectId) => invoke('projects:delete', projectId)
  },
  stories: {
    add: (input) => invoke('stories:add', input),
    update: (input) => invoke('stories:update', input),
    delete: (input) => invoke('stories:delete', input),
    setCover: (input) => invoke('stories:setCover', input),
    pickCover: (input) => invoke('stories:pickCover', input)
  },
  chapters: {
    add: (input) => invoke('chapters:add', input),
    update: (input) => invoke('chapters:update', input),
    delete: (input) => invoke('chapters:delete', input),
    reorder: (input) => invoke('chapters:reorder', input)
  },
  characters: {
    add: (input) => invoke('characters:add', input),
    update: (input) => invoke('characters:update', input),
    delete: (input) => invoke('characters:delete', input)
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
  }
}

contextBridge.exposeInMainWorld('api', api)
