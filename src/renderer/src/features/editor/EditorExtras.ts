import { Extension } from '@tiptap/core'

/**
 * HeadingWeight — атрибут font-weight на заголовке, чтобы можно было СНЯТЬ жирный
 * (кнопкой «Ж»). Заголовки жирные по умолчанию (CSS); значение 'normal'
 * переопределяет вес инлайном. (фидбэк v2.0.8)
 */
export const HeadingWeight = Extension.create({
  name: 'headingWeight',
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontWeight || null,
            renderHTML: (attrs) =>
              attrs.fontWeight ? { style: `font-weight: ${attrs.fontWeight}` } : {}
          }
        }
      }
    ]
  }
})

/**
 * OrderedListStart — стартовый номер нумерованного списка (продолжить с N).
 * Отдельный атрибут `listStart` (не трогаем нативный `start` StarterKit и саму
 * CSS-нумерацию): рендерит инлайновый `counter-reset: fc-ol (N-1)` на <ol>, что
 * сдвигает счётчик. Без значения — ничего не меняется (обычный старт с 1).
 */
export const OrderedListStart = Extension.create({
  name: 'orderedListStart',
  addGlobalAttributes() {
    return [
      {
        types: ['orderedList'],
        attributes: {
          listStart: {
            default: null,
            parseHTML: (el) => {
              const v = parseInt((el as HTMLElement).getAttribute('data-list-start') || '', 10)
              return Number.isFinite(v) && v > 1 ? v : null
            },
            renderHTML: (attrs) => {
              const n = attrs.listStart as number | null
              if (!n || n <= 1) return {}
              return { 'data-list-start': String(n), style: `counter-reset: fc-ol ${n - 1}` }
            }
          }
        }
      }
    ]
  }
})

/**
 * LinkPlain — атрибут «как обычный текст» на гиперссылке и вики-ссылке: убирает
 * подчёркивание и цвет, чтобы ссылка выглядела как остальной текст (но остаётся
 * ссылкой). (#8)
 */
export const LinkPlain = Extension.create({
  name: 'linkPlain',
  addGlobalAttributes() {
    return [
      {
        types: ['link', 'wikiLink'],
        attributes: {
          plain: {
            default: false,
            parseHTML: (el) => (el as HTMLElement).classList.contains('fc-link-plain'),
            renderHTML: (attrs) => (attrs.plain ? { class: 'fc-link-plain' } : {})
          }
        }
      }
    ]
  }
})
