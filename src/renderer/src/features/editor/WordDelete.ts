import { Extension } from '@tiptap/core'
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

export const WordDelete = Extension.create({
  name: 'wordDelete',
  // выше StarterKit/базового keymap, чтобы перехватить Ctrl+Delete до посимвольного
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      'Mod-Delete': () => deleteWordForward(this.editor.state, this.editor.view.dispatch),
      'Mod-Backspace': () => deleteWordBackward(this.editor.state, this.editor.view.dispatch),
      // Backspace в начале пункта списка — как в Word: выводим пункт из списка
      // (убираем маркер/номер), а не приклеиваем к предыдущему пункту.
      Backspace: () => {
        const { editor } = this
        const { selection, schema } = editor.state
        const listItem = schema.nodes.listItem
        if (!selection.empty || !listItem) return false
        const { $from } = selection
        if ($from.parentOffset !== 0) return false
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === listItem) {
            // только в самом начале первого параграфа пункта
            if ($from.index(d) !== 0) return false
            // как Word: ПЕРВЫЙ пункт списка выводим из списка (outdent);
            // средний/последний — обычное слияние с предыдущим (иначе список
            // разрывается на два и нумерация сбивается) — отдаём базовому keymap
            if ($from.index(d - 1) === 0) return editor.chain().liftListItem('listItem').run()
            return false
          }
        }
        return false
      }
    }
  }
})
