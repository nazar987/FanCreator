import { Extension } from '@tiptap/core'

/**
 * ParagraphIndent — отступ первой строки («красная строка», как в Word).
 * Tab увеличивает отступ абзаца/заголовка, Shift+Tab — уменьшает.
 * В списках Tab отдаём стандартному поведению (вложенность пунктов).
 */

const STEP = 2.5 // em на один уровень (≈ красная строка)
const MAX = 6

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
            parseHTML: (el) => {
              const ti = parseFloat((el as HTMLElement).style.textIndent || '0')
              return ti ? Math.round(ti / STEP) : 0
            },
            renderHTML: (attrs) =>
              attrs.indent ? { style: `text-indent: ${attrs.indent * STEP}em` } : {}
          }
        }
      }
    ]
  },

  addCommands() {
    const types = this.options.types as string[]
    return {
      indent:
        () =>
        ({ editor, commands }) => {
          const type = types.find((t) => editor.isActive(t))
          if (!type) return false
          const cur = (editor.getAttributes(type).indent as number) || 0
          if (cur >= MAX) return false
          return commands.updateAttributes(type, { indent: cur + 1 })
        },
      outdent:
        () =>
        ({ editor, commands }) => {
          const type = types.find((t) => editor.isActive(t))
          if (!type) return false
          const cur = (editor.getAttributes(type).indent as number) || 0
          if (cur <= 0) return false
          return commands.updateAttributes(type, { indent: cur - 1 })
        }
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
