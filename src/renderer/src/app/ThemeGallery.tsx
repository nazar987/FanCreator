import React from 'react'
import { createPortal } from 'react-dom'
import { Castle, Check, Gauge, Rocket, Skull, Sparkles, Swords, X, Zap } from 'lucide-react'
import type { ThemeName } from '@shared/types'
import {
  applyWorldPreferences,
  readWorldPreferences,
  type WorldIntensity,
  type WorldPreferences
} from '../theme/runtime'

interface ThemeOption {
  name: ThemeName
  title: string
  description: string
  icon: React.ReactNode
}

interface PaletteOption {
  name: ThemeName
  title: string
  color: string
}

const WORLDS: ThemeOption[] = [
  {
    name: 'fantasy',
    title: 'Высокое фэнтези',
    description: 'Лазурит, хрусталь, золотая филигрань и мягкое дыхание магии.',
    icon: <Swords size={16} />
  },
  {
    name: 'darkfantasy',
    title: 'Тёмное фэнтези',
    description: 'Базальт, кованое железо, старые клейма и тлеющие угли.',
    icon: <Skull size={16} />
  },
  {
    name: 'medieval',
    title: 'Средневековье',
    description: 'Манускрипт, пергамент, чернила, кожа и дубовый стол скриптория.',
    icon: <Castle size={16} />
  },
  {
    name: 'scifi',
    title: 'Научная фантастика',
    description: 'Титановая консоль, голографическое стекло и точная HUD-разметка.',
    icon: <Rocket size={16} />
  },
  {
    name: 'cyberpunk',
    title: 'Киберпанк',
    description: 'Корпоративный терминал, жёсткая геометрия и контролируемый глитч.',
    icon: <Zap size={16} />
  }
]

const PALETTES: PaletteOption[] = [
  { name: 'dark', title: 'Стандартная', color: '#8b8cf0' },
  { name: 'blue', title: 'Синяя', color: '#5bb8e6' },
  { name: 'violet', title: 'Фиолетовая', color: '#b98cf5' },
  { name: 'green', title: 'Зелёная', color: '#5fd39a' },
  { name: 'orange', title: 'Оранжевая', color: '#f0a35b' },
  { name: 'rose', title: 'Розовая', color: '#f06b9b' }
]

const THEME_LABELS = new Map<ThemeName, string>(
  [...WORLDS, ...PALETTES].map((item) => [item.name, item.title])
)

export function themeLabel(theme: ThemeName): string {
  return THEME_LABELS.get(theme) ?? 'Стандартная'
}

interface ThemeGalleryProps {
  current: ThemeName
  onApply: (theme: ThemeName) => void
  onClose: () => void
}

/**
 * Выпадающая справа панель тем (фидбэк: «как раньше», без модального окна).
 * Клик по миру или палитре применяет тему СРАЗУ (setTheme сохраняет её и в
 * проект) — панель остаётся открытой, чтобы «примерять» миры подряд.
 * Комфорт-настройки тоже применяются и сохраняются мгновенно.
 * Закрытие: клик вне панели, Escape или крестик.
 */
export function ThemeGallery({ current, onApply, onClose }: ThemeGalleryProps): React.JSX.Element {
  const [preferences, setPreferences] = React.useState<WorldPreferences>(() => readWorldPreferences())

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const setIntensity = (intensity: WorldIntensity): void => {
    const next = { ...preferences, intensity }
    setPreferences(next)
    applyWorldPreferences(next, true)
  }

  const setReduceMotion = (reduceMotion: boolean): void => {
    const next = { ...preferences, reduceMotion }
    setPreferences(next)
    applyWorldPreferences(next, true)
  }

  return createPortal(
    <>
      <div className="theme-popover-backdrop" onMouseDown={onClose} />
      <section
        className="ctx-menu theme-popover"
        role="dialog"
        aria-label="Тема оформления"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="theme-popover-head">
          <span className="theme-popover-eyebrow">
            <Sparkles size={12} /> Темы-миры
          </span>
          <button className="theme-popover-close" aria-label="Закрыть" title="Закрыть" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="theme-popover-worlds">
          {WORLDS.map((world) => (
            <button
              key={world.name}
              className={`theme-popover-world ${current === world.name ? 'is-selected' : ''}`}
              aria-pressed={current === world.name}
              onClick={() => onApply(world.name)}
            >
              <span className="theme-popover-world-icon">{world.icon}</span>
              <span className="theme-popover-world-copy">
                <span className="theme-popover-world-title">{world.title}</span>
                <span className="theme-popover-world-description">{world.description}</span>
              </span>
              {current === world.name && <Check size={15} className="theme-popover-check" />}
            </button>
          ))}
        </div>

        <div className="ctx-sep" />
        <div className="ctx-label">Классические палитры</div>
        <div className="theme-popover-palettes">
          {PALETTES.map((palette) => (
            <button
              key={palette.name}
              className={`theme-popover-palette ${current === palette.name ? 'is-selected' : ''}`}
              title={palette.title}
              aria-pressed={current === palette.name}
              onClick={() => onApply(palette.name)}
            >
              <span className="theme-popover-swatch" style={{ background: palette.color }} />
              <span>{palette.title}</span>
            </button>
          ))}
        </div>

        <div className="ctx-sep" />
        <div className="ctx-label">
          <Gauge size={12} /> Комфорт оформления
        </div>
        <div className="theme-popover-intensity" role="group" aria-label="Интенсивность оформления">
          <button
            className={preferences.intensity === 'calm' ? 'is-active' : ''}
            title="Меньше текстур, свечения и фонового движения"
            onClick={() => setIntensity('calm')}
          >
            Спокойный
          </button>
          <button
            className={preferences.intensity === 'immersive' ? 'is-active' : ''}
            title="Полная художественная подача выбранного мира"
            onClick={() => setIntensity('immersive')}
          >
            Атмосферный
          </button>
        </div>
        <label className="theme-popover-motion" title="Отключить глитч, сканирование, дыхание света и переходы миров">
          <input
            type="checkbox"
            checked={preferences.reduceMotion}
            onChange={(event) => setReduceMotion(event.target.checked)}
          />
          <span>Уменьшить движение</span>
        </label>
      </section>
    </>,
    document.body
  )
}
