import React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Palette } from 'lucide-react'

const lastColors = new Map<string, string>()

const THEME_COLORS = [
  ['#ffffff', '#f2f2f2', '#d9e2f3', '#e2f0d9', '#fff2cc', '#fce4d6', '#f4cccc', '#eadcf8', '#d9ead3', '#d0e0e3'],
  ['#d9d9d9', '#bfbfbf', '#b4c6e7', '#c6e0b4', '#ffe699', '#f8cbad', '#ea9999', '#d9c2e9', '#b6d7a8', '#a2c4c9'],
  ['#a6a6a6', '#808080', '#8ea9db', '#a9d18e', '#ffd966', '#f4b183', '#e06666', '#c9a0dc', '#93c47d', '#76a5af'],
  ['#737373', '#595959', '#4472c4', '#70ad47', '#ffc000', '#ed7d31', '#c00000', '#7030a0', '#548235', '#2f75b5'],
  ['#404040', '#262626', '#2f5597', '#548235', '#bf9000', '#c65911', '#990000', '#5b2580', '#375623', '#1f4e78']
]

const STANDARD_COLORS = [
  '#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'
]

/** Содержимое палитры (цвета темы + стандартные + «другой цвет»). Переиспользуется
 *  во всплывающей палитре и в императивном пикере (для ПКМ-меню). */
function ColorPanel({
  value,
  onPick,
  onClear,
  clearLabel = 'Автоматический'
}: {
  value?: string
  onPick: (color: string) => void
  onClear?: () => void
  clearLabel?: string
}): React.JSX.Element {
  const nativeRef = React.useRef<HTMLInputElement>(null)
  const current = (value ?? '').toLowerCase()
  return (
    <>
      {onClear && (
        <button type="button" className="color-palette-auto" onClick={onClear}>
          <span className="color-palette-auto-swatch" /> {clearLabel}
        </button>
      )}
      <div className="color-palette-label">Цвета темы</div>
      <div className="color-palette-grid">
        {THEME_COLORS.flat().map((color, index) => (
          <button type="button" className="color-palette-swatch" style={{ background: color }} title={color}
            aria-label={color} key={`${color}-${index}`} onClick={() => onPick(color)}>
            {current === color && <Check size={12} />}
          </button>
        ))}
      </div>
      <div className="color-palette-label">Стандартные цвета</div>
      <div className="color-palette-grid color-palette-grid--standard">
        {STANDARD_COLORS.map((color) => (
          <button type="button" className="color-palette-swatch" style={{ background: color }} title={color}
            aria-label={color} key={color} onClick={() => onPick(color)}>
            {current === color && <Check size={12} />}
          </button>
        ))}
      </div>
      <input ref={nativeRef} className="color-palette-native" type="color" value={value ?? '#8b8cf0'}
        onChange={(event) => onPick(event.target.value)} />
      <button type="button" className="color-palette-more" onClick={() => nativeRef.current?.click()}>
        <span className="color-palette-wheel" /> Другой цвет…
      </button>
    </>
  )
}

/* ---- Императивный пикер: открыть ту же палитру из любого места (напр., ПКМ-меню) ---- */
interface ColorPickerRequest {
  value?: string
  title?: string
  onChange: (color: string) => void
  onClear?: () => void
  clearLabel?: string
}
let openExternal: ((req: ColorPickerRequest) => void) | null = null
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

/** Открыть палитру у курсора (для пунктов меню «Цвет»). */
export function openColorPicker(req: ColorPickerRequest): void {
  openExternal?.(req)
}

export function ColorPickerHost(): React.JSX.Element | null {
  const [req, setReq] = React.useState<ColorPickerRequest | null>(null)
  const [pos, setPos] = React.useState({ left: 0, top: 0 })
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    openExternal = (next) => {
      setPos({
        left: Math.max(8, Math.min(lastPointer.x, window.innerWidth - 252)),
        top: Math.max(8, Math.min(lastPointer.y, window.innerHeight - 320))
      })
      setReq(next)
    }
    const track = (e: PointerEvent): void => {
      lastPointer = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointerdown', track, true)
    return () => {
      openExternal = null
      window.removeEventListener('pointerdown', track, true)
    }
  }, [])

  React.useEffect(() => {
    if (!req) return
    const close = (e: PointerEvent): void => {
      if (!panelRef.current?.contains(e.target as Node)) setReq(null)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setReq(null)
    }
    const id = window.setTimeout(() => window.addEventListener('pointerdown', close), 0)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [req])

  if (!req) return null
  return createPortal(
    <div ref={panelRef} className="color-palette-panel" style={pos} role="dialog" aria-label={req.title ?? 'Цвет'}>
      <ColorPanel
        value={req.value}
        clearLabel={req.clearLabel}
        onClear={req.onClear ? () => { req.onClear?.(); setReq(null) } : undefined}
        onPick={(color) => { req.onChange(color); setReq(null) }}
      />
    </div>,
    document.body
  )
}

interface ColorPaletteProps {
  value?: string
  onChange: (color: string) => void
  title?: string
  className?: string
  trigger?: React.ReactNode
  onClear?: () => void
  clearLabel?: string
}

export function ColorPalette({ value, onChange, title = 'Выбрать цвет', className = '', trigger, onClear, clearLabel = 'Автоматический' }: ColorPaletteProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [lastColor, setLastColor] = React.useState(() => lastColors.get(title) ?? value ?? '#8b8cf0')
  const [position, setPosition] = React.useState({ left: 0, top: 0 })
  const rootRef = React.useRef<HTMLSpanElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  const toggle = (event: React.MouseEvent): void => {
    event.stopPropagation()
    if (!open) {
      const rect = rootRef.current?.getBoundingClientRect()
      if (rect) {
        setPosition({
          left: Math.max(8, Math.min(rect.left, window.innerWidth - 252)),
          top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 294))
        })
      }
    }
    setOpen((shown) => !shown)
  }

  React.useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const select = (color: string): void => {
    lastColors.set(title, color)
    setLastColor(color)
    onChange(color)
    setOpen(false)
  }

  return (
    <span ref={rootRef} className={`color-palette-root ${className}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="color-palette-trigger color-palette-quick" title={`${title}: применить последний цвет`}
        aria-label={`${title}: применить последний цвет`} onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => { event.stopPropagation(); onChange(lastColor) }}>
        {trigger ?? <Palette size={15} />}
        <span className="color-palette-current" style={{ background: lastColor }} />
      </button>
      <button type="button" className="color-palette-open" title={`Открыть палитру: ${title}`}
        aria-label={`Открыть палитру: ${title}`} aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()} onClick={toggle}>
        <ChevronDown size={12} />
      </button>
      {open && createPortal(
        <div ref={panelRef} className="color-palette-panel" style={position} role="dialog" aria-label={title}
          onMouseDown={(event) => event.preventDefault()} onClick={(event) => event.stopPropagation()}>
          <ColorPanel
            value={lastColor}
            clearLabel={clearLabel}
            onClear={onClear ? () => { onClear(); setOpen(false) } : undefined}
            onPick={select}
          />
        </div>,
        document.body
      )}
    </span>
  )
}
