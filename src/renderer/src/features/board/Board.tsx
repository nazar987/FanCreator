import React from 'react'
import {
  Plus,
  Trash2,
  Maximize,
  Link2,
  Type,
  Square,
  Image as ImageIcon,
  UserRound,
  BookOpen,
  Clock3,
  Copy,
  MoreVertical
} from 'lucide-react'
import type {
  BoardArrow,
  BoardSticker,
  BoardStickerLink,
  StickerKind,
  StickerShape
} from '@shared/types'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'
import { openContextMenu, type MenuItem } from '../../shared/ui/ContextMenu'
import { promptText } from '../../shared/ui/dialogs'
import { ColorPalette } from '../../shared/ui/ColorPalette'

const SHAPE_LABEL: Record<StickerShape, string> = {
  rect: 'Прямоугольник',
  rounded: 'Скруглённый',
  circle: 'Круг',
  note: 'Заметка',
  diamond: 'Ромб',
  triangle: 'Треугольник',
  parallelogram: 'Параллелограмм',
  hexagon: 'Шестиугольник'
}

const SHAPE_OPTIONS: StickerShape[] = ['rect', 'rounded', 'circle', 'diamond', 'triangle', 'parallelogram', 'hexagon']
const NOTE_SHAPE_OPTIONS: StickerShape[] = ['rect', 'rounded', 'circle', 'note']

const ARROW_COLORS = ['#f06b9b', '#5fd39a', '#5bb8e6', '#f0a35b', '#b98cf5', '#e8e8ef']
const STICKER_COLORS = ['#ffd166', '#f06b9b', '#5fd39a', '#5bb8e6', '#b98cf5', '#e8e8ef']
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
  const { current, applyProject, openTab } = useStore()
  const board = current?.boards.find((item) => item.id === boardId)
  const [stickers, setStickers] = React.useState<BoardSticker[]>(() => board?.stickers ?? [])
  const [arrows, setArrows] = React.useState<BoardArrow[]>(() => board?.arrows ?? [])
  const [pan, setPan] = React.useState({ x: 60, y: 60 })
  const [zoom, setZoom] = React.useState(1)
  const [isDragging, setIsDragging] = React.useState(false)
  const [selectedArrow, setSelectedArrow] = React.useState<string | null>(null)
  const [tempArrow, setTempArrow] = React.useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  // S-F: всплывающая вики-карточка привязанной сущности
  const [preview, setPreview] = React.useState<{ link: BoardStickerLink; x: number; y: number } | null>(null)

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

  const curvedPath = (x1: number, y1: number, x2: number, y2: number): string => {
    const dx = x2 - x1
    const dy = y2 - y1
    if (Math.abs(dx) >= Math.abs(dy)) {
      const bend = Math.max(60, Math.abs(dx) * 0.45)
      const dir = dx >= 0 ? 1 : -1
      return `M ${x1} ${y1} C ${x1 + bend * dir} ${y1}, ${x2 - bend * dir} ${y2}, ${x2} ${y2}`
    }
    const bend = Math.max(60, Math.abs(dy) * 0.45)
    const dir = dy >= 0 ? 1 : -1
    return `M ${x1} ${y1} C ${x1} ${y1 + bend * dir}, ${x2} ${y2 - bend * dir}, ${x2} ${y2}`
  }

  const lineAngle = (x1: number, y1: number, x2: number, y2: number): number => {
    const raw = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
    return raw > 90 || raw < -90 ? raw + 180 : raw
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
      setIsDragging(false)
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
    e.preventDefault()
    setSelectedArrow(null)
    setIsDragging(true)
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
    if (el.closest('.board-sticker-menu, textarea, .board-resize-handle, .board-arrow-handle, .board-link-chip')) return
    e.preventDefault()
    e.stopPropagation()
    setStickers((items) => {
      const target = items.find((item) => item.id === s.id)
      if (!target || items[items.length - 1]?.id === s.id) return items
      return [...items.filter((item) => item.id !== s.id), target]
    })
    setIsDragging(true)
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

  const addSticker = (kind: StickerKind = 'note', imagePath?: string, shape?: StickerShape): void => {
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
        color: kind === 'shape' ? '#5bb8e6' : kind === 'text' ? '#e8e8ef' : '#ffd166',
        shape: shape ?? (kind === 'note' ? 'note' : 'rounded'),
        text: kind === 'text' ? 'Текст' : '',
        imagePath
      }
    ])
  }

  const addImageSticker = async (file: File): Promise<void> => {
    const dataUrl = await readFileAsDataUrl(file)
    const imagePath = await window.api.assets.saveImage({ projectId: current.id, dataUrl })
    addSticker('image', imagePath)
  }

  const openShapeAddMenu = (e: React.MouseEvent): void => {
    openContextMenu(
      e,
      SHAPE_OPTIONS.map((shape) => ({
        label: SHAPE_LABEL[shape],
        onClick: () => addSticker('shape', undefined, shape)
      }))
    )
  }

  const updateSticker = (id: string, patch: Partial<BoardSticker>): void =>
    setStickers((items) => items.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const deleteSticker = (id: string): void => {
    setStickers((items) => items.filter((s) => s.id !== id))
    setArrows((items) => items.filter((a) => a.fromId !== id && a.toId !== id))
  }

  const duplicateSticker = (sticker: BoardSticker): void => {
    setStickers((items) => [
      ...items,
      {
        ...sticker,
        id: crypto.randomUUID(),
        x: sticker.x + 28,
        y: sticker.y + 28
      }
    ])
  }

  const getLinkTitle = (link?: BoardStickerLink | null): string | null => {
    if (!link) return null
    if (link.kind === 'character') {
      return current.characters.find((item) => item.id === link.id)?.name ?? null
    }
    if (link.kind === 'story') {
      return current.stories.find((item) => item.id === link.id)?.title ?? null
    }
    return current.timelines.find((item) => item.id === link.id)?.title ?? null
  }

  // S-F: открыть привязанную сущность во вкладке
  const openLink = (link: BoardStickerLink): void => {
    if (link.kind === 'character') {
      openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })
    } else if (link.kind === 'story') {
      const story = current.stories.find((s) => s.id === link.id)
      const chapter = story?.chapters[0]
      if (story && chapter) {
        openTab({
          id: `chapter:${chapter.id}`,
          kind: 'chapter',
          title: chapter.title || 'Без названия',
          storyId: story.id,
          chapterId: chapter.id
        })
      } else {
        openTab({ id: 'shelf', kind: 'shelf', title: 'Библиотека' })
      }
    } else {
      const timeline = current.timelines.find((t) => t.id === link.id)
      if (timeline)
        openTab({ id: `timeline:${timeline.id}`, kind: 'timeline', title: timeline.title, timelineId: timeline.id })
    }
  }

  // S-F: содержимое всплывающей карточки (вики-стиль)
  const renderPreview = (link: BoardStickerLink): React.JSX.Element | null => {
    if (link.kind === 'character') {
      const c = current.characters.find((x) => x.id === link.id)
      if (!c) return null
      return (
        <>
          <div className="board-preview-kind">Персонаж</div>
          <div className="board-preview-title">{c.name}</div>
          {c.role && <div className="board-preview-sub">{c.role}</div>}
          {c.fields[0]?.value && <div className="board-preview-note">{c.fields[0].value}</div>}
        </>
      )
    }
    if (link.kind === 'story') {
      const s = current.stories.find((x) => x.id === link.id)
      if (!s) return null
      return (
        <>
          <div className="board-preview-kind">История</div>
          <div className="board-preview-title">{s.title}</div>
          <div className="board-preview-sub">{s.chapters.length} глав</div>
          {s.synopsis && <div className="board-preview-note">{s.synopsis}</div>}
        </>
      )
    }
    const t = current.timelines.find((x) => x.id === link.id)
    if (!t) return null
    return (
      <>
        <div className="board-preview-kind">Таймлайн</div>
        <div className="board-preview-title">{t.title}</div>
        <div className="board-preview-sub">{t.events.length} событий</div>
      </>
    )
  }

  const stickerLinkMenuItems = (sticker: BoardSticker): MenuItem[] => {
    const items: MenuItem[] = []
    if (current.characters.length > 0) {
      items.push({ type: 'label', label: 'Персонажи' })
      items.push(
        ...current.characters.map((character) => ({
          label: character.name,
          icon: <UserRound size={15} />,
          onClick: () => updateSticker(sticker.id, { link: { kind: 'character', id: character.id } })
        }))
      )
    }
    if (current.stories.length > 0) {
      items.push({ type: 'label', label: 'Истории' })
      items.push(
        ...current.stories.map((story) => ({
          label: story.title,
          icon: <BookOpen size={15} />,
          onClick: () => updateSticker(sticker.id, { link: { kind: 'story', id: story.id } })
        }))
      )
    }
    if (current.timelines.length > 0) {
      items.push({ type: 'label', label: 'Таймлайны' })
      items.push(
        ...current.timelines.map((timeline) => ({
          label: timeline.title,
          icon: <Clock3 size={15} />,
          onClick: () => updateSticker(sticker.id, { link: { kind: 'timeline', id: timeline.id } })
        }))
      )
    }
    if (sticker.link) {
      items.push({ type: 'sep' }, { label: 'Убрать привязку', onClick: () => updateSticker(sticker.id, { link: null }) })
    }
    if (items.length === 0) {
      items.push({ type: 'label', label: 'В проекте пока нет сущностей' })
    }
    return items
  }

  const openStickerLinkMenu = (e: React.MouseEvent, sticker: BoardSticker): void => {
    openContextMenu(e, stickerLinkMenuItems(sticker))
  }

  const openStickerMenu = (e: React.MouseEvent, sticker: BoardSticker): void => {
    const kind = sticker.kind ?? 'note'
    const shapeOptions = kind === 'shape' ? SHAPE_OPTIONS : NOTE_SHAPE_OPTIONS
    const items: MenuItem[] = [
      {
        label: 'Дублировать',
        icon: <Copy size={15} />,
        onClick: () => duplicateSticker(sticker)
      }
    ]

    if (kind !== 'image') {
      items.push({
        label: kind === 'text' ? 'Цвет текста' : 'Цвет',
        submenu: STICKER_COLORS.map((color) => ({
          label: color,
          icon: <span className="board-menu-color" style={{ background: color }} />,
          onClick: () => updateSticker(sticker.id, { color })
        }))
      })
    }

    if (kind !== 'text' && kind !== 'image') {
      items.push(
        {
          label: 'Форма',
          submenu: shapeOptions.map((shape) => ({
            label: SHAPE_LABEL[shape],
            onClick: () => updateSticker(sticker.id, { shape })
          }))
        }
      )
    }

    items.push(
      {
        label: 'Привязать',
        icon: <Link2 size={15} />,
        submenu: stickerLinkMenuItems(sticker)
      },
      { type: 'sep' },
      {
        label: 'Удалить',
        icon: <Trash2 size={15} />,
        danger: true,
        onClick: () => deleteSticker(sticker.id)
      }
    )

    openContextMenu(e, items)
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
    <div className={`board ${isDragging ? 'board--dragging' : ''}`} data-tour="board">
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
            <Button variant="soft" onClick={openShapeAddMenu}>
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
              const d = curvedPath(x1, y1, x2, y2)
              const labelX = (x1 + x2) / 2
              const labelY = (y1 + y2) / 2 - 8
              const labelAngle = lineAngle(x1, y1, x2, y2)
              return (
                <g key={arrow.id} className="board-arrow-g" onPointerDown={(e) => {
                  e.stopPropagation()
                  setSelectedArrow(arrow.id)
                }}>
                  {/* широкая прозрачная линия для удобного клика */}
                  <path
                    className="board-arrow-hit"
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={arrow.color}
                    strokeWidth={isSel ? 4 : 3}
                    markerEnd={`url(#arr-${board.id}-${arrow.color.slice(1)})`}
                    opacity={isSel ? 1 : 0.9}
                  />
                  {arrow.label && (
                    <text
                      x={labelX}
                      y={labelY}
                      className="board-arrow-label"
                      transform={`rotate(${labelAngle} ${labelX} ${labelY})`}
                    >
                      {arrow.label}
                    </text>
                  )}
                </g>
              )
            })}
            {tempArrow && (
              <path
                d={curvedPath(tempArrow.x1, tempArrow.y1, tempArrow.x2, tempArrow.y2)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeDasharray="6 5"
              />
            )}
          </svg>

          {stickers.map((sticker) => {
            const kind = sticker.kind ?? 'note'
            const shapeOptions = kind === 'shape' ? SHAPE_OPTIONS : NOTE_SHAPE_OPTIONS
            return (
              <div
                className={`board-sticker board-sticker--${sticker.shape} board-sticker-kind--${kind}`}
                key={sticker.id}
                style={{
                  left: sticker.x,
                  top: sticker.y,
                  width: sticker.w,
                  height: sticker.h,
                  '--board-sticker-color': sticker.color,
                  backgroundColor: kind === 'note' ? sticker.color : undefined
                } as React.CSSProperties}
                onPointerDown={(e) => startStickerDrag(e, sticker)}
              >
                <button
                  className="board-sticker-menu"
                  title="Действия со стикером"
                  onClick={(e) => openStickerMenu(e, sticker)}
                >
                  <MoreVertical size={14} />
                </button>
                <div className="board-sticker-tools">
                  {kind !== 'image' && (
                    <ColorPalette
                      value={sticker.color}
                      title={kind === 'text' ? 'Цвет текста' : 'Цвет элемента'}
                      onChange={(color) => updateSticker(sticker.id, { color })}
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
                  <button title="Привязать к сущности проекта" onClick={(e) => openStickerLinkMenu(e, sticker)}>
                    <Link2 size={14} />
                  </button>
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
                {sticker.link && getLinkTitle(sticker.link) && (
                  <button
                    className="board-link-chip"
                    type="button"
                    data-link-kind={sticker.link.kind}
                    data-link-id={sticker.link.id}
                    title="Открыть привязанную сущность"
                    onClick={() => sticker.link && openLink(sticker.link)}
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      if (sticker.link) setPreview({ link: sticker.link, x: r.left, y: r.bottom + 8 })
                    }}
                    onMouseLeave={() => setPreview(null)}
                  >
                    {sticker.link.kind === 'character' ? (
                      <UserRound size={12} />
                    ) : sticker.link.kind === 'story' ? (
                      <BookOpen size={12} />
                    ) : (
                      <Clock3 size={12} />
                    )}
                    <span>{getLinkTitle(sticker.link)}</span>
                  </button>
                )}
                <textarea
                  value={sticker.text}
                  placeholder={kind === 'image' ? 'Подпись' : kind === 'text' ? 'Текст' : ''}
                  onChange={(e) => updateSticker(sticker.id, { text: e.target.value })}
                />
                <span
                  className="board-arrow-handle"
                  title="Потяните к другому элементу, чтобы создать связь"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(true)
                    interaction.current = { mode: 'arrow', fromId: sticker.id }
                  }}
                >
                  <Link2 size={12} />
                </span>
                <span
                  className="board-resize-handle"
                  title="Изменить размер"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragging(true)
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

      {preview && (
        <div className="board-link-preview" style={{ left: preview.x, top: preview.y }}>
          {renderPreview(preview.link)}
        </div>
      )}
    </div>
  )
}
