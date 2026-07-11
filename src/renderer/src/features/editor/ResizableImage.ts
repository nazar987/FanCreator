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
 *                       (имеют смысл только при floating);
 *  • wrap ('inline')  — «в ряд»: картинка становится inline-block, и несколько
 *                       картинок стоят бок о бок (слева-направо), а не столбиком
 *                       (фидбэк v2.1.2 «две картинки слева-справа, сравнить
 *                       до/после»). float использовать НЕЛЬЗЯ: он выпадает из
 *                       потока и ломает расчёт страниц пагинатора (проверено —
 *                       картинка «улетала» за пределы листа).
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
      wrap: {
        default: null,
        parseHTML: (el) => ((el as HTMLElement).getAttribute('data-wrap') ? 'inline' : null),
        renderHTML: (attrs) => (attrs.wrap ? { 'data-wrap': 'inline' } : {})
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

      // «в ряд»: картинки рядом друг с другом (вкл/выкл по клику)
      const wrapBtn = document.createElement('button')
      wrapBtn.className = 'fc-img-wrap-btn'
      wrapBtn.type = 'button'

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

        // «в ряд» (в режиме «перед текстом» не действует)
        const wrapMode = n.attrs.floating ? null : ((n.attrs.wrap as string) || null)
        wrap.classList.toggle('fc-img-wrap--inline', wrapMode === 'inline')
        wrapBtn.textContent = wrapMode === 'inline' ? '◫' : '▣'
        wrapBtn.title =
          wrapMode === 'inline'
            ? 'Картинка «в ряду»: соседние картинки в ряду стоят бок о бок. Нажмите — снова отдельной строкой'
            : 'Поставить в ряд: картинки в ряду встают рядом друг с другом (слева-направо)'
        wrapBtn.style.display = n.attrs.floating ? 'none' : ''

        if (n.attrs.floating) {
          wrap.classList.add('fc-img-wrap--floating')
          wrap.style.left = `${n.attrs.x ?? 0}px`
          wrap.style.top = `${n.attrs.y ?? 0}px`
          wrap.style.marginLeft = '0'
          wrap.style.marginRight = '0'
          img.style.cursor = 'move'
          floatBtn.title = 'Вернуть в текст: картинка снова встанет в строку и будет двигать текст'
        } else {
          wrap.classList.remove('fc-img-wrap--floating')
          wrap.style.left = ''
          wrap.style.top = ''
          img.style.cursor = ''
          if (!wrapMode) applyAlign(n.attrs.textAlign as string)
          else {
            wrap.style.marginLeft = ''
            wrap.style.marginRight = ''
          }
          floatBtn.title = 'Перед текстом: открепить картинку и свободно двигать её мышью поверх текста'
        }
      }

      // ----- Переключение «в ряд» -----
      wrapBtn.addEventListener('mousedown', (e) => e.preventDefault())
      wrapBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        persist({ ...current.attrs, wrap: current.attrs.wrap ? null : 'inline' })
      })

      // ----- Переключение режима «перед текстом» -----
      floatBtn.addEventListener('mousedown', (e) => e.preventDefault())
      floatBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (current.attrs.floating) {
          // сбрасываем и координаты: иначе при повторном включении «перед текстом»
          // картинка прыгала на старое место и накрывала соседнюю (п.14)
          persist({ ...current.attrs, floating: false, x: 0, y: 0 })
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
        // не даём растянуть шире текстовой колонки: «случайно увеличила во весь
        // лист» больше не запирает картинку — ручка всегда остаётся на листе
        const maxW = wrap.parentElement?.clientWidth || 634
        const onMove = (m: PointerEvent): void => {
          const next = Math.min(maxW, Math.max(60, startW + (m.clientX - startX)))
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

      wrap.append(img, handle, floatBtn, wrapBtn)
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

