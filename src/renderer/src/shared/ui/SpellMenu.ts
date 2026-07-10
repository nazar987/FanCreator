import type { MenuItem } from './ContextMenu'
import { openContextMenuAt } from './ContextMenu'

/**
 * Единое контекстное меню орфографии (п.11 фидбэка v2.1.1).
 *
 * Раньше main показывал НАТИВНОЕ меню с исправлениями, а редактор — своё
 * кастомное (например, «Продолжить нумерацию…» в списке) с preventDefault.
 * В пунктах списка кастомное меню перехватывало клик, и исправление слова
 * не работало. Теперь main на каждый правый клик по редактируемому полю шлёт
 * событие `spell:context` (слово с ошибкой + варианты), а renderer собирает
 * ОДНО меню: исправления + «Добавить в словарь» + пункты редактора.
 *
 * Пункты редактора регистрируются через setSpellMenuExtras() из обработчика
 * onContextMenu (без preventDefault!) — они живут короткое окно времени,
 * пока не придёт парное событие из main.
 */

let extras: MenuItem[] = []
let extrasAt = 0

/** Зарегистрировать пункты редактора для ближайшего события spell:context. */
export function setSpellMenuExtras(items: MenuItem[]): void {
  extras = items
  extrasAt = Date.now()
}

let unsubscribe: (() => void) | null = null

/** Подписаться на события орфографии из main (вызывается один раз из App). */
export function initSpellMenu(): void {
  if (unsubscribe) return
  unsubscribe = window.api.spelling.onContext((data) => {
    const items: MenuItem[] = []
    if (data.word) {
      if (data.suggestions.length) {
        items.push({ type: 'label', label: 'Исправить на…' })
        for (const s of data.suggestions) {
          items.push({ label: s, onClick: () => void window.api.spelling.replace(s) })
        }
      }
      items.push({
        label: `Добавить «${data.word}» в словарь`,
        onClick: () => void window.api.spelling.addToDictionary(data.word)
      })
    }
    // пункты редактора актуальны только для ЭТОГО клика (парное DOM-событие
    // приходит раньше IPC; окно в 600 мс страхует от устаревших пунктов)
    const fresh = Date.now() - extrasAt < 600 ? extras : []
    extras = []
    if (fresh.length) {
      if (items.length) items.push({ type: 'sep' })
      items.push(...fresh)
    }
    if (items.length) openContextMenuAt(data.x, data.y, items)
  })
}
