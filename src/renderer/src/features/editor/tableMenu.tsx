import React from 'react'
import type { Editor } from '@tiptap/core'
import {
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Combine,
  Split,
  Heading1,
  Trash2
} from 'lucide-react'
import type { MenuItem } from '../../shared/ui/ContextMenu'

/**
 * Таблицы 2.0 (S-Q1) — операции «как в Word» одним меню. Используется в двух
 * местах: кнопка «Таблица» в тулбаре (когда курсор в таблице) и правый клик
 * внутри таблицы (через единое меню SpellMenu — вместе с исправлениями
 * орфографии). Недоступные операции гасятся через editor.can().
 */
export function tableMenuItems(editor: Editor): MenuItem[] {
  const can = editor.can()
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => (): void => {
    fn(editor.chain().focus()).run()
  }
  return [
    { type: 'label', label: 'Таблица' },
    {
      label: 'Строка выше',
      icon: <ArrowUpToLine size={14} />,
      disabled: !can.addRowBefore(),
      onClick: run((c) => c.addRowBefore())
    },
    {
      label: 'Строка ниже',
      icon: <ArrowDownToLine size={14} />,
      disabled: !can.addRowAfter(),
      onClick: run((c) => c.addRowAfter())
    },
    { label: 'Удалить строку', disabled: !can.deleteRow(), onClick: run((c) => c.deleteRow()) },
    { type: 'sep' },
    {
      label: 'Столбец слева',
      icon: <ArrowLeftToLine size={14} />,
      disabled: !can.addColumnBefore(),
      onClick: run((c) => c.addColumnBefore())
    },
    {
      label: 'Столбец справа',
      icon: <ArrowRightToLine size={14} />,
      disabled: !can.addColumnAfter(),
      onClick: run((c) => c.addColumnAfter())
    },
    { label: 'Удалить столбец', disabled: !can.deleteColumn(), onClick: run((c) => c.deleteColumn()) },
    { type: 'sep' },
    {
      label: 'Объединить ячейки',
      icon: <Combine size={14} />,
      disabled: !can.mergeCells(),
      onClick: run((c) => c.mergeCells())
    },
    {
      label: 'Разделить ячейку',
      icon: <Split size={14} />,
      disabled: !can.splitCell(),
      onClick: run((c) => c.splitCell())
    },
    {
      label: 'Строка заголовков вкл/выкл',
      icon: <Heading1 size={14} />,
      disabled: !can.toggleHeaderRow(),
      onClick: run((c) => c.toggleHeaderRow())
    },
    { type: 'sep' },
    {
      label: 'Удалить таблицу',
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: run((c) => c.deleteTable())
    }
  ]
}
