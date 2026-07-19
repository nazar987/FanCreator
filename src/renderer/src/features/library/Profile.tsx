import React from 'react'
import { FolderDown, FolderCog, ShieldAlert, Trophy } from 'lucide-react'
import type { ProjectSummary, UserProfile } from '@shared/types'
import { Button, Input } from '../../shared/ui/components'
import { messageDialog, promptText } from '../../shared/ui/dialogs'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { plural } from '../../shared/plural'
import { ACHIEVEMENTS, readAchievements } from '../achievements/achievements'

/**
 * ФАЗА 25 (S-V2): локальный профиль писателя с «подушкой безопасности».
 * Удаление профиля по умолчанию НЕ трогает проекты; красный чекбокс полного
 * удаления открывается только после успешного бэкапа всех проектов в этой
 * сессии, а финальное подтверждение — вводом слова «удалить».
 */

const AVATAR_EMOJI = ['✒️', '📖', '🖋️', '🌙', '⭐', '🦋', '🌸', '🐈', '☕', '🔮', '🗡️', '🕯️']

interface ProfileModalProps {
  projects: ProjectSummary[]
  deletedProjects: ProjectSummary[]
  onProjectsChanged: () => Promise<void>
  onClose: () => void
}

const fmtDate = (ts: number): string =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(ts)

/** Чистим локальные следы профиля (достижения, цели); при полном удалении —
 * и пер-проектные ключи (цели дня, спринты, позиции прокрутки). */
function clearProfileStorage(alsoProjects: boolean): void {
  const exact = new Set(['fancreator.achievements', 'fancreator.achievement-goal-days'])
  const projectPrefixes = [
    'fancreator.today.',
    'fancreator.sprint.',
    'fancreator.scroll.',
    'fancreator.lastChapter.'
  ]
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key) continue
      if (exact.has(key) || (alsoProjects && projectPrefixes.some((p) => key.startsWith(p)))) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* localStorage недоступен — нечего чистить */
  }
}

export function ProfileModal({
  projects,
  deletedProjects,
  onProjectsChanged,
  onClose
}: ProfileModalProps): React.JSX.Element | null {
  const [profile, setProfile] = React.useState<UserProfile | null>(null)
  const [name, setName] = React.useState('')
  const [backupDone, setBackupDone] = React.useState(false)
  const [dangerOpen, setDangerOpen] = React.useState(false)
  const [alsoDeleteProjects, setAlsoDeleteProjects] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    void window.api.profile.get().then((p) => {
      setProfile(p)
      setName(p.name)
    })
  }, [])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  if (!profile) return null

  const totalProjects = projects.length
  const stories = projects.reduce((sum, p) => sum + p.storyCount, 0)
  const chapters = projects.reduce((sum, p) => sum + p.chapterCount, 0)
  const unlocked = Object.keys(readAchievements()).length

  const saveName = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === profile.name) {
      setName(profile.name)
      return
    }
    setProfile(await window.api.profile.update({ name: trimmed }))
  }

  const pickEmoji = (event: React.MouseEvent): void => {
    openContextMenu(
      event,
      AVATAR_EMOJI.map((emoji) => ({
        label: `${emoji}${emoji === profile.emoji ? '  ✓' : ''}`,
        onClick: () => {
          void window.api.profile.update({ emoji }).then(setProfile)
        }
      }))
    )
  }

  const backupAll = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.api.profile.backupAll()
      if (result.status === 'success') {
        setBackupDone(true)
        setProfile(await window.api.profile.get())
        await messageDialog({
          title: 'Бэкап готов',
          message: `Сохранено ${result.count} ${plural(result.count, 'архив', 'архива', 'архивов')} .fancreator в папку:\n${result.dir}`
        })
      } else if (result.status === 'error') {
        await messageDialog({ title: 'Не удалось сделать бэкап', message: result.message })
      }
    } finally {
      setBusy(false)
    }
  }

  const toggleAutoBackup = async (): Promise<void> => {
    if (profile.autoBackupDir) {
      setProfile(await window.api.profile.update({ autoBackupDir: null }))
      return
    }
    const updated = await window.api.profile.pickAutoBackupDir()
    if (updated) setProfile(updated)
  }

  const deleteProfile = async (): Promise<void> => {
    const word = await promptText({
      title: alsoDeleteProjects
        ? 'Введите «удалить», чтобы стереть профиль и ВСЕ проекты'
        : 'Введите «удалить», чтобы стереть профиль (проекты останутся)',
      placeholder: 'удалить',
      confirmLabel: 'Подтвердить'
    })
    if ((word ?? '').trim().toLowerCase() !== 'удалить') {
      if (word !== null) {
        await messageDialog({
          title: 'Удаление отменено',
          message: 'Слово подтверждения не совпало — ничего не удалено.'
        })
      }
      return
    }
    setBusy(true)
    try {
      await window.api.profile.delete({ deleteProjects: alsoDeleteProjects })
      clearProfileStorage(alsoDeleteProjects)
      await onProjectsChanged()
      await messageDialog({
        title: 'Профиль удалён',
        message: alsoDeleteProjects
          ? 'Профиль и все проекты удалены. Резервные копии остались в папке бэкапа.'
          : 'Профиль удалён. Все проекты остались на месте — при следующем открытии профиля он будет создан заново.'
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const totalForBackup = totalProjects + deletedProjects.length

  return (
    <div className="modal-overlay" onMouseDown={() => !busy && onClose()}>
      <div className="modal profile-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="profile-head">
          <button
            className="profile-avatar"
            title="Сменить аватар"
            onClick={pickEmoji}
            disabled={busy}
          >
            {profile.emoji}
          </button>
          <div className="profile-head-copy">
            <Input
              value={name}
              placeholder="Как вас называть?"
              onChange={(event) => setName(event.target.value)}
              onBlur={() => void saveName()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveName()
              }}
            />
            <span className="faint">В FanCreator с {fmtDate(profile.createdAt)}</span>
          </div>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <strong>{totalProjects}</strong>
            <span>{plural(totalProjects, 'проект', 'проекта', 'проектов')}</span>
          </div>
          <div className="profile-stat">
            <strong>{stories}</strong>
            <span>{plural(stories, 'история', 'истории', 'историй')}</span>
          </div>
          <div className="profile-stat">
            <strong>{chapters}</strong>
            <span>{plural(chapters, 'глава', 'главы', 'глав')}</span>
          </div>
          <div className="profile-stat">
            <strong>
              <Trophy size={13} /> {unlocked}/{ACHIEVEMENTS.length}
            </strong>
            <span>достижения</span>
          </div>
        </div>

        <div className="profile-section">
          <div className="profile-section-copy">
            <strong>Бэкап всех проектов</strong>
            <span className="faint">
              {profile.lastBackupAt
                ? `Последний бэкап: ${fmtDate(profile.lastBackupAt)}`
                : 'Бэкапов ещё не было'}
            </span>
          </div>
          <Button variant="soft" disabled={busy || totalForBackup === 0} onClick={backupAll}>
            <FolderDown size={16} /> Сохранить в папку…
          </Button>
        </div>

        <div className="profile-section">
          <div className="profile-section-copy">
            <strong>Автобэкап при выходе</strong>
            <span className="faint">
              {profile.autoBackupDir
                ? `Изменённые проекты сохраняются в: ${profile.autoBackupDir}`
                : 'При закрытии приложения изменённые проекты будут сохраняться в выбранную папку.'}
            </span>
          </div>
          <Button variant="soft" disabled={busy} onClick={() => void toggleAutoBackup()}>
            <FolderCog size={16} /> {profile.autoBackupDir ? 'Отключить' : 'Включить…'}
          </Button>
        </div>

        {!dangerOpen ? (
          <button className="profile-danger-link" onClick={() => setDangerOpen(true)}>
            Удалить профиль…
          </button>
        ) : (
          <div className="profile-danger">
            <div className="profile-danger-head">
              <ShieldAlert size={16} />
              <strong>Удаление профиля</strong>
            </div>
            <p>
              По умолчанию удаляются только имя, настройки и достижения — все проекты останутся
              на диске нетронутыми.
            </p>
            <label
              className={`profile-danger-check ${backupDone ? '' : 'profile-danger-check--locked'}`}
            >
              <input
                type="checkbox"
                disabled={!backupDone || busy}
                checked={alsoDeleteProjects}
                onChange={(event) => setAlsoDeleteProjects(event.target.checked)}
              />
              Удалить также ВСЕ проекты безвозвратно
            </label>
            {!backupDone && (
              <span className="faint profile-danger-hint">
                Чтобы открыть этот пункт, сначала сохраните бэкап всех проектов (кнопка выше) —
                это ваша страховка.
              </span>
            )}
            <div className="modal-actions">
              <Button variant="ghost" disabled={busy} onClick={() => setDangerOpen(false)}>
                Передумала
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void deleteProfile()}>
                {alsoDeleteProjects ? 'Удалить профиль и проекты' : 'Удалить только профиль'}
              </Button>
            </div>
          </div>
        )}

        {!dangerOpen && (
          <div className="modal-actions">
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Закрыть
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
