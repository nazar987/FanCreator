import Image from '@tiptap/extension-image'
import type { Node as ProseNode } from '@tiptap/pm/model'

/**
 * ResizableImage — картинка с ручкой изменения размера (фидбэк №24) и режимом
 * свободного перемещения «перед текстом», как в Word (S-4).
 *
 * Атрибуты:
 *  • width            — ширина (ресайз ручкой);
 *  • floating         — режим «перед текстом»: position:absolute, картинка летает
 *                       поверх текста, текст под ней не сдвигается;
 *  • x, y             — координаты картинки в пикселях относительно области редактора
 *                       (имеют смысл только при floating).
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.width || el.getAttribute('width') || null,
        renderHTML: (attrs) => (attrs.width ? { style: `width: ${attrs.width}` } : {})
      },
      floating: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-floating') === 'true',
        renderHTML: (attrs) => (attrs.floating ? { 'data-floating': 'true' } : {})
      },
      x: {
        default: 0,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-x')) || 0,
        renderHTML: (attrs) => (attrs.floating ? { 'data-x': String(attrs.x ?? 0) } : {})
      },
      y: {
        default: 0,
        parseHTML: (el) => Number((el as HTMLElement).getAttribute('data-y')) || 0,
        renderHTML: (attrs) => (attrs.floating ? { 'data-y': String(attrs.y ?? 0) } : {})
      }
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current: ProseNode = node

      const wrap = document.createElement('span')
      wrap.className = 'fc-img-wrap'

      const img = document.createElement('img')
      img.draggable = false // отключаем стандартный браузерный перенос картинки (шаг 2)

      const handle = document.createElement('span')
      handle.className = 'fc-img-handle'
      handle.title = 'Потяните, чтобы изменить размер'

      const floatBtn = document.createElement('button')
      floatBtn.className = 'fc-img-float'
      floatBtn.type = 'button'

      // Сохранить атрибуты ноды в документ.
      const persist = (attrs: Record<string, unknown>): void => {
        if (typeof getPos !== 'function') return
        const pos = getPos()
        if (pos == null) return
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, attrs))
      }

      // Выравнивание (left/center/right) через авто-поля — только в обычном режиме.
      const applyAlign = (align: string | null): void => {
        wrap.style.marginLeft = align === 'center' || align === 'right' ? 'auto' : '0'
        wrap.style.marginRight = align === 'center' || align === 'left' ? 'auto' : '0'
      }

      const render = (n: ProseNode): void => {
        current = n
        img.src = n.attrs.src
        img.alt = n.attrs.alt || ''
        img.style.width = (n.attrs.width as string) || ''

        if (n.attrs.floating) {
          wrap.classList.add('fc-img-wrap--floating')
          wrap.style.left = `${n.attrs.x ?? 0}px`
          wrap.style.top = `${n.attrs.y ?? 0}px`
          wrap.style.marginLeft = '0'
          wrap.style.marginRight = '0'
          img.style.cursor = 'move'
          floatBtn.title = 'Вернуть картинку в текст'
        } else {
          wrap.classList.remove('fc-img-wrap--floating')
          wrap.style.left = ''
          wrap.style.top = ''
          img.style.cursor = ''
          applyAlign(n.attrs.textAlign as string)
          floatBtn.title = 'Перед текстом (свободно перемещать)'
        }
      }

      // ----- Переключение режима «перед текстом» -----
      floatBtn.addEventListener('mousedown', (e) => e.preventDefault())
      floatBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (current.attrs.floating) {
          persist({ ...current.attrs, floating: false })
          return
        }
        // Включаем floating, сохранив текущее визуальное положение, чтобы картинка не «прыгнула».
        const parent = wrap.offsetParent as HTMLElement | null
        const rect = wrap.getBoundingClientRect()
        const parentRect = parent?.getBoundingClientRect()
        const x = parentRect ? Math.round(rect.left - parentRect.left + parent!.scrollLeft) : wrap.offsetLeft
        const y = parentRect ? Math.round(rect.top - parentRect.top + parent!.scrollTop) : wrap.offsetTop
        persist({ ...current.attrs, floating: true, x, y })
      })

      // ----- Перетаскивание картинки в режиме floating (шаги 2–4) -----
      img.addEventListener('pointerdown', (e) => {
        if (!current.attrs.floating) return // в обычном режиме — стандартное выделение
        e.preventDefault() // отключаем браузерный drag (шаг 2)
        e.stopPropagation()
        const startMouseX = e.clientX
        const startMouseY = e.clientY
        const startX = Number(current.attrs.x) || 0 // где была картинка (шаг 2)
        const startY = Number(current.attrs.y) || 0

        const onMove = (m: PointerEvent): void => {
          // смещение картинки = смещению мыши (шаг 3)
          const nx = startX + (m.clientX - startMouseX)
          const ny = startY + (m.clientY - startMouseY)
          wrap.style.left = `${nx}px`
          wrap.style.top = `${ny}px`
        }
        const onUp = (u: PointerEvent): void => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          // фиксируем итоговые координаты (шаг 4)
          const nx = startX + (u.clientX - startMouseX)
          const ny = startY + (u.clientY - startMouseY)
          persist({ ...current.attrs, x: nx, y: ny })
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      })

      // ----- Ресайз ручкой -----
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
          persist({ ...current.attrs, width: img.style.width })
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      })

      wrap.append(img, handle, floatBtn)
      render(node)

      return {
        dom: wrap,
        update: (updated) => {
          if (updated.type.name !== this.name) return false
          render(updated)
          return true
        }
      }
    }
  }
})
