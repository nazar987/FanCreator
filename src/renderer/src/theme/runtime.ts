import type { ThemeName } from '@shared/types'
import { WORLD_THEMES } from '@shared/types'

export type WorldIntensity = 'calm' | 'immersive'

export interface WorldPreferences {
  intensity: WorldIntensity
  reduceMotion: boolean
}

const INTENSITY_KEY = 'fancreator.worldIntensity'
const REDUCE_MOTION_KEY = 'fancreator.reduceMotion'

export function applyThemeAttributes(theme: ThemeName): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  if (WORLD_THEMES.includes(theme)) root.setAttribute('data-world', theme)
  else root.removeAttribute('data-world')
}

export function readWorldPreferences(): WorldPreferences {
  try {
    const storedIntensity = localStorage.getItem(INTENSITY_KEY)
    return {
      intensity: storedIntensity === 'calm' ? 'calm' : 'immersive',
      reduceMotion: localStorage.getItem(REDUCE_MOTION_KEY) === 'true'
    }
  } catch {
    return { intensity: 'immersive', reduceMotion: false }
  }
}

export function applyWorldPreferences(preferences: WorldPreferences, persist = false): void {
  const root = document.documentElement
  root.setAttribute('data-world-intensity', preferences.intensity)
  if (preferences.reduceMotion) root.setAttribute('data-reduce-motion', 'true')
  else root.removeAttribute('data-reduce-motion')

  if (!persist) return
  try {
    localStorage.setItem(INTENSITY_KEY, preferences.intensity)
    localStorage.setItem(REDUCE_MOTION_KEY, String(preferences.reduceMotion))
  } catch {
    // Preferences still apply for the current session when storage is unavailable.
  }
}
