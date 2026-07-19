import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import type { UserProfile } from '@shared/types'
import { listProjects, now } from './store'
import { backupFileName, exportProjectBackup } from './backup'

/* ============================================================
   ФАЗА 25 (S-V2): локальный профиль писателя + «подушка безопасности».
   profile.json лежит в корне данных приложения. Удаление профиля НЕ трогает
   проекты по умолчанию; полное удаление в UI открывается только после
   успешного бэкапа всех проектов.
   ============================================================ */

const PROFILE_FILE = path.join(app.getPath('userData'), 'FanCreator', 'profile.json')

function defaultProfile(): UserProfile {
  return {
    name: 'Писательница',
    emoji: '✒️',
    createdAt: now(),
    lastBackupAt: null,
    autoBackupDir: null
  }
}

export async function readProfile(): Promise<UserProfile> {
  try {
    const raw = await fs.readFile(PROFILE_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<UserProfile>
    if (typeof parsed.name !== 'string') throw new Error('corrupt')
    return {
      name: parsed.name,
      emoji: typeof parsed.emoji === 'string' && parsed.emoji ? parsed.emoji : '✒️',
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : now(),
      lastBackupAt: typeof parsed.lastBackupAt === 'number' ? parsed.lastBackupAt : null,
      autoBackupDir: typeof parsed.autoBackupDir === 'string' ? parsed.autoBackupDir : null
    }
  } catch {
    // первого запуска или битого файла достаточно, чтобы начать заново
    const profile = defaultProfile()
    await writeProfile(profile).catch(() => undefined)
    return profile
  }
}

async function writeProfile(profile: UserProfile): Promise<void> {
  await fs.mkdir(path.dirname(PROFILE_FILE), { recursive: true })
  await fs.writeFile(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8')
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  const profile = { ...(await readProfile()), ...patch }
  await writeProfile(profile)
  return profile
}

export async function deleteProfile(): Promise<void> {
  await fs.rm(PROFILE_FILE, { force: true })
}

/** Полный бэкап ВСЕХ проектов (включая корзину) в выбранную папку.
 * Возвращает число сохранённых архивов. Имя файла дополняется коротким id —
 * два проекта с одинаковым названием не перезапишут друг друга. */
export async function backupAllProjects(dir: string): Promise<number> {
  const summaries = [...(await listProjects(false)), ...(await listProjects(true))]
  for (const summary of summaries) {
    const base = backupFileName(summary.title)
    const name = base.replace(/\.fancreator$/, `-${summary.id.slice(0, 8)}.fancreator`)
    await exportProjectBackup(summary.id, path.join(dir, name))
  }
  if (summaries.length) await updateProfile({ lastBackupAt: now() })
  return summaries.length
}

/** Автобэкап при выходе: только проекты, изменённые после последнего бэкапа.
 * Ошибки глотаем — закрытие приложения важнее недописанного архива. */
export async function autoBackupChangedProjects(): Promise<void> {
  try {
    const profile = await readProfile()
    if (!profile.autoBackupDir) return
    await fs.mkdir(profile.autoBackupDir, { recursive: true })
    const since = profile.lastBackupAt ?? 0
    const summaries = [...(await listProjects(false)), ...(await listProjects(true))].filter(
      (s) => s.updatedAt > since
    )
    if (!summaries.length) return
    for (const summary of summaries) {
      const base = backupFileName(summary.title)
      const name = base.replace(/\.fancreator$/, `-${summary.id.slice(0, 8)}.fancreator`)
      await exportProjectBackup(summary.id, path.join(profile.autoBackupDir, name)).catch(
        () => undefined
      )
    }
    await updateProfile({ lastBackupAt: now() })
  } catch {
    /* не мешаем выходу из приложения */
  }
}
