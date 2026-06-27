import React from 'react'

/**
 * ZoomPan — масштабирование (Ctrl+колесо, к курсору) и панорамирование (перетас-
 * кивание фона) содержимого, как на доске. Клики по вложенным элементам работают:
 * панорама стартует только при реальном движении мыши (порог), иначе это клик.
 * Переиспользуется для таймлайна (дерево/рыбья кость) и родословной.
 */
export function ZoomPan({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  const [zoom, setZoom] = React.useState(1)
  const [pan, setPan] = React.useState({ x: 24, y: 24 })
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom
  const panRef = React.useRef(pan)
  panRef.current = pan
  const drag = React.useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null)

  const MIN = 0.3
  const MAX = 2.5

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

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y, moved: false }
  }

  React.useEffect(() => {
    const move = (e: MouseEvent): void => {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
      if (d.moved) setPan({ x: d.px + dx, y: d.py + dy })
    }
    const up = (): void => {
      drag.current = null
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [])

  const step = (d: number): void => setZoom((z) => Math.min(MAX, Math.max(MIN, +(z + d).toFixed(2))))
  const reset = (): void => {
    setZoom(1)
    setPan({ x: 24, y: 24 })
  }

  return (
    <div ref={wrapRef} className={`zoompan ${className}`} onWheel={onWheel} onMouseDown={onMouseDown}>
      <div
        className="zoompan-inner"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {children}
      </div>
      <div className="zoompan-controls">
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
