import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { ResizableImage } from './ResizableImage'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Typography from '@tiptap/extension-typography'
import { PaginationPlus } from 'tiptap-pagination-plus'
import type { Extensions } from '@tiptap/core'
import { FontSize } from './FontSize'
import { LineHeight } from './LineHeight'
import { ParagraphIndent } from './ParagraphIndent'
import { InternalLink } from './InternalLink'
import { WikiLink } from './WikiLink'

/** Размеры страницы A4 при 96 dpi. */
export const A4 = {
  width: 794,
  height: 1123,
  margin: 80,
  gap: 44
}

export function buildExtensions(opts: {
  onOpenInternalLink: (chapterId: string) => void
}): Extensions {
  return [
    InternalLink.configure({ onOpen: opts.onOpenInternalLink }),
    WikiLink,
    // StarterKit v3 уже включает Link и Underline — отдельно их не добавляем,
    // чтобы избежать дублирования марок.
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true }
    }),
    TextStyle,
    FontFamily.configure({ types: ['textStyle'] }),
    FontSize,
    LineHeight,
    ParagraphIndent,
    Color.configure({ types: ['textStyle'] }),
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
    ResizableImage.configure({ inline: false, allowBase64: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Typography,
    CharacterCount,
    Placeholder.configure({
      placeholder: 'Начните писать свою историю… (не нужно сначала создавать заголовок)'
    }),
    PaginationPlus.configure({
      pageHeight: A4.height,
      pageWidth: A4.width,
      pageGap: A4.gap,
      // непрозрачный зазор цвета «стола» + тонкая кромка листа → видимый разрыв страниц (как в Word)
      pageGapBorderSize: 1,
      pageGapBorderColor: 'var(--paper-edge)',
      pageBreakBackground: 'var(--editor-desk)',
      marginTop: A4.margin,
      marginBottom: A4.margin,
      marginLeft: A4.margin,
      marginRight: A4.margin,
      contentMarginTop: 0,
      contentMarginBottom: 0,
      footerLeft: '',
      footerRight: '{page}',
      headerLeft: '',
      headerRight: ''
    })
  ]
}
