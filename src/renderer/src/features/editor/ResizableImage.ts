import Image from '@tiptap/extension-image'

/**
 * ResizableImage — картинка с ручкой изменения размера прямо в тексте (фидбэк №24).
 * Расширяет стандартный Image: добавляет атрибут width и NodeView с перетаскиваемой ручкой.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.width || el.getAttribute('width') || null,
        renderHTML: (attrs) => (attrs.width ? { style: `width: ${attrs.width}` } : {})
      }
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrap = document.createElement('span')
      wrap.className = 'fc-img-wrap'

      // выравнивание картинки (left/center/right) через авто-поля (п. про выравнивание)
      const applyAlign = (align: string | null): void => {
        wrap.style.marginLeft = align === 'center' || align === 'right' ? 'auto' : '0'
        wrap.style.marginRight = align === 'center' || align === 'left' ? 'auto' : '0'
      }
      applyAlign(node.attrs.textAlign as string)

      const img = document.createElement('img')
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      if (node.attrs.width) img.style.width = node.attrs.width as string

      const handle = document.createElement('span')
      handle.className = 'fc-img-handle'
      handle.title = 'Потяните, чтобы изменить размер'

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const startX = e.clientX
        const startW = img.offsetWidth
        const onMove = (m: PointerEvent): void => {
          const next = Math.max(60, startW + (m.clientX - startX))
          img.style.width = `${next}px`
        }
        const onUp = (): void => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          if (typeof getPos !== 'function') return
          const pos = getPos()
          if (pos == null) return
          editor.view.dispatch(
            editor.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width: img.style.width
            })
          )
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      })

      wrap.append(img, handle)

      return {
        dom: wrap,
        update: (updated) => {
          if (updated.type.name !== this.name) return false
          img.src = updated.attrs.src
          img.style.width = (updated.attrs.width as string) || ''
          applyAlign(updated.attrs.textAlign as string)
          return true
        }
      }
    }
  }
})
