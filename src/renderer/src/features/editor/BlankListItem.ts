import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * BlankListItem (S-H3) — поддержка «пустого пункта без номера» в списке.
 *
 * Пункт с атрибутом `unnumbered` рендерится как пустая строка: маркер/номер у
 * него скрыт (CSS), и в нумерованном списке он НЕ увеличивает счётчик (CSS
 * `counter-increment: none`). За счёт этого весь список остаётся ОДНИМ <ol>, а
 * нумерация продолжается и обновляется автоматически (убрали 3 — бывший 4 станет
 * 3; добавили пункт выше — всё пересчитается само).
 *
 * Флаг ставится по Backspace/Enter в пустом пункте (см. WordDelete) и снимается
 * автоматически, как только в пункте появляется текст (appendTransaction ниже).
 */
export const BlankListItem = Extension.create({
  name: 'blankListItem',

  addGlobalAttributes() {
    return [
      {
        types: ['listItem'],
        attributes: {
          unnumbered: {
            default: false,
            parseHTML: (el) => el.getAttribute('data-unnumbered') === 'true',
            renderHTML: (attrs) => (attrs.unnumbered ? { 'data-unnumbered': 'true' } : {})
          }
        }
      }
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blankListItemReset'),
        // как только в «пустом» пункте появился текст — снимаем флаг, чтобы он
        // снова получил номер (в Word набранная строка нумеруется).
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((t) => t.docChanged)) return null
          const listItem = newState.schema.nodes.listItem
          if (!listItem) return null
          let tr = null as null | typeof newState.tr
          newState.doc.descendants((node, pos) => {
            if (node.type === listItem && node.attrs.unnumbered && node.textContent.length > 0) {
              if (!tr) tr = newState.tr
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, unnumbered: false })
            }
          })
          return tr
        }
      })
    ]
  }
})
