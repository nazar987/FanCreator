import React from 'react'
import { PenLine, ArrowRight, FileText } from 'lucide-react'
import { useStore } from '../../store/store'
import { plural, pl } from '../../shared/plural'
import './continue-writing.css'

const compact = (n: number): string =>
  new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

/**
 * Дашборд «Continue writing» (S-D3): крупный блок «продолжить последнюю главу»,
 * сводка прогресса письма и быстрые переходы к недавним главам. Заполняет
 * правую/верхнюю часть библиотеки (идея из Wattpad/Notion).
 */
export function ContinueWriting(): React.JSX.Element | null {
  const { current, openTab } = useStore()
  if (!current) return null

  const chapters = current.stories
    .filter((s) => !s.deletedAt)
    .flatMap((s) => s.chapters.filter((c) => !c.deletedAt).map((c) => ({ c, s })))
    .sort((a, b) => b.c.updatedAt - a.c.updatedAt)

  if (chapters.length === 0) return null

  const [{ c: top, s: topStory }, ...rest] = chapters
  const recent = rest.slice(0, 3)

  const totalWords = chapters.reduce((sum, { c }) => sum + c.wordCount, 0)
  const doneCount = chapters.filter(({ c }) => c.status === 'done').length
  const donePct = Math.round((doneCount / chapters.length) * 100)

  const open = (storyId: string, chapter: (typeof chapters)[number]['c']): void =>
    openTab({
      id: `chapter:${chapter.id}`,
      kind: 'chapter',
      title: chapter.title || 'Без названия',
      storyId,
      chapterId: chapter.id
    })

  return (
    <section className="continue">
      <div
        className="continue-hero"
        role="button"
        tabIndex={0}
        onClick={() => open(topStory.id, top)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') open(topStory.id, top)
        }}
      >
        <div className="continue-hero-main">
          <span className="continue-eyebrow">
            <PenLine size={14} /> Продолжить писать
          </span>
          <div className="continue-hero-title truncate">{top.title || 'Без названия'}</div>
          <div className="continue-hero-sub truncate">
            {topStory.title} · {pl(top.wordCount, 'слово', 'слова', 'слов')}
          </div>
        </div>
        <button
          className="continue-hero-go"
          onClick={(e) => {
            e.stopPropagation()
            open(topStory.id, top)
          }}
        >
          Открыть <ArrowRight size={16} />
        </button>
      </div>

      <div className="continue-side">
        <div className="continue-stats">
          <div>
            <strong>{compact(totalWords)}</strong>
            <span>{plural(totalWords, 'слово', 'слова', 'слов')}</span>
          </div>
          <div>
            <strong>{donePct}%</strong>
            <span>готово</span>
          </div>
          <div>
            <strong>{chapters.length}</strong>
            <span>{plural(chapters.length, 'глава', 'главы', 'глав')}</span>
          </div>
        </div>
        {recent.length > 0 && (
          <div className="continue-recent">
            {recent.map(({ c, s }) => (
              <button key={c.id} className="continue-recent-item" onClick={() => open(s.id, c)}>
                <FileText size={14} />
                <span className="continue-recent-text">
                  <span className="truncate">{c.title || 'Без названия'}</span>
                  <small className="truncate">{s.title}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
