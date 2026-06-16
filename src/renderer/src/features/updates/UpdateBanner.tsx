import React from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from '@shared/api'
import { Button } from '../../shared/ui/components'

/** Ненавязчивый баннер статуса авто-обновления (S-H). */
export function UpdateBanner(): React.JSX.Element | null {
  const [status, setStatus] = React.useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    return window.api.updates.onStatus((s) => {
      setStatus(s)
      setDismissed(false)
    })
  }, [])

  if (!status || dismissed) return null
  // показываем только значимые состояния
  if (status.state === 'checking' || status.state === 'none') return null

  return (
    <div className="update-banner">
      {status.state === 'available' && (
        <span className="row" style={{ gap: 8 }}>
          <Download size={16} /> Доступно обновление {status.version}, загружаю…
        </span>
      )}
      {status.state === 'downloading' && (
        <span className="row" style={{ gap: 8 }}>
          <Download size={16} /> Загрузка обновления… {status.percent ?? 0}%
        </span>
      )}
      {status.state === 'ready' && (
        <>
          <span className="row" style={{ gap: 8 }}>
            <RefreshCw size={16} /> Обновление {status.version} готово
          </span>
          <Button variant="primary" size="sm" onClick={() => window.api.updates.install()}>
            Перезапустить
          </Button>
        </>
      )}
      {status.state === 'error' && (
        <span className="dim">Не удалось проверить обновления</span>
      )}
      <button className="update-banner-close" onClick={() => setDismissed(true)} title="Скрыть">
        <X size={14} />
      </button>
    </div>
  )
}
