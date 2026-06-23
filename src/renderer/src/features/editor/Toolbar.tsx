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
  Unlink,
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
  FileUp,
  FileSymlink,
  FilePlus2,
  Globe,
  ListTree,
  Paintbrush,
  IndentIncrease,
  SeparatorHorizontal
} from 'lucide-react'
import { promptText } from '../../shared/ui/dialogs'
import { ColorPalette } from '../../shared/ui/ColorPalette'

interface ToolbarProps {
  editor: Editor
  onToggleFind: () => void
  onInsertImage: () => void
  onInsertInternalLink: (e: React.MouseEvent) => void
  onCreateSubpage: () => void
  onInsertWikiLink: (e: React.MouseEvent) => void
  onToggleToc: () => void
  tocActive: boolean
  onImportDocx: () => void
  onExportDocx: () => void
  onFormatPainter: () => void
  painterActive: boolean
}

const FONTS = [
  { label: 'Без засечек', value: 'Manrope, sans-serif' },
  { label: 'С засечками', value: 'Lora, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' }
]

// первое семейство из стека ("Arial, sans-serif" → "arial"), без кавычек, в нижнем регистре
const primaryFamily = (v?: string | null): string =>
  (v || '')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
// Размеры в пунктах (pt) — как в Word, чтобы «11» означало 11pt, а не 11px.
const SIZES = [
  '8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt',
  '20pt', '24pt', '28pt', '36pt', '48pt', '72pt'
]

// нормализуем хранимый размер ('15px' из старых глав или '11pt') к опции в pt
const toPt = (size?: string | null): string | undefined => {
  if (!size) return undefined
  const n = parseFloat(size)
  if (Number.isNaN(n)) return undefined
  const pt = size.trim().endsWith('px') ? (n * 72) / 96 : n
  return `${Math.round(pt)}pt`
}
const LINE_HEIGHTS = ['1', '1.15', '1.4', '1.7', '2', '2.5']
function Btn({
  active,
  onClick,
  title,
  children,
  disabled
}: {
  active?: boolean
  onClick: (e: React.MouseEvent) => void
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
  onInsertInternalLink,
  onCreateSubpage,
  onInsertWikiLink,
  onToggleToc,
  tocActive,
  onImportDocx,
  onExportDocx,
  onFormatPainter,
  painterActive
}: ToolbarProps): React.JSX.Element {
  const redline =
    (((editor.getAttributes('paragraph').indent as number) ||
      (editor.getAttributes('heading').indent as number)) ?? 0) > 0
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

  // S-H7: шрифт берём и с марки, и с блока (после импорта Word он на абзаце),
  // и сопоставляем по первому семейству — иначе "Arial" не совпадал с "Arial, sans-serif"
  const rawFont =
    (editor.getAttributes('textStyle').fontFamily as string) ||
    (editor.getAttributes('paragraph').fontFamily as string) ||
    (editor.getAttributes('heading').fontFamily as string) ||
    (editor.getAttributes('listItem').fontFamily as string) ||
    null
  const matchedFont = FONTS.find((f) => primaryFamily(f.value) === primaryFamily(rawFont))
  const curFont = matchedFont ? matchedFont.value : rawFont || FONTS[0].value
  // если шрифта нет в списке (редкий шрифт из Word) — покажем его отдельной опцией
  const extraFont = !matchedFont && rawFont ? rawFont : null
  // Заголовки крупнее по CSS — показываем их реальный размер в pt (24/18/15pt = 32/24/20px)
  const HEADING_SIZE: Record<string, string> = { h1: '24pt', h2: '18pt', h3: '15pt' }
  const explicitSize = toPt(
    (editor.getAttributes('textStyle').fontSize as string) ||
      (editor.getAttributes('paragraph').fontSize as string) ||
      (editor.getAttributes('heading').fontSize as string) ||
      (editor.getAttributes('listItem').fontSize as string)
  )
  const curSize = explicitSize || (blockValue !== 'p' ? HEADING_SIZE[blockValue] : '12pt')
  const curLineHeight =
    (editor.getAttributes('paragraph').lineHeight as string) ||
    (editor.getAttributes('heading').lineHeight as string) ||
    '1.7'

  const setBlock = (v: string): void => {
    const isHeading = v !== 'p'
    let c = editor.chain().focus()
    c = isHeading ? c.toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }) : c.setParagraph()
    // S-H6: сбрасываем ручной размер блока, чтобы применился размер уровня
    // (иначе при смене Заголовок 1→2→3 размер не менялся).
    c = c.updateAttributes(isHeading ? 'heading' : 'paragraph', { fontSize: null })
    c.run()
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
        {extraFont && (
          <option value={extraFont}>{primaryFamily(extraFont).replace(/^\w/, (c) => c.toUpperCase())}</option>
        )}
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

      <select
        className="tb-select tb-select--sm"
        value={curLineHeight}
        title="Межстрочный интервал"
        onChange={(e) => editor.chain().focus().setLineHeight(e.target.value).run()}
      >
        {LINE_HEIGHTS.map((lh) => (
          <option key={lh} value={lh}>
            ⇕ {lh}
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

      <ColorPalette
        className="tb-color-palette"
        title="Цвет текста"
        value={(editor.getAttributes('textStyle').color as string) || '#1d1c1a'}
        trigger={<Baseline size={17} />}
        onChange={(color) => editor.chain().focus().setColor(color).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <ColorPalette
        className="tb-color-palette"
        title="Маркер выделения"
        value={(editor.getAttributes('highlight').color as string) || '#ffe066'}
        trigger={<Highlighter size={17} />}
        onChange={(color) => editor.chain().focus().setHighlight({ color }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
        clearLabel="Убрать маркер"
      />
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
      <Btn
        title="Красная строка (абзацный отступ)"
        active={redline}
        onClick={() => editor.chain().focus()[redline ? 'outdent' : 'indent']().run()}
      >
        <IndentIncrease size={17} />
      </Btn>
      <Btn title="Формат по образцу (как в Word)" active={painterActive} onClick={onFormatPainter}>
        <Paintbrush size={17} />
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
      <Btn title="Разрыв страницы" onClick={() => editor.chain().focus().setPageBreak().run()}>
        <SeparatorHorizontal size={17} />
      </Btn>
      <Sep />

      <Btn title="Ссылка" active={editor.isActive('link')} onClick={setLink}>
        <LinkIcon size={17} />
      </Btn>
      {(editor.isActive('link') ||
        editor.isActive('wikiLink') ||
        editor.isActive('internalLink')) && (
        <Btn
          title="Убрать ссылку (текст останется)"
          onClick={() => {
            if (editor.isActive('internalLink')) {
              const { from } = editor.state.selection
              const node = editor.state.doc.nodeAt(from)
              if (node)
                editor
                  .chain()
                  .focus()
                  .command(({ tr }) => {
                    tr.replaceWith(from, from + node.nodeSize, editor.schema.text(node.attrs.label || 'глава'))
                    return true
                  })
                  .run()
            } else if (editor.isActive('wikiLink')) {
              editor.chain().focus().extendMarkRange('wikiLink').unsetMark('wikiLink').run()
            } else {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
            }
          }}
        >
          <Unlink size={17} />
        </Btn>
      )}
      <Btn title="Вставить изображение" onClick={onInsertImage}>
        <ImageIcon size={17} />
      </Btn>
      <Btn title="Ссылка на главу (подстраница)" onClick={onInsertInternalLink}>
        <FileSymlink size={17} />
      </Btn>
      <Btn title="Создать подстраницу" onClick={onCreateSubpage}>
        <FilePlus2 size={17} />
      </Btn>
      <Btn title="Вики-ссылка на сущность (выделите текст)" onClick={onInsertWikiLink}>
        <Globe size={17} />
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

      <Btn title="Оглавление главы" active={tocActive} onClick={onToggleToc}>
        <ListTree size={17} />
      </Btn>
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
