import React from 'react'

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * Текстовое поле, которое само растягивается вниз по мере набора (как просила
 * заказчица). Высота = содержимому, без внутреннего скролла.
 */
export function AutoTextarea({ className = '', value, onChange, ...rest }: Props): React.JSX.Element {
  const ref = React.useRef<HTMLTextAreaElement>(null)

  const resize = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  React.useLayoutEffect(() => {
    resize()
  }, [value, resize])

  return (
    <textarea
      ref={ref}
      className={`auto-textarea ${className}`}
      value={value}
      rows={1}
      onChange={(event) => {
        onChange?.(event)
        resize()
      }}
      {...rest}
    />
  )
}
