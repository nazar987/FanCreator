import React from 'react'
import { Plus, Trash2, Maximize, Link2, Type, Square, Image as ImageIcon } from 'lucide-react'
import type { BoardArrow, BoardSticker, StickerKind, StickerShape } from '@shared/types'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'
import { promptText } from '../../shared/ui/dialogs'

const SHAPE_LABEL: Record<StickerShape, string> = {
  rect: 'Прямоугольник',
  rounded: 'Скруглённый',
  circle: 'Круг',
  note: 'Заметка'
}

const SHAPE_OPTIONS: StickerShape[] = ['rect', 'rounded', 'circle']

const ARROW_COLORS = ['#f06b9b', '#5fd39a', '#5bb8e6', '#f0a35b', '#b98cf5', '#e8e8ef']
const ZOOM_MIN = 0.25
const ZOOM_MAX = 2.5

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

type Interaction =
  | { mode: 'pan'; startX: number; startY: number; origX: number; origY: number }
  | {
      mode: 'sticker'
      id: string
      startX: number
      startY: number
      origX: number
      origY: number
      moved: boolean
    }
  | {
      mode: 'resize'
      id: string
      startX: number
      startY: number
      origW: number
      origH: number
    }
  | { mode: 'arrow'; fromId: string }

export function Board({ boardId }: { boardId: string }): React.JSX.Element {
  const { current, applyProject } = useStore()
  const board = current?.boards.find((item) => item.id === boardId)
  const [stickers, setStickers] = React.useState<BoardSticker[]>(() => board?.stickers ?? [])
  const [arrows, setArrows] = React.useState<BoardArrow[]>(() => board?.arrows ?? [])
  const [pan, setPan] = React.useState({ x: 60, y: 60 })
  const [zoom, setZoom] = React.useState(1)
  const [selectedArrow, setSelectedArrow] = React.useState<string | null>(null)
  const [tempArrow, setTempArrow] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const canvasRef = React.useRef<HTMLDivElement>(null)
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const interaction = React.useRef<Interaction | null>(null)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyToSave = React.useRef(false)

  // зеркала состояния для обработчиков указателя (актуальные значения без пересоздания listener'ов)
  const panRef = React.useRef(pan)
  panRef.current = pan
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom
  const stickersRef = React.useRef(stickers)
  stickersRef.current = stickers

  // автосохранение полотна целиком (как в редакторе) — дебаунс 600 мс
  React.useEffect(() => {
    if (!current || !board || !readyToSave.current) {
      readyToSave.current = true
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      applyProject(await window.api.boards.save({ projectId: current.id, boardId, stickers, arrows }))
    }, 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [stickers, arrows, boardId, current?.id, applyProject])

  /** Экранные координаты (clientX/Y) → мировые координаты холста. */
  const toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const sx = clientX - (rect?.left ?? 0)
    const sy = clientY - (rect?.top ?? 0)
    return { x: (sx - panRef.current.x) / zoomRef.current, y: (sy - panRef.current.y) / zoomRef.current }
  }

  const stickerAtWorld = (x: number, y: number): BoardSticker | undefined =>
    [...stickersRef.current]
      .reverse()
      .find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h)

  // ---- общий цикл указателя ----
  React.useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      const it = interaction.current
      if (!it) return
      if (it.mode === 'pan') {
        setPan({ x: it.origX + (e.clientX - it.startX), y: it.origY + (e.clientY - it.startY) })
      } else if (it.mode === 'sticker') {
        const dx = (e.clientX - it.startX) / zoomRef.current
        const dy = (e.clientY - it.startY) / zoomRef.current
        if (Math.abs(e.clientX - it.startX) + Math.abs(e.clientY - it.startY) > 2) it.moved = true
        setStickers((items) =>
          items.map((s) => (s.id === it.id ? { ...s, x: it.origX + dx, y: it.origY + dy } : s))
        )
      } else if (it.mode === 'resize') {
        const dx = (e.clientX - it.startX) / zoomRef.current
        const dy = (e.clientY - it.startY) / zoomRef.current
        setStickers((items) =>
          items.map((s) =>
            s.id === it.id
              ? { ...s, w: Math.max(90, it.origW + dx), h: Math.max(60, it.origH + dy) }
              : s
          )
        )
      } else if (it.mode === 'arrow') {
        const from = stickersRef.current.find((s) => s.id === it.fromId)
        if (!from) return
        const w = toWorld(e.clientX, e.clientY)
        setTempArrow({ x1: from.x + from.w / 2, y1: from.y + from.h / 2, x2: w.x, y2: w.y })
      }
    }
    const onUp = (e: PointerEvent): void => {
      const it = interaction.current
      interaction.current = null
      if (!it) return
      if (it.mode === 'arrow') {
        const w = toWorld(e.clientX, e.clientY)
        const target = stickerAtWorld(w.x, w.y)
        if (target && target.id !== it.fromId) {
          setArrows((items) => [
            ...items,
            {
              id: crypto.randomUUID(),
              fromId: it.fromId,
              toId: target.id,
              color: ARROW_COLORS[items.length % ARROW_COLORS.length]
            }
          ])
        }
        setTempArrow(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!current || !board) {
    return <div className="board-missing dim">Доска не найдена</div>
  }

  const onCanvasPointerDown = (e: React.PointerEvent): void => {
    // панорама только при клике по пустому холсту
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('board-world'))
      return
    setSelectedArrow(null)
    interaction.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y
    }
  }

  const onWheel = (e: React.WheelEvent): void => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor))
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    // удержать точку под курсором на месте
    const wx = (sx - pan.x) / zoom
    const wy = (sy - pan.y) / zoom
    setPan({ x: sx - wx * next, y: sy - wy * next })
    setZoom(next)
  }

  const startStickerDrag = (e: React.PointerEvent, s: BoardSticker): void => {
    const el = e.target as HTMLElement
    if (el.closest('.board-sticker-tools, textarea, .board-resize-handle, .board-arrow-handle')) return
    e.stopPropagation()
    interaction.current = {
      mode: 'sticker',
      id: s.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: s.x,
      origY: s.y,
      moved: false
    }
  }

  const addSticker = (kind: StickerKind = 'note', imagePath?: string): void => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const center = rect
      ? toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
      : { x: 200, y: 200 }
    const size =
      kind === 'text'
        ? { w: 260, h: 90 }
        : kind === 'image'
          ? { w: 280, h: 190 }
          : { w: 220, h: 150 }
    setStickers((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        kind,
        x: center.x - size.w / 2,
        y: center.y - size.h / 2,
        w: size.w,
        h: size.h,
        color: kind === 'shape' ? '#5bb8e6' : '#ffd166',
        shape: kind === 'note' ? 'note' : 'rounded',
        text: kind === 'text' ? 'Текст' : kind === 'shape' ? 'Фигура' : '',
        imagePath
      }
    ])
  }

  const addImageSticker = async (file: File): Promise<void> => {
    const dataUrl = await readFileAsDataUrl(file)
    const imagePath = await window.api.assets.saveImage({ projectId: current.id, dataUrl })
    addSticker('image', imagePath)
  }

  const updateSticker = (id: string, patch: Partial<BoardSticker>): void =>
    setStickers((items) => items.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const deleteSticker = (id: string): void => {
    setStickers((items) => items.filter((s) => s.id !== id))
    setArrows((items) => items.filter((a) => a.fromId !== id && a.toId !== id))
  }

  const updateArrow = (id: string, patch: Partial<BoardArrow>): void =>
    setArrows((items) => items.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  const deleteArrow = (id: string): void => {
    setArrows((items) => items.filter((a) => a.id !== id))
    setSelectedArrow(null)
  }

  const stickerById = new Map(stickers.map((s) => [s.id, s]))
  const selected = arrows.find((a) => a.id === selectedArrow)

  return (
    <div className="board">
      <div className="board-toolbar">
        <div>
          <div className="board-title">{board.title}</div>
          <div className="dim board-subtitle">
            {stickers.length} стикеров · {arrows.length} связей · тяните угол стикера{' '}
            <Link2 size={11} style={{ verticalAlign: 'middle' }} /> чтобы соединить
          </div>
        </div>
        <div className="row">
          <button
            className="btn btn--soft btn--sm"
            title="Сбросить вид"
            onClick={() => {
              setPan({ x: 60, y: 60 })
              setZoom(1)
            }}
          >
            <Maximize size={15} /> {Math.round(zoom * 100)}%
          </button>
          <div className="board-add-group">
            <Button variant="primary" onClick={() => addSticker('note')}>
              <Plus size={16} /> Заметка
            </Button>
            <Button variant="soft" onClick={() => addSticker('text')}>
              <Type size={15} /> Текст
            </Button>
            <Button variant="soft" onClick={() => addSticker('shape')}>
              <Square size={15} /> Фигура
            </Button>
            <Button variant="soft" onClick={() => imageInputRef.current?.click()}>
              <ImageIcon size={15} /> Картинка
            </Button>
            <input
              ref={imageInputRef}
              className="board-image-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) addImageSticker(file)
              }}
            />
          </div>
        </div>
      </div>

      {selected && (
        <div className="board-arrow-bar">
          <span className="dim">Связь:</span>
          {ARROW_COLORS.map((c) => (
            <button
              key={c}
              className={`board-color-dot ${selected.color === c ? 'is-active' : ''}`}
              style={{ background: c }}
              onClick={() => updateArrow(selected.id, { color: c })}
            />
          ))}
          <button
            className="btn btn--soft btn--sm"
            onClick={async () => {
              const label = await promptText({
                title: 'Подпись связи',
                initial: selected.label ?? ''
              })
              if (label !== null) updateArrow(selected.id, { label })
            }}
          >
            Подпись
          </button>
          <button className="btn btn--danger btn--sm" onClick={() => deleteArrow(selected.id)}>
            <Trash2 size={14} /> Удалить
          </button>
        </div>
      )}

      <div
        className="board-canvas"
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        onWheel={onWheel}
      >
        <div
          className="board-world"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg className="board-arrows" width="6000" height="4000">
            <defs>
              {ARROW_COLORS.map((c) => (
                <marker
                  key={c}
                  id={`arr-${board.id}-${c.slice(1)}`}
                  markerWidth="9"
                  markerHeight="9"
                  refX="7"
                  refY="4.5"
                  orient="auto"
                >
                  <path d="M0,0 L9,4.5 L0,9 Z" fill={c} />
                </marker>
              ))}
            </defs>
            {arrows.map((arrow) => {
              const from = stickerById.get(arrow.fromId)
              const to = stickerById.get(arrow.toId)
              if (!from || !to) return null
              const x1 = from.x + from.w / 2
              const y1 = from.y + from.h / 2
              const x2 = to.x + to.w / 2
              const y2 = to.y + to.h / 2
              const isSel = arrow.id === selectedArrow
              return (
                <g key={arrow.id} className="board-arrow-g" onPointerDown={(e) => {
                  e.stopPropagation()
                  setSelectedArrow(arrow.id)
                }}>
                  {/* широкая прозрачная линия для удобного клика */}
                  <line
                    className="board-arrow-hit"
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={arrow.color}
                    strokeWidth={isSel ? 4 : 3}
                    markerEnd={`url(#arr-${board.id}-${arrow.color.slice(1)})`}
                    opacity={isSel ? 1 : 0.9}
                  />
                  {arrow.label && (
                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} className="board-arrow-label">
                      {arrow.label}
                    </text>
                  )}
                </g>
              )
            })}
            {tempArrow && (
              <line
                x1={tempArrow.x1}
                y1={tempArrow.y1}
                x2={tempArrow.x2}
                y2={tempArrow.y2}
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeDasharray="6 5"
              />
            )}
          </svg>

          {stickers.map((sticker) => {
            const kind = sticker.kind ?? 'note'
            const shapeOptions = kind === 'shape' ? SHAPE_OPTIONS : (Object.keys(SHAPE_LABEL) as StickerShape[])
            return (
              <div
                className={`board-sticker board-sticker--${sticker.shape} board-sticker-kind--${kind}`}
                key={sticker.id}
                style={{
                  left: sticker.x,
                  top: sticker.y,
                  width: sticker.w,
                  height: sticker.h,
                  backgroundColor: kind === 'text' ? undefined : sticker.color
                }}
                onPointerDown={(e) => startStickerDrag(e, sticker)}
              >
                <div className="board-sticker-tools">
                  {kind !== 'text' && kind !== 'image' && (
                    <input
                      type="color"
                      value={sticker.color}
                      title="Цвет элемента"
                      onChange={(e) => updateSticker(sticker.id, { color: e.target.value })}
                    />
                  )}
                  {kind !== 'text' && kind !== 'image' && (
                    <select
                      value={sticker.shape}
                      title="Форма элемента"
                      onChange={(e) => updateSticker(sticker.id, { shape: e.target.value as StickerShape })}
                    >
                      {shapeOptions.map((shape) => (
                        <option key={shape} value={shape}>
                          {SHAPE_LABEL[shape]}
                        </option>
                      ))}
                    </select>
                  )}
                  <button title="Удалить элемент" onClick={() => deleteSticker(sticker.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {kind === 'image' && sticker.imagePath && (
                  <img
                    className="board-sticker-image"
                    src={sticker.imagePath}
                    alt={sticker.text || 'Картинка на доске'}
                    draggable={false}
                  />
                )}
                <textarea
                  value={sticker.text}
                  placeholder={kind === 'image' ? 'Подпись' : kind === 'text' ? 'Текст' : 'Текст элемента'}
                  onChange={(e) => updateSticker(sticker.id, { text: e.target.value })}
                />
                <span
                  className="board-arrow-handle"
                  title="Потяните к другому элементу, чтобы создать связь"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    interaction.current = { mode: 'arrow', fromId: sticker.id }
                  }}
                >
                  <Link2 size={12} />
                </span>
                <span
                  className="board-resize-handle"
                  title="Изменить размер"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    interaction.current = {
                      mode: 'resize',
                      id: sticker.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origW: sticker.w,
                      origH: sticker.h
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
