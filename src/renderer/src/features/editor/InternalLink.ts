import { Node, mergeAttributes } from '@tiptap/core'

/**
 * InternalLink — внутренняя ссылка/подстраница в стиле Notion (п.14).
 * Инлайновый атом, ссылающийся на главу проекта по id. Клик открывает её во вкладке.
 */

export interface InternalLinkOptions {
  /** Вызывается при клике по ссылке. */
  onOpen: (chapterId: string) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    internalLink: {
      setInternalLink: (attrs: { chapterId: string; label: string }) => ReturnType
    }
  }
}

export const InternalLink = Node.create<InternalLinkOptions>({
  name: 'internalLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { onOpen: () => {} }
  },

  addAttributes() {
    return {
      chapterId: { default: null },
      label: { default: 'Подстраница' }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-internal-link]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-internal-link': '',
        'data-chapter-id': node.attrs.chapterId ?? '',
        class: 'fc-internal-link'
      }),
      `📄 ${node.attrs.label}`
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'fc-internal-link'
      dom.setAttribute('data-internal-link', '')
      dom.contentEditable = 'false'
      dom.textContent = `📄 ${node.attrs.label}`
      dom.title = 'Открыть подстраницу'
      dom.addEventListener('mousedown', (event) => {
        event.preventDefault()
        if (node.attrs.chapterId) this.options.onOpen(node.attrs.chapterId)
      })
      return { dom }
    }
  },

  addCommands() {
    return {
      setInternalLink:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs })
    }
  }
})
