import React from 'react'
import { Download, Sparkles, X } from 'lucide-react'
import type { UpdateStatus } from '@shared/api'
import { Button } from '../../shared/ui/components'

/** Уведомление об обновлении (в стиле Claude Desktop): «Установить обновление» в один клик. */
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
  if (status.state === 'checking' || status.state === 'none') return null

  // Готово к установке — заметная карточка с кнопкой в один клик
  if (status.state === 'ready') {
    return (
      <div className="update-banner update-banner--ready">
        <span className="update-banner-icon">
          <Sparkles size={18} />
        </span>
        <div className="update-banner-text">
          <div className="update-banner-title">Доступно обновление{status.version ? ` ${status.version}` : ''}</div>
          <div className="update-banner-sub">Нажмите, чтобы установить — приложение перезапустится</div>
        </div>
        <Button variant="primary" size="sm" onClick={() => window.api.updates.install()}>
          Установить обновление
        </Button>
        <button className="update-banner-close" onClick={() => setDismissed(true)} title="Позже">
          <X size={14} />
        </button>
      </div>
    )
  }

  // Скачивается в фоне
  return (
    <div className="update-banner">
      <Download size={16} />
      <span>
        {status.state === 'downloading'
          ? `Загрузка обновления… ${status.percent ?? 0}%`
          : status.state === 'available'
            ? 'Найдено обновление, загружаю…'
            : 'Не удалось проверить обновления'}
      </span>
      <button className="update-banner-close" onClick={() => setDismissed(true)} title="Скрыть">
        <X size={14} />
      </button>
    </div>
  )
}
