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
 * S-H3 — пустой пункт списка по Backspace/Enter превращаем в пустую строку,
 * выводя его из списка, а нумерацию ниже ПРОДОЛЖАЕМ (как в Word «continue
 * previous list»): если убрать пункт 3, то бывший 4 становится 3.
 *
 * Возвращает true, если обработали (курсор в пустом пункте списка); иначе false —
 * тогда отрабатывает стандартное поведение (Enter — новый пункт, Backspace — слияние).
 */
function exitEmptyListItem(editor: Editor): boolean {
  const { state } = editor
  const { selection, schema } = state
  if (!selection.empty) return false
  const listItem = schema.nodes.listItem
  const orderedList = schema.nodes.orderedList
  if (!listItem) return false
  const { $from } = selection

  // глубина пункта списка
  let liDepth = -1
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === listItem) {
      liDepth = d
      break
    }
  }
  if (liDepth < 0) return false
  // пункт должен быть пустым (без текста)
  if ($from.node(liDepth).textContent.length !== 0) return false

  const listDepth = liDepth - 1
  const list = $from.node(listDepth)
  const itemIndex = $from.index(listDepth) // 0-based индекс пункта в списке
  const isOrdered = !!orderedList && list.type === orderedList
  const listStart = (list.attrs.start as number) || 1
  const ordinal = listStart + itemIndex // номер удаляемого пункта = старт списка ниже

  return editor
    .chain()
    .liftListItem('listItem')
    .command(({ tr }) => {
      if (!isOrdered || ordinal <= 1) return true
      // после вывода пункта — список ниже начинается сразу за пустым абзацем;
      // выставляем ему start, чтобы нумерация продолжилась (4 → 3).
      const $cur = tr.selection.$from
      const afterPara = $cur.after($cur.depth)
      const lower = tr.doc.resolve(afterPara).nodeAfter
      if (lower && orderedList && lower.type === orderedList) {
        tr.setNodeMarkup(afterPara, undefined, { ...lower.attrs, start: ordinal })
      }
      return true
    })
    .run()
}

export const WordDelete = Extension.create({
  name: 'wordDelete',
  // выше StarterKit/базового keymap, чтобы перехватить Ctrl+Delete до посимвольного
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      'Mod-Delete': () => deleteWordForward(this.editor.state, this.editor.view.dispatch),
      'Mod-Backspace': () => deleteWordBackward(this.editor.state, this.editor.view.dispatch),
      // Enter в ПУСТОМ пункте списка — вывести из списка пустой строкой, нумерацию
      // ниже продолжить. В непустом пункте отдаём стандартному splitListItem.
      Enter: () => exitEmptyListItem(this.editor),
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
            // пустой пункт — убираем номер, оставляем пустую строку, нумерацию
            // ниже продолжаем (S-H3, как в Word)
            if ($from.node(d).textContent.length === 0) return exitEmptyListItem(editor)
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
