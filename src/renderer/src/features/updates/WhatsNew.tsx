import React from 'react'
import { Sparkles, X } from 'lucide-react'
import { Button } from '../../shared/ui/components'
import { CHANGELOG, compareVersions, type ReleaseNote } from './changelog'

// Версия, заметки которой пользователь уже видел и закрыл в окне «Что нового».
const SEEN_KEY = 'fancreator.whatsNewSeen'

// Императивное открытие окна «Что нового» (по клику на версию на стартовом экране).
let openExternal: (() => void) | null = null
export function openWhatsNew(): void {
  openExternal?.()
}

/**
 * Окошко «Что нового» — показывается один раз после обновления приложения.
 *
 * Логика: если текущую версию (__APP_VERSION__) пользователь ещё НЕ подтвердил
 * в этом окне (ключ SEEN_KEY), показываем заметки. Если он не видел окно никогда
 * (ключа нет) — показываем всю историю изменений, чтобы он сразу узнал, что нового;
 * иначе только версии новее уже виденной. После закрытия запоминаем текущую версию.
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

    // Эту версию уже показывали и закрыли — больше не беспокоим.
    if (seen && compareVersions(current, seen) <= 0) return

    const fresh = CHANGELOG.filter(
      (n) =>
        compareVersions(n.version, current) <= 0 &&
        (!seen || compareVersions(n.version, seen) > 0)
    )
    if (fresh.length) setNotes(fresh)
    else {
      // Заметок нет (версия выросла без записи в changelog) — просто отметим.
      try {
        localStorage.setItem(SEEN_KEY, current)
      } catch {
        /* ignore */
      }
    }
  }, [])

  // открытие по клику на версию — показываем всю историю изменений
  React.useEffect(() => {
    openExternal = () => setNotes(CHANGELOG)
    return () => {
      openExternal = null
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

        <div className="whatsnew-body">
          {notes.map((note) => (
            <div key={note.version} className="whatsnew-section">
              {notes.length > 1 && (
                <div className="whatsnew-subver">
                  <span className="whatsnew-badge">v{note.version}</span>
                  <span className="whatsnew-date">{note.date}</span>
                </div>
              )}
              <ul className="whatsnew-list">
                {note.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="modal-actions whatsnew-actions">
          <Button variant="primary" onClick={close}>
            Понятно
          </Button>
        </div>
      </div>
    </div>
  )
}
