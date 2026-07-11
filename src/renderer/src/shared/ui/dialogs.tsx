import React from 'react'
import { Button, Input } from './components'
import type { Folder } from '@shared/types'

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
interface MessageOptions {
  title: string
  message?: React.ReactNode
  confirmLabel?: string
}
interface StoryPromptOptions {
  title: string
  placeholder?: string
  folders: Folder[]
  initialFolderId?: string | null
}
export interface StoryPromptResult {
  title: string
  folderId: string | null
}

type DialogState =
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'message'; opts: MessageOptions; resolve: () => void }
  | { kind: 'story'; opts: StoryPromptOptions; resolve: (v: StoryPromptResult | null) => void }
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

export function messageDialog(opts: MessageOptions): Promise<void> {
  return new Promise((resolve) => {
    setStateExternal?.({ kind: 'message', opts, resolve })
  })
}

/** Диалог создания истории: название + выбор папки. */
export function promptStory(opts: StoryPromptOptions): Promise<StoryPromptResult | null> {
  return new Promise((resolve) => {
    setStateExternal?.({ kind: 'story', opts, resolve })
  })
}

/** Плоский список папок с отступами для <select>. */
function flattenForSelect(folders: Folder[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  const walk = (parentId: string | null, depth: number): void => {
    folders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((f) => {
        out.push({ id: f.id, label: `${'— '.repeat(depth)}${f.title}` })
        walk(f.id, depth + 1)
      })
  }
  walk(null, 0)
  return out
}

export function DialogHost(): React.JSX.Element | null {
  const [state, setState] = React.useState<DialogState>(null)
  const [value, setValue] = React.useState('')
  const [folderId, setFolderId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setStateExternal = setState
    return () => {
      setStateExternal = null
    }
  }, [])

  React.useEffect(() => {
    if (state?.kind === 'prompt') setValue(state.opts.initial ?? '')
    if (state?.kind === 'story') {
      setValue('')
      setFolderId(state.opts.initialFolderId ?? null)
    }
  }, [state])

  if (!state) return null

  const close = (): void => setState(null)

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (state.kind === 'confirm') state.resolve(false)
      else if (state.kind === 'message') state.resolve()
      else state.resolve(null)
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
        ) : state.kind === 'story' ? (
          <>
            <Input
              autoFocus
              placeholder={(state.opts as StoryPromptOptions).placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  state.resolve({ title: value.trim(), folderId })
                  close()
                }
              }}
            />
            <select
              className="input"
              style={{ marginTop: 10 }}
              value={folderId ?? ''}
              onChange={(e) => setFolderId(e.target.value || null)}
            >
              <option value="">Без папки</option>
              {flattenForSelect((state.opts as StoryPromptOptions).folders).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
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
                  state.resolve({ title: value.trim(), folderId })
                  close()
                }}
              >
                Создать
              </Button>
            </div>
          </>
        ) : state.kind === 'confirm' ? (
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
        ) : (
          <>
            {state.opts.message && (
              <div className="dim" style={{ fontSize: 14, lineHeight: 1.5 }}>
                {state.opts.message}
              </div>
            )}
            <div className="modal-actions">
              <Button
                variant="primary"
                onClick={() => {
                  state.resolve()
                  close()
                }}
              >
                {state.opts.confirmLabel ?? 'Понятно'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
