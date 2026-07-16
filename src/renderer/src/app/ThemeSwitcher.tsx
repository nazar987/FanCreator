import React from 'react'
import { Sparkles } from 'lucide-react'
import { WORLD_THEMES } from '@shared/types'
import { useStore } from '../store/store'
import { applyWorldPreferences, readWorldPreferences } from '../theme/runtime'
import { ThemeGallery, themeLabel } from './ThemeGallery'

export function ThemeSwitcher(): React.JSX.Element {
  const { theme, setTheme } = useStore()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    applyWorldPreferences(readWorldPreferences())
  }, [])

  return (
    <>
      <button
        className={`theme-worlds ${WORLD_THEMES.includes(theme) ? 'theme-worlds--active' : ''}`}
        data-tour="theme"
        title={`Тема оформления: ${themeLabel(theme)}`}
        onClick={() => setOpen(true)}
      >
        <Sparkles size={13} />
      </button>
      {open && <ThemeGallery current={theme} onApply={setTheme} onClose={() => setOpen(false)} />}
    </>
  )
}
