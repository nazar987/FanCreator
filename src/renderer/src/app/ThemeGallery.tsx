import React from 'react'
import { createPortal } from 'react-dom'
import { Castle, Check, Gauge, Rocket, Skull, Sparkles, Swords, X, Zap } from 'lucide-react'
import type { ThemeName } from '@shared/types'
import { Button } from '../shared/ui/components'
import {
  applyThemeAttributes,
  applyWorldPreferences,
  readWorldPreferences,
  type WorldIntensity,
  type WorldPreferences
} from '../theme/runtime'

interface ThemeOption {
  name: ThemeName
  title: string
  description: string
  signature: string
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
    signature: 'CHRONICLES',
    icon: <Swords size={17} />
  },
  {
    name: 'darkfantasy',
    title: 'Тёмное фэнтези',
    description: 'Базальт, кованое железо, старые клейма и тлеющие угли.',
    signature: 'FORBIDDEN ARCHIVE',
    icon: <Skull size={17} />
  },
  {
    name: 'medieval',
    title: 'Средневековье',
    description: 'Манускрипт, пергамент, чернила, кожа и дубовый стол скриптория.',
    signature: 'SCRIPTORIUM',
    icon: <Castle size={17} />
  },
  {
    name: 'scifi',
    title: 'Научная фантастика',
    description: 'Титановая консоль, голографическое стекло и точная HUD-разметка.',
    signature: 'STORY SYSTEM',
    icon: <Rocket size={17} />
  },
  {
    name: 'cyberpunk',
    title: 'Киберпанк',
    description: 'Корпоративный терминал, жёсткая геометрия и контролируемый глитч.',
    signature: 'NARRATIVE OS',
    icon: <Zap size={17} />
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

export function ThemeGallery({ current, onApply, onClose }: ThemeGalleryProps): React.JSX.Element {
  const [selected, setSelected] = React.useState<ThemeName>(current)
  const initialPreferences = React.useRef<WorldPreferences>(readWorldPreferences())
  const [preferences, setPreferences] = React.useState<WorldPreferences>(initialPreferences.current)
  const committed = React.useRef(false)

  const previewTheme = React.useCallback((theme: ThemeName) => {
    setSelected(theme)
    applyThemeAttributes(theme)
  }, [])

  const previewPreferences = React.useCallback((next: WorldPreferences) => {
    setPreferences(next)
    applyWorldPreferences(next)
  }, [])

  const cancel = React.useCallback(() => {
    applyThemeAttributes(current)
    applyWorldPreferences(initialPreferences.current)
    onClose()
  }, [current, onClose])

  const apply = (): void => {
    committed.current = true
    applyWorldPreferences(preferences, true)
    onApply(selected)
    onClose()
  }

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cancel])

  React.useEffect(
    () => () => {
      if (committed.current) return
      applyThemeAttributes(current)
      applyWorldPreferences(initialPreferences.current)
    },
    [current]
  )

  const setIntensity = (intensity: WorldIntensity): void => {
    previewPreferences({ ...preferences, intensity })
  }

  return createPortal(
    <div className="modal-overlay theme-gallery-overlay" onMouseDown={cancel}>
      <section
        className="modal theme-gallery"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-gallery-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="theme-gallery-head">
          <div>
            <div className="theme-gallery-eyebrow"><Sparkles size={13} /> Theme Worlds 3.0</div>
            <h3 id="theme-gallery-title">Выберите мир интерфейса</h3>
            <p>Предпросмотр применяется сразу. Проект изменится только после подтверждения.</p>
          </div>
          <button className="theme-gallery-close" aria-label="Закрыть" title="Закрыть" onClick={cancel}>
            <X size={18} />
          </button>
        </header>

        <div className="theme-gallery-body">
          <div className="theme-gallery-worlds">
            {WORLDS.map((world) => (
              <button
                key={world.name}
                className={`theme-world-card ${selected === world.name ? 'is-selected' : ''}`}
                aria-pressed={selected === world.name}
                onClick={() => previewTheme(world.name)}
              >
                <span className="theme-preview" data-preview={world.name} aria-hidden="true">
                  <span className="theme-preview-logo">
                    <span className="theme-preview-logo-mark">{world.icon}</span>
                    <span className="theme-preview-logo-copy">
                      <span className="theme-preview-logo-name">
                        <span>Fan</span>
                        <span>Creator</span>
                      </span>
                      <span className="theme-preview-logo-signature">{world.signature}</span>
                    </span>
                  </span>
                </span>
                <span className="theme-world-card-copy">
                  <span className="theme-world-card-title">{world.icon}{world.title}</span>
                  <span className="theme-world-card-description">{world.description}</span>
                </span>
                {selected === world.name && <Check className="theme-world-card-check" size={17} />}
              </button>
            ))}
          </div>

          <section className="theme-gallery-section">
            <div className="theme-gallery-section-title">Классические палитры</div>
            <div className="theme-gallery-palettes">
              {PALETTES.map((palette) => (
                <button
                  key={palette.name}
                  className={`theme-palette-card ${selected === palette.name ? 'is-selected' : ''}`}
                  aria-pressed={selected === palette.name}
                  onClick={() => previewTheme(palette.name)}
                >
                  <span className="theme-palette-swatch" style={{ background: palette.color }} />
                  <span>{palette.title}</span>
                  {selected === palette.name && <Check size={14} />}
                </button>
              ))}
            </div>
          </section>

          <section className="theme-gallery-section theme-gallery-comfort">
            <div className="theme-gallery-section-title"><Gauge size={14} /> Комфорт оформления</div>
            <div className="theme-intensity" role="group" aria-label="Интенсивность оформления">
              <button
                className={preferences.intensity === 'calm' ? 'is-active' : ''}
                onClick={() => setIntensity('calm')}
              >
                Спокойный
                <small>Меньше текстур, свечения и фонового движения</small>
              </button>
              <button
                className={preferences.intensity === 'immersive' ? 'is-active' : ''}
                onClick={() => setIntensity('immersive')}
              >
                Атмосферный
                <small>Полная художественная подача выбранного мира</small>
              </button>
            </div>
            <label className="theme-motion-toggle">
              <input
                type="checkbox"
                checked={preferences.reduceMotion}
                onChange={(event) => previewPreferences({ ...preferences, reduceMotion: event.target.checked })}
              />
              <span>
                Уменьшить движение
                <small>Отключить глитч, сканирование, дыхание света и переходы миров</small>
              </span>
            </label>
          </section>
        </div>

        <footer className="theme-gallery-actions">
          <span>Выбрано: <strong>{themeLabel(selected)}</strong></span>
          <div className="row">
            <Button variant="ghost" onClick={cancel}>Отмена</Button>
            <Button variant="primary" onClick={apply}><Check size={15} /> Применить</Button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  )
}
