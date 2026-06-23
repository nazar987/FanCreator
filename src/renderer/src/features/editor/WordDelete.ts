import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'

/**
 * WordDelete — поведение клавиш удаления «как в Word» (фидбэк про Delete).
 *
 * Базовые сценарии (одиночный Delete, удаление выделения, объединение абзацев
 * в конце строки, «ничего не делать» в конце документа, очистка ячейки таблицы,
 * удаление выделённой картинки) уже корректно обрабатывает стандартный keymap
 * ProseMirror. Здесь добавляем только то, чего в нём нет:
 *
 *  • Ctrl/Cmd + Delete    — удалить слово справа от курсора;
 *  • Ctrl/Cmd + Backspace — удалить слово слева от курсора.
 *
 * Если курсор не на границе слова, выделение непустое или блок содержит
 * инлайновые объекты (картинки, переносы строк), обработчик возвращает false —
 * тогда отрабатывает стандартное посимвольное удаление.
 */
type Dispatch = ((tr: Transaction) => void) | undefined

const isWordChar = (ch: string): boolean => /[\p{L}\p{N}_]/u.test(ch)
const isSpace = (ch: string): boolean => /\s/.test(ch)

/**
 * Текстовый блок без инлайновых атомов? Только тогда смещение в тексте
 * совпадает один-к-одному со смещением в позициях документа.
 */
function isPlainTextblock(state: EditorState): boolean {
  const { $from } = state.selection
  return $from.parent.isTextblock && $from.parent.content.size === $from.parent.textContent.length
}

function deleteWordForward(state: EditorState, dispatch: Dispatch): boolean {
  const sel = state.selection
  if (!sel.empty || !isPlainTextblock(state)) return false

  const { $from } = sel
  const text = $from.parent.textContent
  const start = $from.parentOffset
  if (start >= text.length) return false // конец абзаца → joinForward из базового keymap

  let end = start
  if (isSpace(text[end])) {
    while (end < text.length && isSpace(text[end])) end++
  } else if (isWordChar(text[end])) {
    while (end < text.length && isWordChar(text[end])) end++
    while (end < text.length && isSpace(text[end])) end++ // как Word: слово + хвостовые пробелы
  } else {
    while (end < text.length && !isWordChar(text[end]) && !isSpace(text[end])) end++
  }
  if (end <= start) return false

  if (dispatch) dispatch(state.tr.delete($from.pos, $from.pos + (end - start)).scrollIntoView())
  return true
}

function deleteWordBackward(state: EditorState, dispatch: Dispatch): boolean {
  const sel = state.selection
  if (!sel.empty || !isPlainTextblock(state)) return false

  const { $from } = sel
  const text = $from.parent.textContent
  const start = $from.parentOffset
  if (start <= 0) return false // начало абзаца → joinBackward из базового keymap

  let begin = start
  if (isSpace(text[begin - 1])) {
    while (begin > 0 && isSpace(text[begin - 1])) begin-- // как Word: пробелы + слово перед ними
    while (begin > 0 && isWordChar(text[begin - 1])) begin--
  } else if (isWordChar(text[begin - 1])) {
    while (begin > 0 && isWordChar(text[begin - 1])) begin--
  } else {
    while (begin > 0 && !isWordChar(text[begin - 1]) && !isSpace(text[begin - 1])) begin--
  }
  if (begin >= start) return false

  if (dispatch) dispatch(state.tr.delete($from.pos - (start - begin), $from.pos).scrollIntoView())
  return true
}

/**
 * S-H3 — пустой пункт списка по Backspace/Enter делаем «без номера»: он остаётся
 * в том же списке, но рендерится как пустая строка (маркер скрыт, счётчик не
 * увеличивается — см. BlankListItem + CSS). Список остаётся ОДНИМ <ol>, поэтому
 * нумерация ниже продолжается и обновляется сама (убрали 3 — бывший 4 станет 3;
 * добавили пункт выше — всё пересчитается).
 *
 * Возвращает true, если обработали (курсор в пустом пункте списка); иначе false —
 * тогда отрабатывает стандартное поведение (Enter — новый пункт, Backspace — слияние).
 */
function blankOutEmptyListItem(editor: Editor): boolean {
  const { state } = editor
  const { selection, schema } = state
  if (!selection.empty) return false
  const listItem = schema.nodes.listItem
  if (!listItem) return false
  const { $from } = selection

  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === listItem) {
      const item = $from.node(d)
      if (item.textContent.length !== 0) return false // только пустой пункт
      if (item.attrs.unnumbered) return false // уже пустой без номера — не мешаем
      const itemPos = $from.before(d)
      return editor
        .chain()
        .command(({ tr }) => {
          tr.setNodeMarkup(itemPos, undefined, { ...item.attrs, unnumbered: true })
          return true
        })
        .run()
    }
  }
  return false
}

export const WordDelete = Extension.create({
  name: 'wordDelete',
  // выше StarterKit/базового keymap, чтобы перехватить Ctrl+Delete до посимвольного
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      'Mod-Delete': () => deleteWordForward(this.editor.state, this.editor.view.dispatch),
      'Mod-Backspace': () => deleteWordBackward(this.editor.state, this.editor.view.dispatch),
      // Enter в ПУСТОМ пункте списка — делаем пустую строку без номера, нумерация
      // ниже продолжается. В непустом пункте отдаём стандартному splitListItem.
      Enter: () => blankOutEmptyListItem(this.editor),
      Backspace: () => {
        const { editor } = this
        const { selection, schema } = editor.state
        const listItem = schema.nodes.listItem
        if (!selection.empty || !listItem) return false
        const { $from } = selection
        if ($from.parentOffset !== 0) return false
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === listItem) {
            if ($from.index(d) !== 0) return false
            // пустой пункт — делаем «без номера» (пустая строка), нумерация ниже
            // продолжается автоматически (S-H3, как в Word)
            if ($from.node(d).textContent.length === 0) return blankOutEmptyListItem(editor)
            // первый непустой пункт — выводим из списка (текст сохраняется)
            if ($from.index(d - 1) === 0) return editor.chain().liftListItem('listItem').run()
            // средний/последний непустой — обычное слияние с предыдущим пунктом
            return false
          }
        }
        return false
      }
    }
  }
})
