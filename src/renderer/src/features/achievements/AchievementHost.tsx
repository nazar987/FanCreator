import React from 'react'
import { Trophy } from 'lucide-react'
import { useStore } from '../../store/store'
import {
  evaluateProjectAchievements,
  subscribeAchievementUnlocks,
  type AchievementDefinition
} from './achievements'

export function AchievementHost(): React.JSX.Element | null {
  const { current } = useStore()
  const [queue, setQueue] = React.useState<AchievementDefinition[]>([])

  React.useEffect(
    () =>
      subscribeAchievementUnlocks((unlocked) => {
        setQueue((items) => [...items, ...unlocked])
      }),
    []
  )

  React.useEffect(() => {
    if (current) evaluateProjectAchievements(current)
  }, [current])

  React.useEffect(() => {
    if (!queue.length) return
    const timer = window.setTimeout(() => setQueue((items) => items.slice(1)), 3800)
    return () => window.clearTimeout(timer)
  }, [queue])

  const achievement = queue[0]
  if (!achievement) return null

  return (
    <div className="achievement-toast-wrap" aria-live="polite" aria-atomic="true">
      <button
        type="button"
        className="achievement-toast"
        title="Закрыть"
        onClick={() => setQueue((items) => items.slice(1))}
      >
        <span className="achievement-toast-icon"><Trophy size={18} /></span>
        <span>
          <small>Достижение</small>
          <strong>{achievement.title}</strong>
        </span>
      </button>
    </div>
  )
}
