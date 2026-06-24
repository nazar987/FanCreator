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
 * LinkPlain — атрибут «как обычный текст» на гиперссылке: убирает подчёркивание и
 * цвет, чтобы ссылка выглядела как остальной текст (но остаётся ссылкой). (#8)
 */
export const LinkPlain = Extension.create({
  name: 'linkPlain',
  addGlobalAttributes() {
    return [
      {
        types: ['link'],
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
