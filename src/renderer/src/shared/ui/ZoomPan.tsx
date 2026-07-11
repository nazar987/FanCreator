import React from 'react'
import { Home } from 'lucide-react'

const DEFAULT_PAN = { x: 24, y: 24 }

interface ZoomPanState {
  x: number
  y: number
  zoom: number
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const readStoredState = (storageKey: string | undefined): ZoomPanState | null => {
  if (!storageKey) return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ZoomPanState>
    if (!isFiniteNumber(parsed.x) || !isFiniteNumber(parsed.y) || !isFiniteNumber(parsed.zoom)) return null
    return { x: parsed.x, y: parsed.y, zoom: parsed.zoom }
  } catch {
    return null
  }
}

const writeStoredState = (storageKey: string | undefined, state: ZoomPanState): void => {
  if (!storageKey) return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Хранилище может быть недоступно; в этом случае ZoomPan просто работает без памяти позиции.
  }
}

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(target.closest('button,input,textarea,select,a,[contenteditable="true"]'))

/**
 * ZoomPan — масштабирование (Ctrl+колесо, к курсору) и панорамирование (перетас-
 * кивание фона) содержимого, как на доске. Клики по вложенным элементам работают:
 * панорама стартует только при реальном движении мыши (порог), иначе это клик.
 * Переиспользуется для таймлайна (дерево/рыбья кость) и родословной.
 */
export function ZoomPan({
  children,
  className = '',
  storageKey
}: {
  children: React.ReactNode
  className?: string
  storageKey?: string
}): React.JSX.Element {
  const initialState = React.useMemo(() => readStoredState(storageKey), [storageKey])
  const [zoom, setZoom] = React.useState(initialState?.zoom ?? 1)
  const [pan, setPan] = React.useState({ x: initialState?.x ?? DEFAULT_PAN.x, y: initialState?.y ?? DEFAULT_PAN.y })
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom
  const panRef = React.useRef(pan)
  panRef.current = pan
  const drag = React.useRef<{
    pointerId: number
    target: HTMLDivElement
    x: number
    y: number
    px: number
    py: number
    moved: boolean
    captured: boolean
  } | null>(null)
  const didMountRef = React.useRef(false)

  const MIN = 0.3
  const MAX = 2.5

  React.useEffect(() => {
    const stored = readStoredState(storageKey)
    setZoom(stored?.zoom ?? 1)
    setPan({ x: stored?.x ?? DEFAULT_PAN.x, y: stored?.y ?? DEFAULT_PAN.y })
    didMountRef.current = false
  }, [storageKey])

  React.useEffect(() => {
    if (!storageKey) return
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    const timer = window.setTimeout(() => {
      writeStoredState(storageKey, { x: pan.x, y: pan.y, zoom })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [pan.x, pan.y, storageKey, zoom])

  React.useEffect(
    () => () => {
      writeStoredState(storageKey, { x: panRef.current.x, y: panRef.current.y, zoom: zoomRef.current })
    },
    [storageKey]
  )

  const onWheel = (e: React.WheelEvent): void => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const z = zoomRef.current
    const nz = Math.min(MAX, Math.max(MIN, +(z * (e.deltaY < 0 ? 1.12 : 0.89)).toFixed(3)))
    if (nz === z) return
    const p = panRef.current
    // масштабируем к точке под курсором
    setPan({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) })
    setZoom(nz)
  }

  const clearDrag = React.useCallback((): void => {
    const d = drag.current
    if (d?.captured && d.target.hasPointerCapture(d.pointerId)) {
      try {
        d.target.releasePointerCapture(d.pointerId)
      } catch {
        // Pointer capture can already be released by the browser.
      }
    }
    drag.current = null
    document.body.classList.remove('zoompan-dragging')
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    if (isInteractiveTarget(e.target)) return
    e.preventDefault()
    drag.current = {
      pointerId: e.pointerId,
      target: e.currentTarget,
      x: e.clientX,
      y: e.clientY,
      px: panRef.current.x,
      py: panRef.current.y,
      moved: false,
      captured: false
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current.captured = true
    } catch {
      // Some environments can deny pointer capture; window blur/pointercancel still clear the drag.
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      d.moved = true
      document.body.classList.add('zoompan-dragging')
    }
    if (d.moved) {
      e.preventDefault()
      setPan({ x: d.px + dx, y: d.py + dy })
    }
  }

  React.useEffect(() => {
    window.addEventListener('blur', clearDrag)
    return () => {
      window.removeEventListener('blur', clearDrag)
      clearDrag()
    }
  }, [clearDrag])

  const step = (d: number): void => setZoom((z) => Math.min(MAX, Math.max(MIN, +(z + d).toFixed(2))))
  const reset = (): void => {
    setZoom(1)
    setPan(DEFAULT_PAN)
  }

  return (
    <div
      ref={wrapRef}
      className={`zoompan ${className}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={clearDrag}
      onPointerCancel={clearDrag}
      onLostPointerCapture={clearDrag}
    >
      <div
        className="zoompan-inner"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {children}
      </div>
      <div className="zoompan-controls">
        <button title="В начало листа" onClick={reset}>
          <Home size={13} />
        </button>
        <button title="Уменьшить" onClick={() => step(-0.1)}>
          −
        </button>
        <button title="Сбросить" onClick={reset}>
          {Math.round(zoom * 100)}%
        </button>
        <button title="Увеличить" onClick={() => step(0.1)}>
          +
        </button>
      </div>
    </div>
  )
}
