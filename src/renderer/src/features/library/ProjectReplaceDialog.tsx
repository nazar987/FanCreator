import React from 'react'
import { Replace, Search, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store/store'
import { Button, Input } from '../../shared/ui/components'
import { messageDialog } from '../../shared/ui/dialogs'
import { plural } from '../../shared/plural'
import {
  findProjectReplaceHits,
  replaceChapterContent,
  type ReplaceOptions
} from './projectReplace'

const OPEN_EVENT = 'fancreator:project-replace'

export function openProjectReplace(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function ProjectReplaceDialog(): React.JSX.Element | null {
  const { current, applyProject } = useStore()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [replacement, setReplacement] = React.useState('')
  const [options, setOptions] = React.useState<ReplaceOptions>({
    caseSensitive: false,
    wholeWord: false
  })
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [resultMessage, setResultMessage] = React.useState('')

  React.useEffect(() => {
    const show = (): void => {
      setResultMessage('')
      setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || busy) return
      event.preventDefault()
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, busy])

  React.useEffect(() => {
    if (!current) setOpen(false)
  }, [current])

  const hits = React.useMemo(
    () => (current && query ? findProjectReplaceHits(current, query, options) : []),
    [current, query, options]
  )
  const hitIds = React.useMemo(() => hits.map((hit) => hit.id).join('|'), [hits])

  React.useEffect(() => {
    setSelected(new Set(hits.map((hit) => hit.id)))
    setResultMessage('')
  }, [hitIds])

  if (!open || !current) return null

  const selectedHits = hits.filter((hit) => selected.has(hit.id))
  const selectedOccurrences = selectedHits.reduce((sum, hit) => sum + hit.count, 0)

  const toggleHit = (id: string): void => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const replaceSelected = async (): Promise<void> => {
    if (!selectedHits.length || !query) return
    const changes: {
      storyId: string
      chapterId: string
      content: unknown
      plainText: string
    }[] = []
    let occurrenceCount = 0

    for (const hit of selectedHits) {
      const chapter = current.stories
        .find((story) => story.id === hit.storyId)
        ?.chapters.find((item) => item.id === hit.chapterId)
      if (!chapter) continue
      const patch = replaceChapterContent(chapter, query, replacement, options)
      if (!patch) continue
      changes.push({
        storyId: hit.storyId,
        chapterId: hit.chapterId,
        content: patch.content,
        plainText: patch.plainText
      })
      occurrenceCount += patch.count
    }
    if (!changes.length) return

    setBusy(true)
    try {
      const updated = await window.api.projectReplace.apply({ projectId: current.id, changes })
      applyProject(updated)
      setResultMessage(
        `Заменено ${occurrenceCount} ${plural(occurrenceCount, 'вхождение', 'вхождения', 'вхождений')} в ${changes.length} ${plural(changes.length, 'главе', 'главах', 'главах')}. Снапшоты сохранены.`
      )
      setSelected(new Set())
    } catch (error) {
      await messageDialog({
        title: 'Не удалось выполнить замену',
        message: error instanceof Error ? error.message : 'Изменения не применены.'
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={() => !busy && setOpen(false)}>
      <div className="modal project-replace-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="project-replace-title">
          <div>
            <h3>Найти и заменить в проекте</h3>
            <p>Изменяется только текст глав. Разметка, ссылки и атрибуты остаются на месте.</p>
          </div>
          <ShieldCheck size={20} aria-label="Перед заменой создаются снапшоты" />
        </div>

        <div className="project-replace-fields">
          <label>
            <span>Найти</span>
            <Input
              autoFocus
              icon={<Search size={15} />}
              value={query}
              placeholder="Текст для поиска"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>Заменить на</span>
            <Input
              value={replacement}
              placeholder="Можно оставить пустым"
              onChange={(event) => setReplacement(event.target.value)}
            />
          </label>
        </div>

        <div className="project-replace-options">
          <label>
            <input
              type="checkbox"
              checked={options.caseSensitive}
              onChange={(event) =>
                setOptions((value) => ({ ...value, caseSensitive: event.target.checked }))
              }
            />
            Учитывать регистр
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.wholeWord}
              onChange={(event) =>
                setOptions((value) => ({ ...value, wholeWord: event.target.checked }))
              }
            />
            Только целые слова
          </label>
        </div>

        <div className="project-replace-summary">
          <span>
            {query
              ? (() => {
                  const occurrenceCount = hits.reduce((sum, hit) => sum + hit.count, 0)
                  return `${occurrenceCount} ${plural(occurrenceCount, 'вхождение', 'вхождения', 'вхождений')} · ${hits.length} ${plural(hits.length, 'глава', 'главы', 'глав')}`
                })()
              : 'Введите текст для поиска по всем главам проекта'}
          </span>
          {hits.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setSelected(selected.size === hits.length ? new Set() : new Set(hits.map((hit) => hit.id)))
              }
            >
              {selected.size === hits.length ? 'Снять все' : 'Выбрать все'}
            </button>
          )}
        </div>

        {hits.length > 0 ? (
          <div className="project-replace-list">
            {hits.map((hit) => (
              <label className="project-replace-hit" key={hit.id}>
                <input
                  type="checkbox"
                  checked={selected.has(hit.id)}
                  onChange={() => toggleHit(hit.id)}
                />
                <span className="project-replace-hit-copy">
                  <strong>{hit.chapterTitle}</strong>
                  <small>{hit.storyTitle}</small>
                  <span>
                    {hit.snippet.before}<mark>{hit.snippet.match}</mark>{hit.snippet.after}
                  </span>
                </span>
                <span className="project-replace-count">{hit.count}</span>
              </label>
            ))}
          </div>
        ) : query ? (
          <div className="project-replace-empty">Совпадений в текстовых узлах не найдено.</div>
        ) : null}

        {resultMessage && <div className="project-replace-result">{resultMessage}</div>}

        <div className="modal-actions">
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
            Закрыть
          </Button>
          <Button
            variant="primary"
            disabled={busy || selectedOccurrences === 0}
            onClick={replaceSelected}
          >
            <Replace size={16} />
            {busy ? 'Замена…' : `Заменить выбранные · ${selectedOccurrences}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
