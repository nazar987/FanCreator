import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

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
 * OrderedListStart — сквозная нумерация списков (как многоуровневый список Word).
 *
 * Атрибуты нумерованного списка:
 *  • listContinue — «продолжить нумерацию предыдущего списка» (логическая связь);
 *  • listStartManual — ручной старт «начать заново с N» (для несвязанных списков);
 *  • listStart — ВЫЧИСЛЯЕМЫЙ старт (рендерит counter-reset). Его пересчитывает
 *    плагин на каждое изменение документа, поэтому при добавлении пунктов в
 *    верхний список нижний (связанный) пересчитывается сам и не «слетает».
 */
const listStartKey = new PluginKey('orderedListStart')

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
          },
          listContinue: {
            default: false,
            parseHTML: (el) => (el as HTMLElement).getAttribute('data-list-continue') === 'true',
            renderHTML: (attrs) => (attrs.listContinue ? { 'data-list-continue': 'true' } : {})
          },
          listStartManual: {
            default: null,
            parseHTML: (el) => {
              const v = parseInt((el as HTMLElement).getAttribute('data-list-start-manual') || '', 10)
              return Number.isFinite(v) && v > 1 ? v : null
            },
            renderHTML: (attrs) =>
              attrs.listStartManual ? { 'data-list-start-manual': String(attrs.listStartManual) } : {}
          }
        }
      }
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: listStartKey,
        // пересчёт сквозной нумерации: бежим по спискам верхнего уровня по порядку,
        // ведём счётчик `running`; связанный список (listContinue) начинается с него.
        appendTransaction: (trs, _old, newState) => {
          if (!trs.some((t) => t.docChanged)) return null
          const ol = newState.schema.nodes.orderedList
          if (!ol) return null
          let tr = null as null | typeof newState.tr
          let running = 1
          newState.doc.forEach((node, offset) => {
            if (node.type !== ol) return
            const manual = (node.attrs.listStartManual as number | null) || 1
            const desired = node.attrs.listContinue ? running : manual
            if ((node.attrs.listStart || 1) !== desired) {
              if (!tr) tr = newState.tr
              tr.setNodeMarkup(offset, undefined, { ...node.attrs, listStart: desired > 1 ? desired : null })
            }
            // считаем только нумерованные пункты (без «пустых без номера»)
            const numbered = node.content.content.filter((li) => !li.attrs.unnumbered).length
            running = desired + numbered
          })
          return tr
        }
      })
    ]
  }
})

/**
 * wikiLinkGuard — динамически «гасит» вид вики-ссылки, если её цель удалена
 * (история/персонаж/глава/таймлайн больше не существует). Сам текст и марка
 * остаются (чтобы при возврете цели связь ожила), но добавляется декорация
 * `fc-wikilink--dead`, по которой CSS убирает цвет/подчёркивание — выглядит как
 * обычный текст. Переход по такой ссылке и так ни к чему не ведёт.
 *
 * `exists` читает актуальный проект (через ref в Editor), а пересчёт декораций
 * форсируется метой `wikiLinkGuardKey` при смене проекта (удалении сущности).
 */
export const wikiLinkGuardKey = new PluginKey('wikiLinkGuard')

export function wikiLinkGuard(exists: (kind: string, refId: string) => boolean): Extension {
  const build = (doc: PMNode): DecorationSet => {
    const decos: Decoration[] = []
    doc.descendants((node, pos) => {
      if (!node.isText) return
      const mark = node.marks.find((m) => m.type.name === 'wikiLink')
      if (mark && !exists(mark.attrs.kind, mark.attrs.refId)) {
        decos.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'fc-wikilink--dead' }))
      }
    })
    return DecorationSet.create(doc, decos)
  }
  return Extension.create({
    name: 'wikiLinkGuard',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: wikiLinkGuardKey,
          state: {
            init: (_config, state) => build(state.doc),
            apply: (tr, old, _oldState, newState) =>
              tr.docChanged || tr.getMeta(wikiLinkGuardKey) ? build(newState.doc) : old.map(tr.mapping, tr.doc)
          },
          props: {
            decorations(state) {
              return wikiLinkGuardKey.getState(state)
            }
          }
        })
      ]
    }
  })
}

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
