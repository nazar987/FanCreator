import React from 'react'
import type { Editor } from '@tiptap/react'
import { X, ArrowDown, ArrowUp, Replace, ReplaceAll } from 'lucide-react'

interface Match {
  from: number
  to: number
}

function collectMatches(editor: Editor, query: string): Match[] {
  const matches: Match[] = []
  if (!query) return matches
  const q = query.toLowerCase()
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase()
      let i = text.indexOf(q)
      while (i !== -1) {
        matches.push({ from: pos + i, to: pos + i + query.length })
        i = text.indexOf(q, i + query.length)
      }
    }
    return true
  })
  return matches
}

export function FindReplace({
  editor,
  onClose
}: {
  editor: Editor
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = React.useState('')
  const [replace, setReplace] = React.useState('')
  const [matches, setMatches] = React.useState<Match[]>([])
  const [index, setIndex] = React.useState(0)

  const recompute = React.useCallback(
    (q: string) => {
      const m = collectMatches(editor, q)
      setMatches(m)
      setIndex(0)
      if (m[0]) editor.chain().setTextSelection(m[0]).scrollIntoView().run()
    },
    [editor]
  )

  React.useEffect(() => {
    recompute(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const go = (dir: 1 | -1): void => {
    if (!matches.length) return
    const next = (index + dir + matches.length) % matches.length
    setIndex(next)
    editor.chain().setTextSelection(matches[next]).scrollIntoView().run()
  }

  const replaceCurrent = (): void => {
    const m = matches[index]
    if (!m) return
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replace).run()
    setTimeout(() => recompute(query), 0)
  }

  const replaceAll = (): void => {
    const all = collectMatches(editor, query)
    if (!all.length) return
    let chain = editor.chain().focus()
    // с конца, чтобы позиции не сбивались
    for (let i = all.length - 1; i >= 0; i--) {
      chain = chain.insertContentAt({ from: all[i].from, to: all[i].to }, replace)
    }
    chain.run()
    setTimeout(() => recompute(query), 0)
  }

  return (
    <div className="find-panel">
      <input
        autoFocus
        className="input"
        placeholder="Найти…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go(e.shiftKey ? -1 : 1)
          if (e.key === 'Escape') onClose()
        }}
      />
      <span className="find-count">
        {matches.length ? `${index + 1} / ${matches.length}` : '0'}
      </span>
      <button className="tb-btn" title="Предыдущее" onClick={() => go(-1)}>
        <ArrowUp size={16} />
      </button>
      <button className="tb-btn" title="Следующее" onClick={() => go(1)}>
        <ArrowDown size={16} />
      </button>
      <input
        className="input"
        placeholder="Заменить на…"
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
      />
      <button className="tb-btn" title="Заменить" onClick={replaceCurrent}>
        <Replace size={16} />
      </button>
      <button className="tb-btn" title="Заменить всё" onClick={replaceAll}>
        <ReplaceAll size={16} />
      </button>
      <button className="tb-btn" title="Закрыть" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}
