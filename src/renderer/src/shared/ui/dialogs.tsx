import React from 'react'
import { Button, Input } from './components'

/** Императивные диалоги: prompt() и confirm() без window.* (электрон их блокирует). */

interface PromptOptions {
  title: string
  placeholder?: string
  initial?: string
  confirmLabel?: string
}
interface ConfirmOptions {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
  danger?: boolean
}

type DialogState =
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | null

let setStateExternal: ((s: DialogState) => void) | null = null

export function promptText(opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    setStateExternal?.({ kind: 'prompt', opts, resolve })
  })
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    setStateExternal?.({ kind: 'confirm', opts, resolve })
  })
}

export function DialogHost(): React.JSX.Element | null {
  const [state, setState] = React.useState<DialogState>(null)
  const [value, setValue] = React.useState('')

  React.useEffect(() => {
    setStateExternal = setState
    return () => {
      setStateExternal = null
    }
  }, [])

  React.useEffect(() => {
    if (state?.kind === 'prompt') setValue(state.opts.initial ?? '')
  }, [state])

  if (!state) return null

  const close = (): void => setState(null)

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (state.kind === 'prompt') state.resolve(null)
      else state.resolve(false)
      close()
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onKey as never} onKeyDown={onKey}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{state.opts.title}</h3>

        {state.kind === 'prompt' ? (
          <>
            <Input
              autoFocus
              placeholder={(state.opts as PromptOptions).placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  state.resolve(value.trim())
                  close()
                }
              }}
            />
            <div className="modal-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  state.resolve(null)
                  close()
                }}
              >
                Отмена
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  state.resolve(value.trim())
                  close()
                }}
              >
                {state.opts.confirmLabel ?? 'Ок'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {(state.opts as ConfirmOptions).message && (
              <div className="dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
                {(state.opts as ConfirmOptions).message}
              </div>
            )}
            <div className="modal-actions">
              <Button
                variant="ghost"
                onClick={() => {
                  state.resolve(false)
                  close()
                }}
              >
                Отмена
              </Button>
              <Button
                variant={(state.opts as ConfirmOptions).danger ? 'danger' : 'primary'}
                onClick={() => {
                  state.resolve(true)
                  close()
                }}
              >
                {state.opts.confirmLabel ?? 'Подтвердить'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
