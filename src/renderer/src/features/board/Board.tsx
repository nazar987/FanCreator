import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { BoardArrow, BoardSticker, StickerShape } from '@shared/types'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'

const SHAPE_LABEL: Record<StickerShape, string> = {
  rect: 'Прямоугольник',
  rounded: 'Скруглённый',
  circle: 'Круг',
  note: 'Заметка'
}

export function Board({ boardId }: { boardId: string }): React.JSX.Element {
  const { current, applyProject } = useStore()
  const board = current?.boards.find((item) => item.id === boardId)
  const [stickers, setStickers] = React.useState<BoardSticker[]>(() => board?.stickers ?? [])
  const [arrows, setArrows] = React.useState<BoardArrow[]>(() => board?.arrows ?? [])
  const [pan] = React.useState({ x: 0, y: 0 })
  const [zoom] = React.useState(1)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyToSave = React.useRef(false)

  // SENIOR: pan & zoom (колесо/пробел-драг) меняют pan/zoom.
  // SENIOR: рисование стрелок перетаскиванием от стикера к стикеру.

  React.useEffect(() => {
    if (!current || !board || !readyToSave.current) {
      readyToSave.current = true
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      applyProject(
        await window.api.boards.save({
          projectId: current.id,
          boardId,
          stickers,
          arrows
        })
      )
    }, 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [stickers, arrows, boardId, current?.id, applyProject])

  if (!current || !board) {
    return <div className="board-missing dim">Доска не найдена</div>
  }

  const addSticker = (): void => {
    const offset = stickers.length * 40
    setStickers((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        x: 120 + offset,
        y: 120,
        w: 220,
        h: 150,
        color: '#ffd166',
        shape: 'note',
        text: ''
      }
    ])
  }

  const updateSticker = (stickerId: string, patch: Partial<BoardSticker>): void => {
    setStickers((items) =>
      items.map((sticker) => (sticker.id === stickerId ? { ...sticker, ...patch } : sticker))
    )
  }

  const deleteSticker = (stickerId: string): void => {
    setStickers((items) => items.filter((sticker) => sticker.id !== stickerId))
    setArrows((items) =>
      items.filter((arrow) => arrow.fromId !== stickerId && arrow.toId !== stickerId)
    )
  }

  const stickerById = new Map(stickers.map((sticker) => [sticker.id, sticker]))
  const markerId = `board-arrow-${board.id}`

  return (
    <div className="board">
      <div className="board-toolbar">
        <div>
          <div className="board-title">{board.title}</div>
          <div className="dim board-subtitle">
            {stickers.length} стикеров · {arrows.length} связей
          </div>
        </div>
        <Button variant="primary" onClick={addSticker}>
          <Plus size={16} /> Добавить стикер
        </Button>
      </div>

      <div className="board-canvas">
        <div
          className="board-world"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg className="board-arrows" width="4000" height="3000" aria-hidden="true">
            <defs>
              <marker
                id={markerId}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
              </marker>
            </defs>
            {arrows.map((arrow) => {
              const from = stickerById.get(arrow.fromId)
              const to = stickerById.get(arrow.toId)
              if (!from || !to) return null
              const x1 = from.x + from.w / 2
              const y1 = from.y + from.h / 2
              const x2 = to.x + to.w / 2
              const y2 = to.y + to.h / 2
              return (
                <g key={arrow.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={arrow.color}
                    strokeWidth="3"
                    markerEnd={`url(#${markerId})`}
                  />
                  {arrow.label && (
                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} className="board-arrow-label">
                      {arrow.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {stickers.map((sticker) => (
            <div
              className={`board-sticker board-sticker--${sticker.shape}`}
              key={sticker.id}
              style={{
                left: sticker.x,
                top: sticker.y,
                width: sticker.w,
                height: sticker.h,
                backgroundColor: sticker.color
              }}
            >
              <div className="board-sticker-tools">
                <input
                  type="color"
                  value={sticker.color}
                  title="Цвет стикера"
                  onChange={(event) => updateSticker(sticker.id, { color: event.target.value })}
                />
                <select
                  value={sticker.shape}
                  title="Форма стикера"
                  onChange={(event) =>
                    updateSticker(sticker.id, { shape: event.target.value as StickerShape })
                  }
                >
                  {(Object.keys(SHAPE_LABEL) as StickerShape[]).map((shape) => (
                    <option key={shape} value={shape}>
                      {SHAPE_LABEL[shape]}
                    </option>
                  ))}
                </select>
                <button title="Удалить стикер" onClick={() => deleteSticker(sticker.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                value={sticker.text}
                placeholder="Текст стикера"
                onChange={(event) => updateSticker(sticker.id, { text: event.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
