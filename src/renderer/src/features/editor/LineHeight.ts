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
      // Применяем ко ВСЕМ типам через chain, а не .every — иначе на заголовке
      // updateAttributes('paragraph') возвращал false, .every обрывался, и
      // межстрочный у заголовков не менялся (фидбэк v2.0.8).
      setLineHeight:
        (value: string) =>
        ({ chain }) => {
          let c = chain()
          for (const type of this.options.types as string[]) {
            c = c.updateAttributes(type, { lineHeight: value })
          }
          return c.run()
        },
      unsetLineHeight:
        () =>
        ({ chain }) => {
          let c = chain()
          for (const type of this.options.types as string[]) {
            c = c.resetAttributes(type, 'lineHeight')
          }
          return c.run()
        }
    }
  }
})
