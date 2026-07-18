import React from 'react'
import { Trophy } from 'lucide-react'
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_CHANGED_EVENT,
  readAchievements,
  type AchievementMap
} from './achievements'

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Получено'
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

export function AchievementGallery(): React.JSX.Element {
  const [earned, setEarned] = React.useState<AchievementMap>(readAchievements)

  React.useEffect(() => {
    const refresh = (): void => setEarned(readAchievements())
    window.addEventListener(ACHIEVEMENTS_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(ACHIEVEMENTS_CHANGED_EVENT, refresh)
  }, [])

  const earnedCount = ACHIEVEMENTS.filter((achievement) => earned[achievement.id]).length

  return (
    <div className="achievement-gallery">
      <div className="achievement-gallery-summary">
        <Trophy size={20} />
        <div>
          <strong>{earnedCount} из {ACHIEVEMENTS.length}</strong>
          <span>Награды хранятся только на этом устройстве.</span>
        </div>
      </div>
      <div className="achievement-grid">
        {ACHIEVEMENTS.map((achievement) => {
          const earnedAt = earned[achievement.id]
          return (
            <article
              key={achievement.id}
              className={`achievement-card ${earnedAt ? 'achievement-card--earned' : ''}`}
            >
              <span className="achievement-card-icon"><Trophy size={17} /></span>
              <div>
                <strong>{achievement.title}</strong>
                <small>{earnedAt ? formatDate(earnedAt) : achievement.hint}</small>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
