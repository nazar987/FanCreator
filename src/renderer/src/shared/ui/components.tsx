import React from 'react'
import type { ChapterStatus } from '@shared/types'

type ButtonVariant = 'primary' | 'ghost' | 'soft' | 'danger'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: boolean
}

export function Button({
  variant = 'soft',
  size = 'md',
  icon = false,
  className = '',
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  const cls = [
    'btn',
    `btn--${variant}`,
    size === 'sm' && 'btn--sm',
    icon && 'btn--icon',
    className
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
}

export function Input({ icon, className = '', ...rest }: InputProps): React.JSX.Element {
  if (icon) {
    return (
      <div className="input-wrap">
        <span className="input-icon">{icon}</span>
        <input className={`input input--with-icon ${className}`} {...rest} />
      </div>
    )
  }
  return <input className={`input ${className}`} {...rest} />
}

export function Card({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  )
}

const STATUS_LABEL: Record<ChapterStatus, string> = {
  idea: 'Идея',
  draft: 'Черновик',
  editing: 'Редактируется',
  done: 'Готово'
}

export function StatusBadge({ status }: { status: ChapterStatus }): React.JSX.Element {
  return (
    <span className="badge badge--dot" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function Hashtags({ tags }: { tags: string[] }): React.JSX.Element | null {
  if (!tags?.length) return null
  return (
    <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {tags.map((t) => (
        <span key={t} className="hashtag">
          #{t}
        </span>
      ))}
    </span>
  )
}

export { STATUS_LABEL }
