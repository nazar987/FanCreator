import { Extension } from '@tiptap/core'

/**
 * FontSize — размер шрифта. Ставится одновременно:
 *  - на инлайновую марку textStyle (размер конкретных символов, как в Word);
 *  - на блок (paragraph/heading/listItem) — чтобы маркер списка и «база» строки
 *    совпадали по размеру с текстом (фидбэк №25) и размер держался при наборе (№26).
 */

const BLOCK_TYPES = ['paragraph', 'heading', 'listItem']

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
          let c = chain().setMark('textStyle', { fontSize: size })
          // Размер на сам блок (абзац/заголовок/пункт списка) меняем ТОЛЬКО когда
          // нет выделения — тогда маркер списка и набор совпадают по размеру.
          // Если есть выделение — красим лишь выбранный текст, иначе менялась бы
          // вся строка/заголовок и нельзя было бы задать слову свой размер. (S-H2)
          if (state.selection.empty) {
            for (const type of BLOCK_TYPES) c = c.updateAttributes(type, { fontSize: size })
          }
          return c.run()
        },
      unsetFontSize:
        () =>
        ({ chain, state }) => {
          let c = chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle()
          if (state.selection.empty) {
            for (const type of BLOCK_TYPES) c = c.resetAttributes(type, 'fontSize')
          }
          return c.run()
        }
    }
  }
})
