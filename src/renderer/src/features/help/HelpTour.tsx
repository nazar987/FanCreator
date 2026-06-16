import React from 'react'
import { Button } from '../../shared/ui/components'

interface TourStep {
  selector: string
  title: string
  text: string
}

const TOUR_EVENT = 'fancreator:start-tour'

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="library"]',
    title: 'Библиотека',
    text: 'Здесь лежат проекты или истории текущего проекта. Это ваша стартовая полка.'
  },
  {
    selector: '[data-tour="tree"]',
    title: 'Дерево проекта',
    text: 'В боковой панели живут истории и главы. Отсюда удобно открывать, искать и управлять структурой.'
  },
  {
    selector: '[data-tour="add-tab"]',
    title: 'Добавить вкладку',
    text: 'Кнопка «+» открывает библиотеку, персонажей, доски и таймлайны. Там же можно открыть или удалить доску и таймлайн.'
  },
  {
    selector: '[data-tour="editor-toolbar"]',
    title: 'Панель редактора',
    text: 'Когда открыта глава, здесь появляются инструменты форматирования текста и работы с документом.'
  },
  {
    selector: '[data-tour="theme"]',
    title: 'Темы',
    text: 'Переключайте оформление приложения под настроение и комфорт глаз.'
  }
]

export function startHelpTour(): void {
  window.dispatchEvent(new Event(TOUR_EVENT))
}

function getVisibleStep(start: number, direction: 1 | -1): number | null {
  for (let offset = 0; offset < STEPS.length; offset += 1) {
    const index = start + offset * direction
    if (index < 0 || index >= STEPS.length) break
    const element = document.querySelector(STEPS[index].selector)
    const rect = element?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) return index
  }
  return null
}

export function HelpTour(): React.JSX.Element | null {
  const [active, setActive] = React.useState(false)
  const [index, setIndex] = React.useState(0)
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  React.useEffect(() => {
    const start = (): void => {
      setIndex(getVisibleStep(0, 1) ?? 0)
      setActive(true)
    }
    window.addEventListener(TOUR_EVENT, start)
    return () => window.removeEventListener(TOUR_EVENT, start)
  }, [])

  React.useEffect(() => {
    if (!active) return

    const updateRect = (): void => {
      const element = document.querySelector(STEPS[index].selector)
      setRect(element?.getBoundingClientRect() ?? null)
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [active, index])

  if (!active) return null

  const step = STEPS[index]
  const padded = rect
    ? {
        left: Math.max(12, rect.left - 8),
        top: Math.max(12, rect.top - 8),
        width: rect.width + 16,
        height: rect.height + 16
      }
    : null
  const tooltipStyle = padded
    ? {
        left: Math.min(window.innerWidth - 340, Math.max(18, padded.left)),
        top:
          padded.top + padded.height + 14 < window.innerHeight - 190
            ? padded.top + padded.height + 14
            : Math.max(18, padded.top - 180)
      }
    : { left: Math.max(18, window.innerWidth / 2 - 160), top: Math.max(18, window.innerHeight / 2 - 100) }

  const goNext = (): void => {
    const next = getVisibleStep(index + 1, 1)
    if (next === null) setActive(false)
    else setIndex(next)
  }

  const goBack = (): void => {
    const prev = getVisibleStep(index - 1, -1)
    if (prev !== null) setIndex(prev)
  }

  return (
    <div className="help-tour" role="dialog" aria-modal="true" aria-label="Гид по приложению">
      {padded && (
        <div
          className="help-tour-target"
          style={{
            left: padded.left,
            top: padded.top,
            width: padded.width,
            height: padded.height
          }}
        />
      )}
      <div className="help-tour-card" style={tooltipStyle}>
        <div className="help-tour-count">
          Шаг {index + 1} из {STEPS.length}
        </div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="help-tour-actions">
          <Button variant="ghost" size="sm" onClick={() => setActive(false)}>
            Пропустить
          </Button>
          <Button variant="soft" size="sm" onClick={goBack} disabled={getVisibleStep(index - 1, -1) === null}>
            Назад
          </Button>
          <Button variant="primary" size="sm" onClick={goNext}>
            {getVisibleStep(index + 1, 1) === null ? 'Готово' : 'Далее'}
          </Button>
        </div>
      </div>
    </div>
  )
}
