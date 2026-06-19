import React from 'react'
import { Plus, Trash2, List, GitFork, Network, ImageDown, GripVertical } from 'lucide-react'
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult
} from '@hello-pangea/dnd'
import type { BoardSticker, TimelineEvent } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Card, Input } from '../../shared/ui/components'
import { confirmDialog, promptText } from '../../shared/ui/dialogs'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { buildFishboneImage } from './fishboneImage'
import { Dendrogram } from './Dendrogram'

interface TimelineEventCardProps {
  event: TimelineEvent
  level: number
  onUpdate: (
    eventId: string,
    patch: Partial<Pick<TimelineEvent, 'title' | 'note' | 'order'>>
  ) => Promise<void>
  onAddChild: (event: TimelineEvent) => Promise<void>
  onDelete: (event: TimelineEvent) => Promise<void>
  dragHandleProps?: DraggableProvidedDragHandleProps | null
}

/** Раскладка «рыбья кость» (Исикава): хребет + наклонные кости-события + под-кости (S-C, S-9). */
function Fishbone({
  title,
  events,
  childrenOf,
  onEdit,
  onDelete
}: {
  title: string
  events: TimelineEvent[]
  childrenOf: (parentId: string) => TimelineEvent[]
  onEdit: (event: TimelineEvent) => void
  onDelete: (event: TimelineEvent) => Promise<void>
}): React.JSX.Element {
  const STEP = 220
  const START_X = 80
  const SPINE_Y = 220
  const REACH = 150
  const BONE_DX = 36
  const SUB_LEN = 58 // длина горизонтальной под-кости

  // геометрия каждой главной кости + её под-костей
  const bones = events.map((event, i) => {
    const footX = START_X + (i + 1) * STEP - STEP / 2
    const up = i % 2 === 0
    const nodeX = footX - BONE_DX
    const nodeY = up ? SPINE_Y - REACH : SPINE_Y + REACH
    const kids = childrenOf(event.id)
    // точки крепления под-костей вдоль главной кости (между хребтом и узлом)
    const subs = kids.map((kid, k) => {
      const t = (k + 1) / (kids.length + 1)
      const px = footX + t * (nodeX - footX)
      const py = SPINE_Y + t * (nodeY - SPINE_Y)
      return { kid, px, py }
    })
    return { event, i, footX, nodeX, nodeY, subs }
  })

  const width = START_X + events.length * STEP + 260
  const height = 480
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
          {/* главные кости + под-кости */}
          {bones.map((b) => (
            <g key={b.event.id}>
              <line
                x1={b.footX}
                y1={SPINE_Y}
                x2={b.nodeX}
                y2={b.nodeY}
                stroke="var(--stroke-strong)"
                strokeWidth="2"
              />
              {b.subs.map((s) => (
                <line
                  key={s.kid.id}
                  x1={s.px}
                  y1={s.py}
                  x2={s.px + SUB_LEN}
                  y2={s.py}
                  stroke="var(--stroke-strong)"
                  strokeWidth="1.5"
                />
              ))}
            </g>
          ))}
        </svg>

        {/* «голова рыбы» — цель/итог */}
        <div className="fishbone-head-label" style={{ left: endX + 6, top: SPINE_Y }}>
          {title}
        </div>

        {/* узлы-события и под-события */}
        {bones.map((b) => (
          <React.Fragment key={b.event.id}>
            <div
              className="fishbone-node"
              style={{ left: b.nodeX, top: b.nodeY }}
              title={b.event.note || undefined}
              onClick={() => onEdit(b.event)}
            >
              <div className="fishbone-node-order">{b.i + 1}</div>
              <div className="fishbone-node-title truncate">{b.event.title}</div>
              {b.event.note && <div className="fishbone-node-note">{b.event.note}</div>}
              <button
                className="fishbone-node-del"
                title="Удалить событие"
                onClick={(e) => {
                  e.stopPropagation()
                  void onDelete(b.event)
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
            {b.subs.map((s) => (
              <div
                key={s.kid.id}
                className="fishbone-subnode"
                style={{ left: s.px + SUB_LEN + 4, top: s.py }}
                title={s.kid.note || undefined}
                onClick={() => onEdit(s.kid)}
              >
                <span className="fishbone-subnode-title truncate">{s.kid.title}</span>
                <button
                  className="fishbone-subnode-del"
                  title="Удалить под-событие"
                  onClick={(e) => {
                    e.stopPropagation()
                    void onDelete(s.kid)
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function TimelineEventCard({
  event,
  level,
  onUpdate,
  onAddChild,
  onDelete,
  dragHandleProps
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
    <div className="timeline-event" style={{ marginLeft: level * 28 }}>
      <div className="timeline-event-marker">{event.order + 1}</div>
      <Card className="timeline-event-card">
        <div className="timeline-event-head">
          <span
            className="timeline-event-drag"
            title="Изменить порядок события"
            {...dragHandleProps}
          >
            <GripVertical size={15} />
          </span>
          <Input
            value={title}
            aria-label="Название события"
            placeholder="Название события"
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            onBlur={saveTitle}
          />
          <Button
            variant="soft"
            size="sm"
            icon
            title="Добавить под-событие"
            onClick={() => onAddChild(event)}
          >
            <Plus size={15} />
          </Button>
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
  const [view, setView] = React.useState<'list' | 'fishbone' | 'dendro'>('list')

  if (!current || !timeline) {
    return <div className="timeline-missing dim">Таймлайн не найден</div>
  }

  const events = [...timeline.events].sort((a, b) => a.order - b.order)
  const topEvents = events.filter((event) => !event.parentId)
  const childEvents = (parentId: string | null): TimelineEvent[] =>
    events.filter((event) => (event.parentId ?? null) === parentId)
  const eventDropId = (parentId: string | null): string => `timeline-events:${parentId ?? 'root'}`
  const parseEventDropId = (droppableId: string): string | null | undefined => {
    if (!droppableId.startsWith('timeline-events:')) return undefined
    const parentId = droppableId.slice('timeline-events:'.length)
    return parentId === 'root' ? null : parentId
  }

  const addEvent = async (parentId: string | null = null): Promise<void> => {
    const title = await promptText({
      title: parentId ? 'Новое под-событие' : 'Новое событие',
      placeholder: parentId ? 'Название под-события' : 'Название события'
    })
    if (!title) return
    applyProject(
      await window.api.timelineEvents.add({
        projectId: current.id,
        timelineId,
        title,
        parentId
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
  const reorderEvents = async (result: DropResult): Promise<void> => {
    const { source, destination } = result
    if (!destination || source.droppableId !== destination.droppableId) return
    if (source.index === destination.index) return
    const parentId = parseEventDropId(source.droppableId)
    if (parentId === undefined) return
    const order = childEvents(parentId).map((event) => event.id)
    const [moved] = order.splice(source.index, 1)
    order.splice(destination.index, 0, moved)
    applyProject(
      await window.api.timelineEvents.reorder({
        projectId: current.id,
        timelineId,
        parentId,
        order
      })
    )
  }

  const renderEventNode = (event: TimelineEvent, level: number): React.JSX.Element => (
    <React.Fragment key={event.id}>
      <TimelineEventCard
        event={event}
        level={level}
        onUpdate={updateEvent}
        onAddChild={(item) => addEvent(item.id)}
        onDelete={deleteEvent}
      />
      {childEvents(event.id).map((child) => renderEventNode(child, level + 1))}
    </React.Fragment>
  )

  const renderEventGroup = (parentId: string | null, level: number): React.JSX.Element => (
    <Droppable droppableId={eventDropId(parentId)} type="timeline-event">
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className="timeline-event-group">
          {childEvents(parentId).map((event, index) => (
            <Draggable draggableId={event.id} index={index} key={event.id}>
              {(dragProvided) => (
                <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                  <TimelineEventCard
                    event={event}
                    level={level}
                    onUpdate={updateEvent}
                    onAddChild={(item) => addEvent(item.id)}
                    onDelete={deleteEvent}
                    dragHandleProps={dragProvided.dragHandleProps}
                  />
                  {childEvents(event.id).length > 0 && renderEventGroup(event.id, level + 1)}
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )

  const exportToBoard = async (e: React.MouseEvent): Promise<void> => {
    if (!current || topEvents.length === 0) return
    const { dataUrl, width, height } = await buildFishboneImage(timeline.title, topEvents, (parentId) =>
      childEvents(parentId)
    )
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
              <button
                className={view === 'dendro' ? 'is-active' : ''}
                onClick={() => setView('dendro')}
                title="Дендрограмма (дерево, как турнирная сетка)"
              >
                <Network size={15} /> Дерево
              </button>
            </div>
            {view === 'fishbone' && events.length > 0 && (
              <Button variant="soft" onClick={exportToBoard} title="Сохранить схему как элемент доски">
                <ImageDown size={16} /> На доску
              </Button>
            )}
            <Button variant="primary" onClick={() => addEvent()}>
              <Plus size={17} /> Добавить событие
            </Button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="timeline-empty dim">
            Событий пока нет. Добавьте первую точку сюжета, чтобы собрать линию времени.
          </div>
        ) : view === 'list' ? (
          <DragDropContext onDragEnd={reorderEvents}>
            <div className="timeline-list">{renderEventGroup(null, 0)}</div>
          </DragDropContext>
        ) : view === 'fishbone' ? (
          <Fishbone
            title={timeline.title}
            events={topEvents}
            childrenOf={(parentId) => childEvents(parentId)}
            onEdit={async (event) => {
              const title = await promptText({ title: 'Событие', initial: event.title })
              if (title && title !== event.title) await updateEvent(event.id, { title })
            }}
            onDelete={deleteEvent}
          />
        ) : (
          <Dendrogram
            events={topEvents}
            childrenOf={(parentId) => childEvents(parentId)}
            onEdit={async (event) => {
              const title = await promptText({ title: 'Событие', initial: event.title })
              if (title && title !== event.title) await updateEvent(event.id, { title })
            }}
            onAddChild={(event) => void addEvent(event.id)}
            onDelete={(event) => void deleteEvent(event)}
          />
        )}
      </div>
    </div>
  )
}
