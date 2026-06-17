import { Extension } from '@tiptap/core'

/**
 * LineHeight — межстрочный интервал (фидбэк №31). Глобальный атрибут line-height
 * на абзацах и заголовках.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType
      unsetLineHeight: () => ReturnType
    }
  }
}

export const LineHeight = Extension.create({
  name: 'lineHeight',

  addOptions() {
    return { types: ['paragraph', 'heading'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {}
              return { style: `line-height: ${attributes.lineHeight}` }
            }
          }
        }
      }
    ]
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({ commands }) =>
          this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineHeight: value })
          ),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          this.options.types.every((type: string) =>
            commands.resetAttributes(type, 'lineHeight')
          )
    }
  }
})
