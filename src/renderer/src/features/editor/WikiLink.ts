import { Mark, mergeAttributes } from '@tiptap/core'

/**
 * WikiLink — «глобальная ссылка» в стиле Википедии (S-G, фидбэк №5).
 * Марка поверх выделенного текста (имени/названия), ссылающаяся на сущность проекта.
 * Клик/наведение обрабатываются в Editor через editorProps.handleDOMEvents
 * (марка лишь хранит атрибуты и рендерит data-* для делегирования событий).
 */

export type WikiLinkKind = 'chapter' | 'character' | 'story' | 'timeline'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attrs: { kind: WikiLinkKind; refId: string }) => ReturnType
      unsetWikiLink: () => ReturnType
    }
  }
}

export const WikiLink = Mark.create({
  name: 'wikiLink',
  inclusive: false,

  addAttributes() {
    return {
      kind: { default: 'chapter' },
      refId: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-wiki-link]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': '',
        'data-kind': HTMLAttributes.kind ?? 'chapter',
        'data-ref-id': HTMLAttributes.refId ?? '',
        class: 'fc-wikilink'
      }),
      0
    ]
  },

  addCommands() {
    return {
      setWikiLink:
        (attrs) =>
        ({ chain }) =>
          chain().setMark(this.name, attrs).run(),
      unsetWikiLink:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run()
    }
  }
})
