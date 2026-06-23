import React from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '../../shared/ui/components'
import { CHANGELOG, compareVersions, type ReleaseNote } from './changelog'

const SEEN_KEY = 'fancreator.lastSeenVersion'

/**
 * Окошко «Что нового» — показывается один раз после обновления приложения.
 * Сравниваем текущую версию (__APP_VERSION__) с последней, которую видел
 * пользователь (localStorage). Если приложение обновилось — показываем
 * заметки по всем версиям новее виденной. На самом первом запуске (когда
 * ничего не сохранено) окно не показываем — просто запоминаем версию.
 */
export function WhatsNew(): React.JSX.Element | null {
  const [notes, setNotes] = React.useState<ReleaseNote[]>([])

  React.useEffect(() => {
    const current = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
    if (!current) return
    let seen: string | null = null
    try {
      seen = localStorage.getItem(SEEN_KEY)
    } catch {
      /* localStorage недоступен — не критично */
    }

    // Первый запуск (ничего не видели) — не надоедаем, просто запоминаем версию.
    if (!seen) {
      try {
        localStorage.setItem(SEEN_KEY, current)
      } catch {
        /* ignore */
      }
      return
    }

    // Версия не менялась — ничего не показываем.
    if (compareVersions(current, seen) <= 0) return

    const fresh = CHANGELOG.filter(
      (n) => compareVersions(n.version, seen as string) > 0 && compareVersions(n.version, current) <= 0
    )
    if (fresh.length) setNotes(fresh)
    else {
      // Заметок нет, но версия выросла — всё равно отметим как просмотренную.
      try {
        localStorage.setItem(SEEN_KEY, current)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const close = (): void => {
    try {
      localStorage.setItem(SEEN_KEY, typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '')
    } catch {
      /* ignore */
    }
    setNotes([])
  }

  if (!notes.length) return null

  return (
    <div className="modal-overlay" onMouseDown={close}>
      <div className="modal whatsnew" onMouseDown={(e) => e.stopPropagation()}>
        <button className="whatsnew-close" onClick={close} title="Закрыть">
          <X size={16} />
        </button>
        <div className="whatsnew-head">
          <span className="whatsnew-icon">
            <Sparkles size={22} />
          </span>
          <div>
            <h3>Что нового</h3>
            <div className="dim whatsnew-version">
              Версия {notes[0].version} · {notes[0].date}
            </div>
          </div>
        </div>

        {notes.map((note) => (
          <div key={note.version} className="whatsnew-section">
            {notes.length > 1 && (
              <div className="whatsnew-subver">
                Версия {note.version} · {note.date}
              </div>
            )}
            <ul className="whatsnew-list">
              {note.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}

        <div className="modal-actions">
          <Button variant="primary" onClick={close}>
            Понятно
          </Button>
        </div>
      </div>
    </div>
  )
}
