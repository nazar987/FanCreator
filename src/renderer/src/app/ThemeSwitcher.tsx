import React from 'react'
import { Sparkles, Swords, Skull, Castle, Rocket, Zap } from 'lucide-react'
import { useStore } from '../store/store'
import { openContextMenu } from '../shared/ui/ContextMenu'
import type { ThemeName } from '@shared/types'

/** Классические палитры: стандартная тёмная + акцентные. */
const PALETTES: { name: ThemeName; color: string; label: string }[] = [
  { name: 'dark', color: '#8b8cf0', label: 'Стандартная' },
  { name: 'blue', color: '#5bb8e6', label: 'Синяя' },
  { name: 'violet', color: '#b98cf5', label: 'Фиолетовая' },
  { name: 'green', color: '#5fd39a', label: 'Зелёная' },
  { name: 'orange', color: '#f0a35b', label: 'Оранжевая' },
  { name: 'rose', color: '#f06b9b', label: 'Розовая' }
]

/** Темы-миры: полноценные визуальные вселенные под сеттинг истории. */
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
  const activePalette = PALETTES.find((p) => p.name === theme)
  const current = activeWorld?.label ?? activePalette?.label ?? 'Стандартная'
  return (
    <button
      className={`theme-worlds ${activeWorld ? 'theme-worlds--active' : ''}`}
      data-tour="theme"
      title={`Тема оформления: ${current}`}
      onClick={(e) =>
        openContextMenu(e, [
          { type: 'label', label: 'Классические палитры' },
          ...PALETTES.map((p) => ({
            label: (theme === p.name ? '✓ ' : '') + p.label,
            icon: <span className="theme-menu-dot" style={{ background: p.color }} />,
            onClick: () => setTheme(p.name)
          })),
          { type: 'sep' as const },
          { type: 'label', label: 'Темы-миры' },
          ...WORLDS.map((w) => ({
            label: (theme === w.name ? '✓ ' : '') + w.label,
            icon: w.icon,
            onClick: () => setTheme(w.name)
          }))
        ])
      }
    >
      <Sparkles size={13} />
    </button>
  )
}
