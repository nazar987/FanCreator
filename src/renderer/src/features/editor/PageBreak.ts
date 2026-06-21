import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Вставить ручной разрыв страницы (S-F5). */
      setPageBreak: () => ReturnType
    }
  }
}

/**
 * PageBreak — ручной разрыв страницы для редактора с tiptap-pagination-plus.
 *
 * Пагинатор верстает страницы по высоте и расставляет «лесенку» границ
 * (`.rm-pagination-gap`). API форсированного разрыва у него нет, поэтому узел —
 * самоизмеряющийся спейсер: занимает место от своей позиции до ближайшей границы
 * страницы, и следующий за ним текст начинается с новой страницы.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'fc-page-break' })]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run()
    }
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('div')
      dom.className = 'fc-page-break'
      dom.contentEditable = 'false'
      const label = document.createElement('div')
      label.className = 'fc-page-break-label'
      label.textContent = 'Разрыв страницы'
      dom.appendChild(label)

      let raf = 0
      const measure = (): void => {
        const prose = dom.closest('.ProseMirror') as HTMLElement | null
        if (!prose) return
        const gaps = prose.querySelectorAll('.rm-pagination-gap')
        if (!gaps.length) {
          if (dom.style.height) dom.style.height = ''
          return
        }
        const zoom = parseFloat((getComputedStyle(prose) as unknown as { zoom: string }).zoom) || 1
        const domTop = dom.getBoundingClientRect().top
        let targetTop: number | null = null
        gaps.forEach((g) => {
          const t = (g as HTMLElement).getBoundingClientRect().top
          if (targetTop === null && t > domTop + 6) targetTop = t
        })
        if (targetTop === null) {
          if (dom.style.height) dom.style.height = ''
          return
        }
        const h = Math.max(0, (targetTop - domTop) / zoom - 4)
        const cur = parseFloat(dom.style.height || '0')
        if (Math.abs(cur - h) > 2) dom.style.height = `${h}px`
      }
      const schedule = (): void => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(measure)
      }

      schedule()
      const prose = dom.closest('.ProseMirror')
      const ro = new ResizeObserver(schedule)
      if (prose) ro.observe(prose)
      window.addEventListener('resize', schedule)

      return {
        dom,
        ignoreMutation: () => true,
        destroy() {
          cancelAnimationFrame(raf)
          ro.disconnect()
          window.removeEventListener('resize', schedule)
        }
      }
    }
  }
})
