import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * SearchHighlight — подсветка всех совпадений поиска (фидбэк #1).
 * Хранит запрос и индекс текущего совпадения; рисует inline-декорации.
 */

const key = new PluginKey('searchHighlight')

interface SearchState {
  query: string
  current: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearch: (query: string) => ReturnType
      setSearchCurrent: (index: number) => ReturnType
    }
  }
  interface Storage {
    searchHighlight: SearchState
  }
}

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addStorage() {
    return { query: '', current: 0 }
  },

  addCommands() {
    return {
      setSearch:
        (query: string) =>
        ({ editor, tr, dispatch }) => {
          editor.storage.searchHighlight.query = query
          editor.storage.searchHighlight.current = 0
          if (dispatch) dispatch(tr.setMeta(key, true))
          return true
        },
      setSearchCurrent:
        (index: number) =>
        ({ editor, tr, dispatch }) => {
          editor.storage.searchHighlight.current = index
          if (dispatch) dispatch(tr.setMeta(key, true))
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin({
        key,
        props: {
          decorations: (state) => {
            const query: string = storage.query
            if (!query) return DecorationSet.empty
            const q = query.toLowerCase()
            const decos: Decoration[] = []
            let idx = 0
            state.doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const text = node.text.toLowerCase()
                let i = text.indexOf(q)
                while (i !== -1) {
                  const from = pos + i
                  const to = from + query.length
                  decos.push(
                    Decoration.inline(from, to, {
                      class:
                        idx === storage.current ? 'fc-search-hit fc-search-hit--current' : 'fc-search-hit'
                    })
                  )
                  idx++
                  i = text.indexOf(q, i + query.length)
                }
              }
              return true
            })
            return DecorationSet.create(state.doc, decos)
          }
        }
      })
    ]
  }
})
