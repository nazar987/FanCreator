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

/** Длина первого графемного кластера в позициях документа (emoji/суррогаты = 2). */
function forwardGraphemeSize(text: string): number {
  if (!text) return 1
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const first = seg.segment(text)[Symbol.iterator]().next().value as { segment: string } | undefined
    return first ? first.segment.length : 1
  } catch {
    const cp = text.codePointAt(0)
    return cp && cp > 0xffff ? 2 : 1
  }
}

/**
 * Delete «как в Word». Штатный keymap TipTap для Delete делает `deleteCurrentNode`
 * (удаляет целый узел — отсюда «стёрлось слово/абзац»), а расширение списков вешает
 * на Delete `joinItemForward`/lift (в нумерации это выглядит как «создался пункт»).
 * Перехватываем сами:
 *  • есть выделение — удаляем его;
 *  • курсор в середине строки — удаляем РОВНО один символ вперёд;
 *  • конец блока — обычное присоединение следующего блока / выбор атома
 *    (без deleteCurrentNode и списочной магии).
 */
function forwardDelete(editor: Editor): boolean {
  const { state } = editor
  const sel = state.selection
  if (!sel.empty) {
    editor.commands.deleteSelection()
    return true
  }
  const { $from } = sel
  const parent = $from.parent
  if (parent.isTextblock && $from.parentOffset < parent.content.size) {
    const text = parent.textBetween(
      $from.parentOffset,
      Math.min($from.parentOffset + 8, parent.content.size),
      '￼',
      '￼'
    )
    const size = forwardGraphemeSize(text)
    editor.view.dispatch(state.tr.delete($from.pos, $from.pos + size).scrollIntoView())
    return true
  }
  // Конец последнего пункта списка: НИЧЕГО не делаем. Иначе joinForward тянет
  // абзац, идущий ПОСЛЕ списка, и ProseMirror заворачивает его в новый пункт
  // (появлялся «4-й» пункт). Внутри списка (есть следующий пункт) — обычное слияние.
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'listItem') {
      const blockIsLast = $from.index(d) === $from.node(d).childCount - 1
      const itemIsLast = $from.index(d - 1) === $from.node(d - 1).childCount - 1
      if (blockIsLast && itemIsLast) return true // конец последнего пункта → no-op
      break
    }
  }
  // конец блока: обычное присоединение следующего блока / выбор атома (напр. картинки).
  // ВСЕГДА возвращаем true — чтобы core не выполнил свой deleteCurrentNode, который и
  // «стирал слово/абзац» и удалял картинку на пустой строке ниже.
  if (!editor.commands.joinForward()) editor.commands.selectNodeForward()
  return true
}

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
      // Delete «как в Word» (перехватываем у core/списков — см. forwardDelete)
      Delete: () => forwardDelete(this.editor),
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
            // непустой пункт: Backspace в начале строки СНИМАЕТ номер и оставляет
            // текст на той же строке (выводим из списка), а не сливает с прошлым
            // пунктом (как в Word). Работает для любого пункта, не только первого.
            return editor.chain().liftListItem('listItem').run()
          }
        }
        return false
      }
    }
  }
})
