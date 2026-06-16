import React from 'react'
import { useStore } from '../store/store'
import type { ThemeName } from '@shared/types'

const THEMES: { name: ThemeName; color: string; label: string }[] = [
  { name: 'dark', color: '#8b8cf0', label: 'Тёмная' },
  { name: 'blue', color: '#5bb8e6', label: 'Синяя' },
  { name: 'violet', color: '#b98cf5', label: 'Фиолетовая' },
  { name: 'green', color: '#5fd39a', label: 'Зелёная' },
  { name: 'orange', color: '#f0a35b', label: 'Оранжевая' },
  { name: 'rose', color: '#f06b9b', label: 'Розовая' }
]

export function ThemeSwitcher(): React.JSX.Element {
  const { theme, setTheme } = useStore()
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
    </div>
  )
}
