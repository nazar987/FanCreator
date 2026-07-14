import React from 'react'
import { Sparkles, Swords, Skull, Castle, Rocket, Zap, Undo2 } from 'lucide-react'
import { useStore } from '../store/store'
import { openContextMenu } from '../shared/ui/ContextMenu'
import type { ThemeName } from '@shared/types'

const THEMES: { name: ThemeName; color: string; label: string }[] = [
  { name: 'dark', color: '#8b8cf0', label: 'Тёмная' },
  { name: 'blue', color: '#5bb8e6', label: 'Синяя' },
  { name: 'violet', color: '#b98cf5', label: 'Фиолетовая' },
  { name: 'green', color: '#5fd39a', label: 'Зелёная' },
  { name: 'orange', color: '#f0a35b', label: 'Оранжевая' },
  { name: 'rose', color: '#f06b9b', label: 'Розовая' }
]

/** Темы-миры: оформление под сеттинг истории (фидбэк «прикольная фишка»). */
const WORLDS: { name: ThemeName; icon: React.ReactNode; label: string }[] = [
  { name: 'fantasy', icon: <Swords size={14} />, label: 'Фэнтези — магия и золото' },
  { name: 'darkfantasy', icon: <Skull size={14} />, label: 'Тёмное фэнтези — пепел и угли' },
  { name: 'medieval', icon: <Castle size={14} />, label: 'Средневековье — таверна и свечи' },
  { name: 'scifi', icon: <Rocket size={14} />, label: 'Научная фантастика — неон и космос' },
  { name: 'cyberpunk', icon: <Zap size={14} />, label: 'Киберпанк — кислотный неон и глитч' }
]

export function ThemeSwitcher(): React.JSX.Element {
  const { theme, setTheme } = useStore()
  const activeWorld = WORLDS.find((w) => w.name === theme)
  return (
    <div className="theme-dots" data-tour="theme" title="Тема оформления">
      {THEMES.map((t) => (
        <button
          key={t.name}
          className={`theme-dot ${theme === t.name ? 'theme-dot--active' : ''}`}
          style={{ background: t.color }}
          title={t.label}
          onClick={() => setTheme(t.name)}
        />
      ))}
      <button
        className={`theme-worlds ${activeWorld ? 'theme-worlds--active' : ''}`}
        title={activeWorld ? `Тема-мир: ${activeWorld.label}` : 'Темы-миры (под сеттинг истории)'}
        onClick={(e) =>
          openContextMenu(e, [
            { type: 'label', label: 'Темы-миры' },
            ...WORLDS.map((w) => ({
              label: (theme === w.name ? '✓ ' : '') + w.label,
              icon: w.icon,
              onClick: () => setTheme(w.name)
            })),
            { type: 'sep' as const },
            {
              label: 'Вернуть стандартную тему',
              icon: <Undo2 size={14} />,
              disabled: !activeWorld,
              onClick: () => setTheme('dark')
            }
          ])
        }
      >
        <Sparkles size={13} />
      </button>
    </div>
  )
}
