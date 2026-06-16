import React from 'react'
import { Plus, Trash2, List, GitFork, ImageDown } from 'lucide-react'
import type { BoardSticker, TimelineEvent } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Input } from '../../shared/ui/components'
import { confirmDialog, promptText } from '../../shared/ui/dialogs'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { buildFishboneImage } from './fishboneImage'

interface TimelineEventCardProps {
  event: TimelineEvent
  onUpdate: (
    eventId: string,
    patch: Partial<Pick<TimelineEvent, 'title' | 'note' | 'order'>>
  ) => Promise<void>
  onDelete: (event: TimelineEvent) => Promise<void>
}

/** Раскладка «рыбья кость» (Исикава): хребет + наклонные кости-события (S-C). */
function Fishbone({
  title,
  events,
  onEdit,
  onDelete
}: {
  title: string
  events: TimelineEvent[]
  onEdit: (event: TimelineEvent) => void
  onDelete: (event: TimelineEvent) => Promise<void>
}): React.JSX.Element {
  const STEP = 200
  const START_X = 80
  const SPINE_Y = 200
  const REACH = 130
  const BONE_DX = 34

  const width = START_X + events.length * STEP + 200
  const height = 400
  const endX = START_X + events.length * STEP + 40

  return (
    <div className="fishbone-scroll">
      <div className="fishbone" style={{ width, height }}>
        <svg className="fishbone-svg" width={width} height={height}>
          <defs>
            <marker id="fishbone-head" markerWidth="14" markerHeight="14" refX="10" refY="6" orient="auto">
              <path d="M0,0 L12,6 L0,12 Z" fill="var(--accent)" />
            </marker>
          </defs>
          {/* хребет */}
          <line
            x1={START_X - 30}
            y1={SPINE_Y}
            x2={endX}
            y2={SPINE_Y}
            stroke="var(--accent)"
            strokeWidth="4"
            markerEnd="url(#fishbone-head)"
          />
          {/* кости */}
          {events.map((event, i) => {
            const footX = START_X + (i + 1) * STEP - STEP / 2
            const up = i % 2 === 0
            const nodeX = footX - BONE_DX
            const nodeY = up ? SPINE_Y - REACH : SPINE_Y + REACH
            return (
              <line
                key={event.id}
                x1={footX}
                y1={SPINE_Y}
                x2={nodeX}
                y2={nodeY}
                stroke="var(--stroke-strong)"
                strokeWidth="2"
              />
            )
          })}
        </svg>

        {/* «голова рыбы» — цель/итог */}
        <div className="fishbone-head-label" style={{ left: endX + 6, top: SPINE_Y }}>
          {title}
        </div>

        {/* узлы-события */}
        {events.map((event, i) => {
          const footX = START_X + (i + 1) * STEP - STEP / 2
          const up = i % 2 === 0
          const nodeX = footX - BONE_DX
          const nodeY = up ? SPINE_Y - REACH : SPINE_Y + REACH
          return (
            <div
              key={event.id}
              className="fishbone-node"
              style={{ left: nodeX, top: nodeY }}
              title={event.note || undefined}
              onClick={() => onEdit(event)}
            >
              <div className="fishbone-node-order">{i + 1}</div>
              <div className="fishbone-node-title truncate">{event.title}</div>
              {event.note && <div className="fishbone-node-note">{event.note}</div>}
              <button
                className="fishbone-node-del"
                title="Удалить событие"
                onClick={(e) => {
                  e.stopPropagation()
                  void onDelete(event)
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelineEventCard({
  event,
  onUpdate,
  onDelete
}: TimelineEventCardProps): React.JSX.Element {
  const [title, setTitle] = React.useState(event.title)
  const [note, setNote] = React.useState(event.note)

  React.useEffect(() => {
    setTitle(event.title)
    setNote(event.note)
  }, [event])

  const saveTitle = async (): Promise<void> => {
    const next = title.trim()
    if (!next) {
      setTitle(event.title)
      return
    }
    if (next !== event.title) await onUpdate(event.id, { title: next })
  }

  const saveNote = async (): Promise<void> => {
    if (note !== event.note) await onUpdate(event.id, { note })
  }

  return (
    <div className="timeline-event">
      <div className="timeline-event-marker">{event.order + 1}</div>
      <Card className="timeline-event-card">
        <div className="timeline-event-head">
          <Input
            value={title}
            aria-label="Название события"
            placeholder="Название события"
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            onBlur={saveTitle}
          />
          <Button
            variant="ghost"
            size="sm"
            icon
            title="Удалить событие"
            onClick={() => onDelete(event)}
          >
            <Trash2 size={15} />
          </Button>
        </div>
        <textarea
          className="input timeline-event-note"
          value={note}
          placeholder="Заметка, контекст, последствия..."
          onChange={(changeEvent) => setNote(changeEvent.target.value)}
          onBlur={saveNote}
        />
      </Card>
    </div>
  )
}

export function Timeline({ timelineId }: { timelineId: string }): React.JSX.Element {
  const { current, applyProject, openTab } = useStore()
  const timeline = current?.timelines.find((item) => item.id === timelineId)
  const [view, setView] = React.useState<'list' | 'fishbone'>('list')

  if (!current || !timeline) {
    return <div className="timeline-missing dim">Таймлайн не найден</div>
  }

  const events = [...timeline.events].sort((a, b) => a.order - b.order)

  const addEvent = async (): Promise<void> => {
    const title = await promptText({
      title: 'Новое событие',
      placeholder: 'Название события'
    })
    if (!title) return
    applyProject(
      await window.api.timelineEvents.add({
        projectId: current.id,
        timelineId,
        title
      })
    )
  }

  const updateEvent = async (
    eventId: string,
    patch: Partial<Pick<TimelineEvent, 'title' | 'note' | 'order'>>
  ): Promise<void> => {
    applyProject(
      await window.api.timelineEvents.update({
        projectId: current.id,
        timelineId,
        eventId,
        patch
      })
    )
  }

  const deleteEvent = async (event: TimelineEvent): Promise<void> => {
    const confirmed = await confirmDialog({
      title: `Удалить событие «${event.title}»?`,
      confirmLabel: 'Удалить',
      danger: true
    })
    if (!confirmed) return
    applyProject(
      await window.api.timelineEvents.delete({
        projectId: current.id,
        timelineId,
        eventId: event.id
      })
    )
  }

  // S-I: экспорт схемы «рыбья кость» картинкой на доску
  const exportToBoard = async (e: React.MouseEvent): Promise<void> => {
    if (!current || events.length === 0) return
    const { dataUrl, width, height } = await buildFishboneImage(timeline.title, events)
    const imagePath = await window.api.assets.saveImage({ projectId: current.id, dataUrl })

    const w = Math.min(560, width)
    const h = Math.round((w * height) / width)
    const makeSticker = (): BoardSticker => ({
      id: crypto.randomUUID(),
      x: 120,
      y: 120,
      w,
      h,
      color: '#ffffff',
      shape: 'rect',
      kind: 'image',
      imagePath,
      text: `${timeline.title} — схема`
    })

    const addTo = async (boardId: string, stickers: BoardSticker[], arrows: typeof current.boards[number]['arrows']): Promise<void> => {
      const p = await window.api.boards.save({
        projectId: current.id,
        boardId,
        stickers: [...stickers, makeSticker()],
        arrows
      })
      applyProject(p)
      const b = p?.boards.find((x) => x.id === boardId)
      if (b) openTab({ id: `board:${b.id}`, kind: 'board', title: b.title, boardId: b.id })
    }

    const createAndAdd = async (): Promise<void> => {
      const p = await window.api.boards.add({ projectId: current.id, title: `${timeline.title} — доска` })
      applyProject(p)
      const b = p?.boards[p.boards.length - 1]
      if (b) await addTo(b.id, b.stickers, b.arrows)
    }

    if (current.boards.length === 0) {
      await createAndAdd()
      return
    }
    openContextMenu(e, [
      { type: 'label', label: 'Добавить схему на доску' },
      ...current.boards.map((b) => ({
        label: b.title,
        onClick: () => addTo(b.id, b.stickers, b.arrows)
      })),
      { type: 'sep' },
      { label: '＋ Новая доска', onClick: createAndAdd }
    ])
  }

  // компонент «рыбья кость» определён ниже
  return (
    <div className="timeline" data-tour="timeline">
      <div className="timeline-inner">
        <div className="timeline-head">
          <div>
            <div className="home-title" style={{ fontSize: 24 }}>
              {timeline.title}
            </div>
            <div className="home-sub">
              {events.length} событий в таймлайне
            </div>
          </div>
          <div className="row">
            <div className="timeline-view-switch">
              <button
                className={view === 'list' ? 'is-active' : ''}
                onClick={() => setView('list')}
                title="Список"
              >
                <List size={15} /> Список
              </button>
              <button
                className={view === 'fishbone' ? 'is-active' : ''}
                onClick={() => setView('fishbone')}
                title="Рыбья кость"
              >
                <GitFork size={15} /> Рыбья кость
              </button>
            </div>
            {view === 'fishbone' && events.length > 0 && (
              <Button variant="soft" onClick={exportToBoard} title="Сохранить схему как элемент доски">
                <ImageDown size={16} /> На доску
              </Button>
            )}
            <Button variant="primary" onClick={addEvent}>
              <Plus size={17} /> Добавить событие
            </Button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="timeline-empty dim">
            Событий пока нет. Добавьте первую точку сюжета, чтобы собрать линию времени.
          </div>
        ) : view === 'list' ? (
          <div className="timeline-list">
            {events.map((event) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                onUpdate={updateEvent}
                onDelete={deleteEvent}
              />
            ))}
          </div>
        ) : (
          <Fishbone
            title={timeline.title}
            events={events}
            onEdit={async (event) => {
              const title = await promptText({ title: 'Событие', initial: event.title })
              if (title && title !== event.title) await updateEvent(event.id, { title })
            }}
            onDelete={deleteEvent}
          />
        )}
      </div>
    </div>
  )
}
