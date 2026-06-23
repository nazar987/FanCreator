import { Extension } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'

/**
 * FontSize — размер шрифта как в Word: меняется ИМЕННО текст, а не вся строка.
 *  - есть выделение → красим только выделенный текст (марка textStyle);
 *  - нет выделения → расширяем до СЛОВА под курсором и красим его (можно делать
 *    слова разного размера в одной строке, в т.ч. в заголовке — меняется слово,
 *    а не весь заголовок). Если курсор не на слове — просто ставим марку для
 *    дальнейшего набора.
 * Блок (абзац/заголовок) сам по себе размер больше НЕ перетягивает.
 */

const BLOCK_TYPES = ['paragraph', 'heading', 'listItem']

const isWordChar = (ch: string): boolean => /[\p{L}\p{N}_]/u.test(ch)

/** Границы слова под курсором в координатах документа (или null, если не на слове). */
function wordRangeAtCursor(state: EditorState): { from: number; to: number } | null {
  const { $from, empty } = state.selection
  if (!empty || !$from.parent.isTextblock) return null
  // только простой текстовый блок: смещение в тексте == смещение в позициях
  if ($from.parent.content.size !== $from.parent.textContent.length) return null
  const text = $from.parent.textContent
  const offset = $from.parentOffset
  let start = offset
  let end = offset
  while (start > 0 && isWordChar(text[start - 1])) start--
  while (end < text.length && isWordChar(text[end])) end++
  if (start === end) return null
  const base = $from.start()
  return { from: base + start, to: base + end }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
          }
        }
      },
      {
        types: BLOCK_TYPES,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
          }
        }
      }
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain, state }) => {
          // нет выделения → красим слово под курсором (S-H2), вернув каретку на место
          const word = wordRangeAtCursor(state)
          if (word) {
            const caret = state.selection.from
            return chain()
              .setTextSelection(word)
              .setMark('textStyle', { fontSize: size })
              .setTextSelection(caret)
              .run()
          }
          return chain().setMark('textStyle', { fontSize: size }).run()
        },
      unsetFontSize:
        () =>
        ({ chain, state }) => {
          const word = wordRangeAtCursor(state)
          if (word) {
            const caret = state.selection.from
            return chain()
              .setTextSelection(word)
              .setMark('textStyle', { fontSize: null })
              .removeEmptyTextStyle()
              .setTextSelection(caret)
              .run()
          }
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
        }
    }
  }
})
