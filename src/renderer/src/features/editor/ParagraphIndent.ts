import { Extension } from '@tiptap/core'

/**
 * ParagraphIndent — отступ первой строки («красная строка», как в Word).
 * Tab увеличивает отступ абзаца, Shift+Tab — уменьшает.
 * В списках Tab отдаём стандартному поведению (вложенность пунктов).
 *
 * Отступ рендерится в ФИКСИРОВАННЫХ px (как в Word — 1,25 см независимо от
 * шрифта). Раньше был em: он масштабировался по размеру шрифта, поэтому у
 * абзацев с разными размерами (и особенно у заголовков) отступы получались
 * разной ширины и «ступенчато уезжали». Теперь красная строка одинакова везде,
 * и заголовки снова её поддерживают.
 */

const STEP_PX = 40 // px на один уровень (= прежним 2.5em при базовых 16px)
const LEGACY_STEP_EM = 2.5
const MAX = 6

/** Значение text-indent из HTML → уровень отступа (поддержка старых em-документов). */
function parseIndent(raw: string): number {
  const v = parseFloat(raw)
  if (!v) return 0
  let px = v
  if (raw.includes('em')) px = (v / LEGACY_STEP_EM) * STEP_PX
  else if (raw.includes('pt')) px = (v * 96) / 72
  else if (raw.includes('cm')) px = v * 37.8
  return Math.max(0, Math.min(MAX, Math.round(px / STEP_PX)))
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphIndent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

export const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',

  addOptions() {
    return { types: ['paragraph', 'heading'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => parseIndent((el as HTMLElement).style.textIndent || '0'),
            renderHTML: (attrs) =>
              attrs.indent ? { style: `text-indent: ${attrs.indent * STEP_PX}px` } : {}
          }
        }
      }
    ]
  },

  addCommands() {
    const types = this.options.types as string[]
    // Меняем отступ ИМЕННО у блока(ов) под курсором через setNodeMarkup по точной
    // позиции — updateAttributes на границе абзаца мог применяться к соседней строке.
    const apply =
      (delta: number) =>
      ({ state, dispatch }: { state: import('@tiptap/pm/state').EditorState; dispatch?: (tr: import('@tiptap/pm/state').Transaction) => void }) => {
        const { selection } = state
        let tr = state.tr
        let changed = false
        const bump = (attrs: Record<string, unknown>, pos: number): void => {
          const cur = (attrs.indent as number) || 0
          const next = Math.max(0, Math.min(MAX, cur + delta))
          if (next !== cur) {
            tr = tr.setNodeMarkup(pos, undefined, { ...attrs, indent: next })
            changed = true
          }
        }
        if (selection.empty) {
          const $f = selection.$from
          for (let d = $f.depth; d >= 1; d--) {
            const node = $f.node(d)
            if (types.includes(node.type.name)) {
              bump(node.attrs, $f.before(d))
              break
            }
          }
        } else {
          state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (types.includes(node.type.name)) bump(node.attrs, pos)
          })
        }
        if (changed && dispatch) dispatch(tr)
        return changed
      }
    return {
      indent: () => apply(1),
      outdent: () => apply(-1)
    }
  },

  addKeyboardShortcuts() {
    return {
      // Tab как в Word: в начале абзаца — красная строка; в середине — табуляция (\t).
      Tab: ({ editor }) => {
        if (editor.isActive('listItem')) return false // списки: вложенность пунктов
        const { selection } = editor.state
        const atStart = selection.empty && selection.$from.parentOffset === 0
        if (atStart) editor.commands.indent()
        else editor.commands.insertContent('\t')
        return true // всегда «съедаем» Tab — фокус не перескакивает (#2)
      },
      'Shift-Tab': ({ editor }) => {
        if (editor.isActive('listItem')) return false
        const { selection } = editor.state
        const atStart = selection.empty && selection.$from.parentOffset === 0
        if (atStart) {
          editor.commands.outdent()
          return true
        }
        // удалить предшествующую табуляцию, иначе уменьшить красную строку
        const from = selection.from
        const before = editor.state.doc.textBetween(Math.max(0, from - 1), from)
        if (before === '\t') editor.commands.deleteRange({ from: from - 1, to: from })
        else editor.commands.outdent()
        return true
      }
    }
  }
})
