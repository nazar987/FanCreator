import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import JSZip from 'jszip'
import type { Project } from '@shared/types'
import { assetsDir, now, readProject, uid, writeProject } from './store'

const BACKUP_FORMAT = 'fancreator-project-backup'
const BACKUP_VERSION = 1

interface BackupManifest {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  appVersion: string
  exportedAt: number
  projectId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseProject(raw: string): Project {
  const value: unknown = JSON.parse(raw)
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    !Array.isArray(value.stories) ||
    !Array.isArray(value.characters)
  ) {
    throw new Error('В архиве нет корректных данных проекта.')
  }
  return value as unknown as Project
}

function parseManifest(raw: string): BackupManifest {
  const value: unknown = JSON.parse(raw)
  if (
    !isRecord(value) ||
    value.format !== BACKUP_FORMAT ||
    value.version !== BACKUP_VERSION ||
    typeof value.projectId !== 'string'
  ) {
    throw new Error('Файл не является резервной копией FanCreator.')
  }
  return value as unknown as BackupManifest
}

export function backupFileName(title: string): string {
  const safe = (title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'project')
    .replace(/[. ]+$/g, '')
    .slice(0, 80)
  const date = new Date().toISOString().slice(0, 10)
  return `FanCreator-${safe}-${date}.fancreator`
}

export async function exportProjectBackup(projectId: string, destination: string): Promise<void> {
  const project = await readProject(projectId)
  if (!project) throw new Error('Проект не найден.')

  const zip = new JSZip()
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: app.getVersion(),
    exportedAt: now(),
    projectId: project.id
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('project.json', JSON.stringify(project, null, 2))

  const dir = assetsDir(projectId)
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (!entry.isFile()) continue
    zip.file(`assets/${entry.name}`, await fs.readFile(path.join(dir, entry.name)))
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await fs.writeFile(destination, buffer)
}

export async function importProjectBackup(source: string): Promise<Project> {
  const zip = await JSZip.loadAsync(await fs.readFile(source), { checkCRC32: true })
  const manifestEntry = zip.file('manifest.json')
  const projectEntry = zip.file('project.json')
  if (!manifestEntry || !projectEntry) throw new Error('В резервной копии не хватает данных.')

  const manifest = parseManifest(await manifestEntry.async('string'))
  const original = parseProject(await projectEntry.async('string'))
  if (original.id !== manifest.projectId) throw new Error('Резервная копия повреждена.')

  const newId = uid()
  const serialized = JSON.stringify(original).replaceAll(`asset://${original.id}/`, `asset://${newId}/`)
  const restored = parseProject(serialized)
  restored.id = newId
  restored.title = `${restored.title} (восстановлено)`
  restored.createdAt = now()
  restored.updatedAt = now()

  const targetAssets = assetsDir(newId)
  await fs.mkdir(targetAssets, { recursive: true })
  try {
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !entry.name.startsWith('assets/')) continue
      const fileName = path.posix.basename(entry.name)
      if (!fileName || entry.name !== `assets/${fileName}`) continue
      await fs.writeFile(path.join(targetAssets, fileName), await entry.async('nodebuffer'))
    }
    return await writeProject(restored)
  } catch (error) {
    await fs.rm(path.dirname(targetAssets), { recursive: true, force: true })
    throw error
  }
}
