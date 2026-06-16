import React from 'react'

export interface MenuItem {
  type?: 'item' | 'sep' | 'label'
  label?: string
  icon?: React.ReactNode
  danger?: boolean
  onClick?: () => void
  /** Подменю (например, выбор статуса). */
  submenu?: MenuItem[]
}

interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

let openExternal: ((s: MenuState) => void) | null = null

/** Открыть контекстное меню в точке курсора. */
export function openContextMenu(e: React.MouseEvent, items: MenuItem[]): void {
  e.preventDefault()
  e.stopPropagation()
  openExternal?.({ x: e.clientX, y: e.clientY, items })
}

export function ContextMenuHost(): React.JSX.Element | null {
  const [state, setState] = React.useState<MenuState | null>(null)
  const [submenu, setSubmenu] = React.useState<{ items: MenuItem[]; y: number } | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    openExternal = setState
    return () => {
      openExternal = null
    }
  }, [])

  React.useEffect(() => {
    if (!state) return
    const close = (): void => {
      setState(null)
      setSubmenu(null)
    }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [state])

  if (!state) return null

  // удерживаем меню внутри окна
  const W = 210
  const x = Math.min(state.x, window.innerWidth - W - 8)
  const y = Math.min(state.y, window.innerHeight - 8 - state.items.length * 36)

  const renderItem = (
    it: MenuItem,
    i: number,
    baseY: number,
    insideSubmenu = false
  ): React.JSX.Element => {
    if (it.type === 'sep') return <div key={i} className="ctx-sep" />
    if (it.type === 'label')
      return (
        <div key={i} className="ctx-label">
          {it.label}
        </div>
      )
    return (
      <button
        key={i}
        className={`ctx-item ${it.danger ? 'ctx-item--danger' : ''}`}
        onMouseEnter={(e) => {
          if (it.submenu)
            setSubmenu({ items: it.submenu, y: (e.currentTarget as HTMLElement).offsetTop + baseY })
          else if (!insideSubmenu) setSubmenu(null)
        }}
        onClick={() => {
          if (it.submenu) return
          it.onClick?.()
          setState(null)
          setSubmenu(null)
        }}
      >
        {it.icon}
        <span style={{ flex: 1 }}>{it.label}</span>
        {it.submenu && <span className="faint">›</span>}
      </button>
    )
  }

  return (
    <>
      <div ref={ref} className="ctx-menu" style={{ left: x, top: y }}>
        {state.items.map((it, i) => renderItem(it, i, y))}
      </div>
      {submenu && (
        <div
          className="ctx-menu"
          style={{ left: x + W - 6, top: submenu.y }}
          onMouseLeave={() => setSubmenu(null)}
        >
          {submenu.items.map((it, i) => renderItem(it, i, submenu.y, true))}
        </div>
      )}
    </>
  )
}
