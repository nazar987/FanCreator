import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { TimelineEvent } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Input } from '../../shared/ui/components'
import { confirmDialog, promptText } from '../../shared/ui/dialogs'

interface TimelineEventCardProps {
  event: TimelineEvent
  onUpdate: (
    eventId: string,
    patch: Partial<Pick<TimelineEvent, 'title' | 'note' | 'order'>>
  ) => Promise<void>
  onDelete: (event: TimelineEvent) => Promise<void>
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
  const { current, applyProject } = useStore()
  const timeline = current?.timelines.find((item) => item.id === timelineId)

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

  return (
    <div className="timeline">
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
          <Button variant="primary" onClick={addEvent}>
            <Plus size={17} /> Добавить событие
          </Button>
        </div>

        {events.length === 0 ? (
          <div className="timeline-empty dim">
            Событий пока нет. Добавьте первую точку сюжета, чтобы собрать линию времени.
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
