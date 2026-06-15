import React from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Undo2,
  Redo2,
  Search,
  Highlighter,
  Baseline,
  RowsIcon,
  Columns3,
  Trash2,
  FileDown,
  FileUp
} from 'lucide-react'
import { promptText } from '../../shared/ui/dialogs'

interface ToolbarProps {
  editor: Editor
  onToggleFind: () => void
  onInsertImage: () => void
  onImportDocx: () => void
  onExportDocx: () => void
}

const FONTS = [
  { label: 'Без засечек', value: 'Manrope, sans-serif' },
  { label: 'С засечками', value: 'Lora, serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier', value: '"Courier New", monospace' }
]
const SIZES = ['12px', '14px', '16px', '18px', '21px', '24px', '30px', '36px']

function Btn({
  active,
  onClick,
  title,
  children,
  disabled
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      className={`tb-btn ${active ? 'tb-btn--active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

const Sep = (): React.JSX.Element => <span className="tb-sep" />

export function Toolbar({
  editor,
  onToggleFind,
  onInsertImage,
  onImportDocx,
  onExportDocx
}: ToolbarProps): React.JSX.Element {
  // перерисовка при изменении выделения/состояния
  const [, force] = React.useReducer((x) => x + 1, 0)
  React.useEffect(() => {
    const update = (): void => force()
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  const blockValue = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p'

  const curFont =
    (editor.getAttributes('textStyle').fontFamily as string) || FONTS[0].value
  const curSize = (editor.getAttributes('textStyle').fontSize as string) || '16px'

  const setBlock = (v: string): void => {
    if (v === 'p') editor.chain().focus().setParagraph().run()
    else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run()
  }

  const setLink = async (): Promise<void> => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = await promptText({ title: 'Ссылка', placeholder: 'https://…', initial: prev ?? '' })
    if (url === null) return
    if (url === '') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="toolbar">
      <Btn title="Отменить" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={17} />
      </Btn>
      <Btn title="Повторить" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={17} />
      </Btn>
      <Sep />

      <select
        className="tb-select"
        value={blockValue}
        onChange={(e) => setBlock(e.target.value)}
        title="Тип блока"
      >
        <option value="p">Обычный текст</option>
        <option value="h1">Заголовок 1</option>
        <option value="h2">Заголовок 2</option>
        <option value="h3">Заголовок 3</option>
      </select>

      <select
        className="tb-select"
        value={curFont}
        onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        title="Шрифт"
      >
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className="tb-select tb-select--sm"
        value={curSize}
        onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
        title="Размер шрифта"
      >
        {SIZES.map((s) => (
          <option key={s} value={s}>
            {parseInt(s, 10)}
          </option>
        ))}
      </select>
      <Sep />

      <Btn title="Жирный" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={17} />
      </Btn>
      <Btn title="Курсив" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={17} />
      </Btn>
      <Btn
        title="Подчёркнутый"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={17} />
      </Btn>
      <Btn
        title="Зачёркнутый"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={17} />
      </Btn>

      <label className="tb-btn" title="Цвет текста" onMouseDown={(e) => e.preventDefault()}>
        <Baseline size={17} />
        <input
          type="color"
          className="tb-color"
          value={(editor.getAttributes('textStyle').color as string) || '#000000'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      <label className="tb-btn" title="Маркер выделения" onMouseDown={(e) => e.preventDefault()}>
        <Highlighter size={17} />
        <input
          type="color"
          className="tb-color"
          defaultValue="#ffe066"
          onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        />
      </label>
      <Sep />

      {/* Выравнивание — п.2 */}
      <Btn
        title="По левому краю"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft size={17} />
      </Btn>
      <Btn
        title="По центру"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter size={17} />
      </Btn>
      <Btn
        title="По правому краю"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight size={17} />
      </Btn>
      <Btn
        title="По ширине"
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
      >
        <AlignJustify size={17} />
      </Btn>
      <Sep />

      <Btn title="Маркированный список" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={17} />
      </Btn>
      <Btn title="Нумерованный список" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={17} />
      </Btn>
      <Btn title="Цитата" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={17} />
      </Btn>
      <Btn title="Блок кода" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 size={17} />
      </Btn>
      <Btn title="Разделитель" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={17} />
      </Btn>
      <Sep />

      <Btn title="Ссылка" active={editor.isActive('link')} onClick={setLink}>
        <LinkIcon size={17} />
      </Btn>
      <Btn title="Вставить изображение" onClick={onInsertImage}>
        <ImageIcon size={17} />
      </Btn>

      {/* Таблицы — п.6 */}
      <Btn
        title="Вставить таблицу"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <TableIcon size={17} />
      </Btn>
      {editor.isActive('table') && (
        <>
          <Btn title="Добавить строку" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <RowsIcon size={17} />
          </Btn>
          <Btn title="Добавить столбец" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <Columns3 size={17} />
          </Btn>
          <Btn title="Удалить таблицу" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash2 size={17} />
          </Btn>
        </>
      )}
      <Sep />

      <Btn title="Найти и заменить" onClick={onToggleFind}>
        <Search size={17} />
      </Btn>
      <Btn title="Импорт из Word (.docx)" onClick={onImportDocx}>
        <FileUp size={17} />
      </Btn>
      <Btn title="Экспорт в Word (.docx)" onClick={onExportDocx}>
        <FileDown size={17} />
      </Btn>
    </div>
  )
}
