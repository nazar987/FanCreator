import React from 'react'
import { useEditor, EditorContent, type Content } from '@tiptap/react'
import { useStore } from '../../store/store'
import { buildExtensions } from './extensions'
import { wikiLinkGuardKey } from './EditorExtras'
import { Toolbar } from './Toolbar'
import { FindReplace } from './FindReplace'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { promptText } from '../../shared/ui/dialogs'
import type { Chapter, Story } from '@shared/types'

interface EditorProps {
  storyId: string
  chapterId: string
}

/**
 * Заголовок главы («глава N», «пролог», «эпилог», «часть …») не должен приходить
 * пунктом нумерованного списка. Находим такие короткие пункты и выносим их из
 * списка обычным абзацем (номер не появляется). Список при этом корректно
 * разбивается: пункты до — остаются, после — образуют новый список.
 */
function isChapterHeadingText(text: string): boolean {
  const t = text.replace(/ /g, ' ').trim()
  if (!t) return false
  return /^(глава|пролог|эпилог|часть)\b/i.test(t) && t.split(/\s+/).length <= 4
}

function liftChapterListItems(doc: Document): void {
  for (let guard = 0; guard < 300; guard++) {
    const li = Array.from(doc.querySelectorAll('li')).find((el) =>
      isChapterHeadingText(el.textContent || '')
    )
    if (!li) return
    const list = li.parentElement
    if (!list || (list.tagName !== 'OL' && list.tagName !== 'UL')) {
      li.replaceWith(...Array.from(li.childNodes))
      continue
    }
    const para = doc.createElement('p')
    para.innerHTML = li.innerHTML
    const rest: Element[] = []
    let sib = li.nextElementSibling
    while (sib) {
      rest.push(sib)
      sib = sib.nextElementSibling
    }
    list.after(para)
    if (rest.length) {
      const tail = doc.createElement(list.tagName.toLowerCase())
      rest.forEach((el) => tail.appendChild(el))
      para.after(tail)
    }
    li.remove()
    if (!list.querySelector('li')) list.remove()
  }
}

/**
 * Сжимает картинку до разумного размера перед сохранением — чтобы гигантские
 * изображения не съедали память (вылет Oilpan OOM) и не раздували файлы.
 */
function downscaleDataUrl(dataUrl: string, maxDim = 1600): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const { width: w, height: h } = img
      if (!w || !h || (w <= maxDim && h <= maxDim)) return resolve(dataUrl)
      const scale = Math.min(maxDim / w, maxDim / h)
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0, cw, ch)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** Преобразует сохранённый контент главы в начальное содержимое редактора. */
function initialContent(chapter: Chapter | undefined): Content {
  if (!chapter?.content) return ''
  // docx-импорт сохраняется как { html }
  if (typeof chapter.content === 'object' && chapter.content !== null && 'html' in (chapter.content as object)) {
    return (chapter.content as { html: string }).html
  }
  return chapter.content as Content
}

/** Снимок оформления для «формата по образцу» (S-F5). */
// Пределы масштаба листа. Верх ограничен: на больших документах (30+ страниц)
// очень высокий зум растеризует огромную площадь и приложение зависает.
const MIN_ZOOM = 0.5
const MAX_ZOOM = 1.6

interface CapturedFormat {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  fontFamily: string | null
  fontSize: string | null
  color: string | null
  highlight: string | null
  textAlign: string | null
  lineHeight: string | null
  // тип блока-образца: обычный текст или заголовок уровня 1/2/3 (S-H1)
  block: { type: 'paragraph' } | { type: 'heading'; level: number }
  // жирность заголовка-образца (атрибут fontWeight: null = жирный, 'normal' = нет)
  headingWeight: string | null
}

export function Editor({ storyId, chapterId }: EditorProps): React.JSX.Element {
  const { current, patchChapter, openTab, applyProject } = useStore()
  const story = current?.stories.find((s) => s.id === storyId)
  const chapter = story?.chapters.find((c) => c.id === chapterId)

  // ссылки-подстраницы (п.14): открытие главы по id из контента редактора
  const currentRef = React.useRef(current)
  currentRef.current = current
  const openChapterById = React.useRef((id: string) => {
    const proj = currentRef.current
    for (const s of proj?.stories ?? []) {
      if (s.deletedAt) continue
      const c = s.chapters.find((c) => c.id === id)
      if (c) {
        // не открываем удалённую (в корзине) главу по ссылке
        if (c.deletedAt) return
        openTab({
          id: `chapter:${c.id}`,
          kind: 'chapter',
          title: c.title || 'Без названия',
          storyId: s.id,
          chapterId: c.id
        })
        return
      }
    }
  }).current

  // S-G: существует ли цель вики-ссылки сейчас (динамическое «гашение» битых
  // ссылок: удалили историю/персонажа/главу — связь гаснет, текст остаётся)
  const wikiTargetExists = React.useRef((kind: string, refId: string): boolean => {
    const proj = currentRef.current
    if (!proj || !refId) return false
    if (kind === 'character') return proj.characters.some((c) => c.id === refId)
    if (kind === 'timeline') return proj.timelines.some((t) => t.id === refId)
    if (kind === 'story') return proj.stories.some((s) => s.id === refId && !s.deletedAt)
    // chapter
    for (const s of proj.stories) {
      if (s.deletedAt) continue
      const c = s.chapters.find((x) => x.id === refId)
      if (c) return !c.deletedAt
    }
    return false
  }).current

  // S-G: открыть любую сущность проекта по вики-ссылке
  const openEntity = React.useRef((kind: string, refId: string) => {
    const proj = currentRef.current
    if (!proj) return
    if (kind === 'character') {
      openTab({ id: 'characters', kind: 'characters', title: 'Персонажи' })
    } else if (kind === 'timeline') {
      const t = proj.timelines.find((x) => x.id === refId)
      if (t) openTab({ id: `timeline:${t.id}`, kind: 'timeline', title: t.title, timelineId: t.id })
    } else if (kind === 'story') {
      const s = proj.stories.find((x) => x.id === refId)
      const c = s?.chapters[0]
      if (s && c)
        openTab({ id: `chapter:${c.id}`, kind: 'chapter', title: c.title, storyId: s.id, chapterId: c.id })
      else openTab({ id: 'shelf', kind: 'shelf', title: 'Библиотека' })
    } else {
      openChapterById(refId)
    }
  }).current

  const [showFind, setShowFind] = React.useState(false)
  const [ready, setReady] = React.useState(false) // S-H8: плавное появление без «прыжка» пагинации
  const [pageCount, setPageCount] = React.useState(1)
  const [currentPage, setCurrentPage] = React.useState(1) // S-G5: текущая страница
  const [showPageBadge, setShowPageBadge] = React.useState(false)
  const pageBadgeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [wordCount, setWordCount] = React.useState(chapter?.wordCount ?? 0)
  const [zoom, setZoom] = React.useState(1) // масштаб листа (S-7)
  // лист масштабируем через transform: scale (как доска) — вёрстка/пагинация
  // остаются 1×, поэтому при наборе нет лагов даже на большом масштабе.
  const zoomInnerRef = React.useRef<HTMLDivElement>(null)
  const [zoomLayerHeight, setZoomLayerHeight] = React.useState<number>()
  const zoomRef = React.useRef(zoom)
  zoomRef.current = zoom
  // высоту «стола» под масштабированным листом считаем ПО СОБЫТИЯМ (а не через
  // постоянный ResizeObserver) — иначе он зацикливался с пагинатором (тот менял
  // высоту листа → observer → реверстка → ...), и приложение зависало на зуме.
  const recomputeZoomHeight = React.useCallback(() => {
    const inner = zoomInnerRef.current
    if (!inner) return
    const h = inner.offsetHeight * zoomRef.current
    setZoomLayerHeight((prev) => (prev != null && Math.abs(prev - h) < 1 ? prev : h))
  }, [])
  const [saved, setSaved] = React.useState(true)
  // S-P: оглавление главы (заголовки H1–H3)
  const [tocOpen, setTocOpen] = React.useState(false)
  const [toc, setToc] = React.useState<{ level: number; text: string; pos: number }[]>([])
  // S-G: всплывающая вики-карточка при наведении на ссылку
  const [wikiPreview, setWikiPreview] = React.useState<{
    kind: string
    refId: string
    x: number
    y: number
  } | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // S-F2: контрольная точка прокрутки — открываем главу там, где остановились
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const scrollSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectId = current?.id ?? ''

  const persistImage = React.useCallback(
    async (dataUrl: string): Promise<string | null> => {
      if (!projectId) return null
      const scaled = await downscaleDataUrl(dataUrl)
      return window.api.assets.saveImage({ projectId, dataUrl: scaled })
    },
    [projectId]
  )

  const editor = useEditor({
    extensions: buildExtensions({ onOpenInternalLink: openChapterById, wikiTargetExists }),
    content: initialContent(chapter),
    // не фокусируемся в конец главы — иначе при открытии прокидывает в самый низ
    // и курсор встаёт на новую строку (фидбэк S-F2). Позицию восстанавливаем сами.
    autofocus: false,
    editorProps: {
      attributes: { class: 'fc-prose', spellcheck: 'true' },
      // S-L (п.2): чистим вставляемый HTML (Word/Google Docs) — убираем пустые абзацы,
      // из-за которых появлялись лишние пустые строки
      transformPastedHTML: (html) => {
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html')
          // Word держит базовый шрифт/размер в <style> как классы (MsoNormal) —
          // сначала переносим их в инлайновый style, иначе при удалении <style>
          // шрифт/размер теряются и текст берёт шрифт документа по умолчанию.
          const classFont = new Map<string, { ff?: string; fs?: string }>()
          doc.querySelectorAll('style').forEach((st) => {
            const css = st.textContent || ''
            const ruleRe = /([^{}]+)\{([^}]*)\}/g
            let m: RegExpExecArray | null
            while ((m = ruleRe.exec(css))) {
              const ff = /font-family\s*:\s*([^;]+)/i.exec(m[2])?.[1]?.trim()
              const fs = /font-size\s*:\s*([^;]+)/i.exec(m[2])?.[1]?.trim()
              if (!ff && !fs) continue
              m[1].split(',').forEach((sel) => {
                const cm = /\.([\w-]+)/.exec(sel)
                if (!cm) return
                const prev = classFont.get(cm[1]) || {}
                classFont.set(cm[1], { ff: ff || prev.ff, fs: fs || prev.fs })
              })
            }
          })
          if (classFont.size) {
            doc.querySelectorAll<HTMLElement>('[class]').forEach((el) => {
              el.classList.forEach((cls) => {
                const f = classFont.get(cls)
                if (!f) return
                if (f.ff && !el.style.fontFamily) el.style.fontFamily = f.ff
                if (f.fs && !el.style.fontSize) el.style.fontSize = f.fs
              })
            })
          }
          doc.querySelectorAll('o\\:p, style, meta, xml').forEach((n) => n.remove())
          // <font face/color> → span со шрифтом/цветом (сохраняем оформление)
          doc.querySelectorAll('font').forEach((f) => {
            const span = doc.createElement('span')
            const face = f.getAttribute('face')
            const color = f.getAttribute('color')
            if (face) span.style.fontFamily = face
            if (color) span.style.color = color
            span.innerHTML = f.innerHTML
            f.replaceWith(span)
          })
          // S-H: при вставке из Word/Docs СОХРАНЯЕМ шрифт/размер/интервал/цвет —
          // убираем только мусорные mso-* свойства (раньше резали всё и формат терялся).
          doc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
            const s = el.style
            for (let i = s.length - 1; i >= 0; i--) {
              const prop = s[i]
              if (prop.startsWith('mso-') || prop === 'font') s.removeProperty(prop)
            }
            if (!el.getAttribute('style')) el.removeAttribute('style')
          })
          doc.querySelectorAll('p').forEach((p) => {
            const text = (p.textContent || '').replace(/ /g, ' ').trim()
            if (!text && !p.querySelector('img')) p.remove()
          })
          // «глава N» (пролог/эпилог/часть) не должна приходить нумерованным пунктом —
          // выносим такую короткую строку из списка обычным абзацем (без номера)
          liftChapterListItems(doc)
          return doc.body.innerHTML
        } catch {
          return html
        }
      },
      // S-G: наведение/клик по вики-ссылке (делегирование событий)
      handleDOMEvents: {
        mouseover: (_view, event) => {
          const el = (event.target as HTMLElement).closest('.fc-wikilink') as HTMLElement | null
          if (!el) return false
          const kind = el.dataset.kind ?? 'chapter'
          const refId = el.dataset.refId ?? ''
          // битая ссылка (цель удалена) — карточку не показываем
          if (!wikiTargetExists(kind, refId)) return false
          const r = el.getBoundingClientRect()
          setWikiPreview({
            kind,
            refId,
            x: r.left,
            y: r.bottom + 6
          })
          return false
        },
        mouseout: (_view, event) => {
          if ((event.target as HTMLElement).closest('.fc-wikilink')) setWikiPreview(null)
          return false
        },
        click: (_view, event) => {
          const ctrl = event.ctrlKey || event.metaKey
          const target = event.target as HTMLElement
          // вики-ссылка: открываем источник ТОЛЬКО по Ctrl+клик (как в Word);
          // обычный клик ставит курсор (можно редактировать текст ссылки)
          const wiki = target.closest('.fc-wikilink') as HTMLElement | null
          if (wiki) {
            if (!ctrl) return false
            event.preventDefault()
            openEntity(wiki.dataset.kind ?? 'chapter', wiki.dataset.refId ?? '')
            return true
          }
          // обычная гиперссылка: по обычному клику НЕ переходим (и не уводим окно);
          // открываем во внешнем браузере только по Ctrl+клик
          const anchor = target.closest('a[href]') as HTMLAnchorElement | null
          if (anchor) {
            event.preventDefault()
            if (ctrl) {
              const href = anchor.getAttribute('href') ?? ''
              if (/^https?:\/\//i.test(href)) void window.api.shell.openExternal(href)
            }
            return false
          }
          return false
        }
      },
      // вставка картинки перетаскиванием (п.13) — без всплывающих окон
      handleDrop: (view, event, _slice, moved) => {
        const file = (event as DragEvent).dataTransfer?.files?.[0]
        if (moved || !file || !file.type.startsWith('image/')) return false
        event.preventDefault()
        const reader = new FileReader()
        reader.onload = async () => {
          const url = await persistImage(reader.result as string)
          if (!url) return
          const pos =
            view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY })
              ?.pos ?? view.state.selection.from
          const node = view.state.schema.nodes.image.create({ src: url })
          view.dispatch(view.state.tr.insert(pos, node))
        }
        reader.readAsDataURL(file)
        return true
      },
      handlePaste: (view, event) => {
        const file = event.clipboardData?.files?.[0]
        if (!file || !file.type.startsWith('image/')) return false
        event.preventDefault()
        const reader = new FileReader()
        reader.onload = async () => {
          const url = await persistImage(reader.result as string)
          if (!url) return
          const node = view.state.schema.nodes.image.create({ src: url })
          view.dispatch(view.state.tr.replaceSelectionWith(node))
        }
        reader.readAsDataURL(file)
        return true
      }
    },
    onUpdate: ({ editor }) => {
      setSaved(false)
      setWordCount(editor.storage.characterCount.words())
      schedulePageCount()
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => void save(), 700)
    }
  })

  const save = React.useCallback(async () => {
    if (!editor || !projectId) return
    const content = editor.getJSON()
    const plainText = editor.getText()
    const wordCount = editor.storage.characterCount.words()
    // локально синхронизируем главу в сторе — без round-trip за всем проектом
    // (важно для больших глав: не гоняем весь проект через IPC на каждое сохранение)
    patchChapter(storyId, chapterId, { content, plainText, wordCount })
    await window.api.chapters.update({
      projectId,
      storyId,
      chapterId,
      patch: { content, plainText, wordCount }
    })
    setSaved(true)
  }, [editor, projectId, storyId, chapterId, patchChapter])

  const schedulePageCount = React.useCallback(() => {
    setTimeout(() => {
      if (!editor) return
      // тем же способом, что и при скролле (с фильтром «нулевой» границы)
      const el = scrollRef.current
      setPageCount(el ? computePages().total : pageGaps().length + 1)
      // S-P: пересобираем оглавление из заголовков + (#6) определяем преобладающий
      // шрифт/размер абзацев и делаем его БАЗОВЫМ для редактора, чтобы пустые
      // строки и новый текст наследовали оформление вставленного текста.
      const items: { level: number; text: string; pos: number }[] = []
      const ffCount = new Map<string, number>()
      const fsCount = new Map<string, number>()
      const lhCount = new Map<string, number>()
      let scanned = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          items.push({ level: node.attrs.level as number, text: node.textContent, pos })
        }
        // межстрочный считаем по абзацам (это атрибут блока)
        if (node.type.name === 'paragraph' && node.attrs.lineHeight) {
          const lh = String(node.attrs.lineHeight)
          lhCount.set(lh, (lhCount.get(lh) ?? 0) + 1)
        }
        // считаем шрифт только в обычных абзацах (заголовки крупнее по дизайну)
        if (node.isText && scanned < 400 && node.marks.length) {
          const ts = node.marks.find((m) => m.type.name === 'textStyle')
          const ff = ts?.attrs.fontFamily as string | undefined
          const fs = ts?.attrs.fontSize as string | undefined
          if (ff) ffCount.set(ff, (ffCount.get(ff) ?? 0) + 1)
          if (fs) fsCount.set(fs, (fsCount.get(fs) ?? 0) + 1)
          scanned++
        }
        return true
      })
      setToc(items)
      const top = (m: Map<string, number>): string | undefined =>
        [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      // делаем преобладающий шрифт/размер/межстрочный БАЗОВЫМИ для листа, чтобы
      // новый текст (в т.ч. список под картинкой) наследовал их, а не дефолт.
      // Ставим ТОЛЬКО при реальном изменении — иначе лишняя реверстка дёргала прокрутку.
      const dom = editor.view.dom as HTMLElement
      const ff = top(ffCount) ?? ''
      const fs = top(fsCount) ?? ''
      const lh = top(lhCount) ?? ''
      if (dom.style.fontFamily !== ff) dom.style.fontFamily = ff
      if (dom.style.fontSize !== fs) dom.style.fontSize = fs
      if (dom.style.lineHeight !== lh) dom.style.lineHeight = lh
      recomputeZoomHeight() // высота «стола» могла измениться вместе с числом страниц
    }, 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const goToHeading = (pos: number): void => {
    if (!editor) return
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run()
  }

  // S-F5: «формат по образцу» (как в Word) — снять оформление и применить к другому выделению
  const painterRef = React.useRef<CapturedFormat | null>(null)
  const [painterActive, setPainterActive] = React.useState(false)

  const startFormatPainter = (): void => {
    if (!editor) return
    if (painterActive) {
      setPainterActive(false)
      return
    }
    const ts = editor.getAttributes('textStyle')
    const para = editor.getAttributes('paragraph')
    const head = editor.getAttributes('heading')
    const headingLevel = editor.isActive('heading') ? (head.level as number) : null
    painterRef.current = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      fontFamily: ts.fontFamily ?? null,
      fontSize: ts.fontSize ?? null,
      color: ts.color ?? null,
      highlight: (editor.getAttributes('highlight').color as string) ?? null,
      textAlign: para.textAlign ?? head.textAlign ?? null,
      lineHeight: para.lineHeight ?? head.lineHeight ?? null,
      block: headingLevel ? { type: 'heading', level: headingLevel } : { type: 'paragraph' },
      headingWeight: headingLevel ? ((head.fontWeight as string) ?? null) : null
    }
    setPainterActive(true)
  }

  React.useEffect(() => {
    if (!editor || !painterActive) return
    // Применяем по ОТПУСКАНИЮ мыши/клавиши — когда выделение уже целиком готово,
    // а не на первом selectionUpdate (тогда менялось лишь первое слово). (S-H1)
    const apply = (): void => {
      if (editor.state.selection.empty) return
      const f = painterRef.current
      if (!f) return
      let c = editor.chain().focus()
      // тип блока: заголовок применяем всегда; «обычный текст» — только если цель
      // сейчас заголовок (heading→p). Если образец обычный, а цель уже обычный
      // текст/ПУНКТ СПИСКА — тип не трогаем, иначе ФПО выкидывал пункт из списка и
      // сбивал нумерацию (фидбэк v2.0.8).
      if (f.block.type === 'heading') {
        c = c.setHeading({ level: f.block.level as 1 | 2 | 3 })
        // переносим жирность заголовка-образца (вкл/выкл «жирный» у заголовка)
        c = c.updateAttributes('heading', { fontWeight: f.headingWeight })
      } else if (editor.isActive('heading')) c = c.setParagraph()
      c = f.bold ? c.setBold() : c.unsetBold()
      c = f.italic ? c.setItalic() : c.unsetItalic()
      c = f.underline ? c.setUnderline() : c.unsetUnderline()
      c = f.strike ? c.setStrike() : c.unsetStrike()
      c = f.fontFamily ? c.setFontFamily(f.fontFamily) : c.unsetFontFamily()
      c = f.fontSize ? c.setFontSize(f.fontSize) : c.unsetFontSize()
      c = f.color ? c.setColor(f.color) : c.unsetColor()
      c = f.highlight ? c.setHighlight({ color: f.highlight }) : c.unsetHighlight()
      if (f.textAlign) c = c.setTextAlign(f.textAlign)
      if (f.lineHeight) c = c.setLineHeight(f.lineHeight)
      c.run()
      setPainterActive(false)
    }
    // небольшая задержка, чтобы ProseMirror успел зафиксировать финальное выделение
    const onMouseUp = (): void => {
      window.setTimeout(apply, 0)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setPainterActive(false)
        return
      }
      // выделение с клавиатуры (Shift+стрелки): применяем по отпусканию Shift
      if (e.key === 'Shift') window.setTimeout(apply, 0)
    }
    const dom = editor.view.dom
    dom.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keyup', onKey)
    return () => {
      dom.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keyup', onKey)
    }
  }, [editor, painterActive])

  // первичный расчёт числа страниц + оглавления
  React.useEffect(() => {
    if (editor) schedulePageCount()
  }, [editor, schedulePageCount])

  // S-G: при изменении проекта (удалили историю/персонажа/главу) форсируем
  // пересчёт «битых» вики-ссылок — документ при этом не меняется, поэтому шлём
  // мету плагину-гарду.
  React.useEffect(() => {
    if (!editor) return
    editor.view.dispatch(editor.state.tr.setMeta(wikiLinkGuardKey, true))
  }, [editor, current])

  // пересчёт высоты «стола» при смене зума/главы и после реверстки пагинации
  // (несколько отложенных попыток), без постоянного observer.
  React.useEffect(() => {
    recomputeZoomHeight()
    const timers = [60, 250, 600].map((d) => setTimeout(recomputeZoomHeight, d))
    return () => timers.forEach(clearTimeout)
  }, [zoom, editor, chapterId, recomputeZoomHeight])

  // S-H8: прячем лист, пока пагинация раскладывает страницы, и плавно показываем —
  // иначе при переключении вкладок текст заметно «прыгает» при реверстке.
  React.useEffect(() => {
    setReady(false)
    const t = setTimeout(() => setReady(true), 260)
    return () => clearTimeout(t)
  }, [editor, chapterId])

  // S-H4: фокусируем редактор при открытии главы, чтобы Ctrl+A работал сразу,
  // без предварительного клика по листу. preventScroll — чтобы не сбить позицию.
  React.useEffect(() => {
    if (!editor) return
    const t = setTimeout(() => {
      try {
        ;(editor.view.dom as HTMLElement).focus({ preventScroll: true })
      } catch {
        editor.view.focus()
      }
    }, 80)
    return () => clearTimeout(t)
  }, [editor, chapterId])

  // S-F2: восстановить прокрутку главы + запомнить «последнюю главу» истории.
  // Несколько попыток — пагинация доразмечает лист уже после монтирования.
  React.useEffect(() => {
    if (!editor) return
    try {
      localStorage.setItem(`fancreator.lastChapter.${storyId}`, chapterId)
    } catch {
      /* localStorage недоступен — не критично */
    }
    const saved = Number(localStorage.getItem(`fancreator.scroll.${chapterId}`) || 0)
    if (!saved) return
    const timers = [120, 320, 700].map((d) =>
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = saved
      }, d)
    )
    return () => timers.forEach(clearTimeout)
  }, [editor, storyId, chapterId])

  // S-F2: сохраняем позицию прокрутки (с дебаунсом)
  // Число и позицию страниц берём из границ страниц `.rm-pagination-gap`
  // (их же использует «разрыв страницы»). Контейнер `[data-rm-pagination]`
  // не годится: его дети — float-блоки, их геометрия не совпадает с визуальной
  // позицией страниц (отсюда были «59 / 59» и «4 / 2»).
  const pageGaps = (): HTMLElement[] => {
    const dom = editor?.view.dom
    return dom ? (Array.from(dom.querySelectorAll('.rm-pagination-gap')) as HTMLElement[]) : []
  }

  // Позиции границ страниц (низ каждой страницы) в координатах СОДЕРЖИМОГО,
  // инвариантно к scrollTop. Граница последней страницы скрыта через
  // `display:none` (rect = 0) — её исключаем по нулевой высоте, иначе она даёт
  // фиктивный сдвиг, растущий со scrollTop (отсюда были «+1» на странице).
  const gapOffsets = (el: HTMLDivElement): number[] => {
    const base = el.getBoundingClientRect().top - el.scrollTop
    return pageGaps()
      .filter((g) => g.getBoundingClientRect().height > 0)
      .map((g) => g.getBoundingClientRect().top - base)
      .sort((a, b) => a - b)
  }

  // total = число границ + 1; current = сколько границ (низов страниц) выше
  // верхней четверти вьюпорта + 1.
  const computePages = (): { total: number; current: number } => {
    const el = scrollRef.current
    if (!el) return { total: 1, current: 1 }
    const offsets = gapOffsets(el)
    const total = offsets.length + 1
    const marker = el.scrollTop + el.clientHeight * 0.25
    let current = 1
    offsets.forEach((y) => {
      if (y < marker) current += 1
    })
    return { total, current: Math.min(current, total) }
  }

  const goToPage = (n: number): void => {
    const el = scrollRef.current
    if (!el || !editor) return
    if (n <= 1) {
      el.scrollTop = 0
      return
    }
    const offsets = gapOffsets(el)
    const target = offsets[n - 2] // граница перед страницей n
    if (target == null) return
    el.scrollTop = Math.max(0, target - 16)
  }

  const jumpToPage = async (): Promise<void> => {
    const v = await promptText({
      title: 'Перейти к странице',
      placeholder: `1–${pageCount}`,
      initial: String(currentPage)
    })
    const n = Number(v)
    if (Number.isFinite(n) && n >= 1) goToPage(Math.min(Math.max(1, Math.round(n)), pageCount))
  }

  const handleScroll = React.useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    const { total, current } = computePages()
    setPageCount(total)
    setCurrentPage(current)
    setShowPageBadge(true)
    if (pageBadgeTimer.current) clearTimeout(pageBadgeTimer.current)
    pageBadgeTimer.current = setTimeout(() => setShowPageBadge(false), 900)
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current)
    scrollSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(`fancreator.scroll.${chapterId}`, String(Math.round(el.scrollTop)))
      } catch {
        /* ignore */
      }
    }, 250)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, editor])

  // сохранить при размонтировании (переключении вкладки)
  React.useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      void save()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // горячие клавиши: Ctrl+F — поиск, Ctrl+S — сохранить
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowFind(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  const onPickImageFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    const reader = new FileReader()
    reader.onload = async () => {
      const url = await persistImage(reader.result as string)
      if (url) editor.chain().focus().setImage({ src: url }).run()
    }
    reader.readAsDataURL(file)
  }

  const importDocx = async (): Promise<void> => {
    if (!projectId) return
    const p = await window.api.docx.importToChapter({ projectId, storyId, chapterId })
    applyProject(p)
    const ch = p?.stories.find((s) => s.id === storyId)?.chapters.find((c) => c.id === chapterId)
    if (editor && ch?.content && typeof ch.content === 'object' && 'html' in ch.content) {
      editor.commands.setContent((ch.content as { html: string }).html)
    }
  }

  const exportDocx = async (): Promise<void> => {
    if (!editor) return
    await window.api.docx.exportChapter({
      title: chapter?.title || 'Глава',
      html: editor.getHTML()
    })
  }

  // п.14 — вставить ссылку на существующую главу (меню) или создать подстраницу
  const insertInternalLink = (e: React.MouseEvent): void => {
    if (!editor || !current) return
    const items = current.stories.flatMap((s) =>
      s.chapters
        .filter((c) => c.id !== chapterId)
        .map((c) => ({
          label: `${s.title} — ${c.title || 'Без названия'}`,
          onClick: () =>
            editor
              .chain()
              .focus()
              .setInternalLink({ chapterId: c.id, label: c.title || 'Без названия' })
              .run()
        }))
    )
    if (!items.length) {
      openContextMenu(e, [{ type: 'label', label: 'Нет других глав для ссылки' }])
      return
    }
    openContextMenu(e, [{ type: 'label', label: 'Ссылка на главу' }, ...items])
  }

  const createSubpage = async (): Promise<void> => {
    if (!editor || !projectId) return
    const title = await promptText({ title: 'Новая подстраница', placeholder: 'Название' })
    if (!title) return
    const p = await window.api.chapters.add({ projectId, storyId, title })
    applyProject(p)
    const s = p?.stories.find((x) => x.id === storyId)
    const created = s?.chapters[s.chapters.length - 1]
    if (created) editor.chain().focus().setInternalLink({ chapterId: created.id, label: title }).run()
  }

  // S-G — превратить выделенный текст в вики-ссылку на сущность (фидбэк №5)
  const insertWikiLink = (e: React.MouseEvent): void => {
    if (!editor || !current) return
    const { empty } = editor.state.selection
    if (empty) {
      openContextMenu(e, [{ type: 'label', label: 'Сначала выделите текст для ссылки' }])
      return
    }
    const set = (kind: 'character' | 'story' | 'timeline' | 'chapter', refId: string): void => {
      editor.chain().focus().setWikiLink({ kind, refId }).run()
    }
    const items = [
      ...(current.characters.length
        ? ([{ type: 'label', label: 'Персонажи' }] as never[]).concat(
            current.characters.map((c) => ({ label: c.name, onClick: () => set('character', c.id) })) as never[]
          )
        : []),
      ...current.stories.flatMap((s) => [
        { label: `История: ${s.title}`, onClick: () => set('story', s.id) },
        ...s.chapters.map((c) => ({
          label: `   ${s.title} — ${c.title || 'Без названия'}`,
          onClick: () => set('chapter', c.id)
        }))
      ]),
      ...(current.timelines.length
        ? ([{ type: 'label', label: 'Таймлайны' }] as never[]).concat(
            current.timelines.map((t) => ({ label: t.title, onClick: () => set('timeline', t.id) })) as never[]
          )
        : [])
    ]
    openContextMenu(e, [{ type: 'label', label: 'Вики-ссылка на…' }, ...items])
  }

  // S-H5: после выделения мышью «голова» могла улететь в начало документа, если
  // курсор зашёл в межстраничный зазор (там координата промахивается мимо текста
  // и резолвится к позиции 0 — виджет пагинации заякорен там). CSS pointer-events
  // не спасает: posAtCoords всё равно даёт 0. Поэтому на mouseUp, если голова
  // выделения оказалась НАМНОГО выше точки отпускания (промах в зазор),
  // пересчитываем её по ближайшей реальной строке у указателя.
  const onEditorMouseUp = (e: React.MouseEvent): void => {
    if (!editor) return
    const sel = editor.state.selection
    if (sel.empty) return
    try {
      const headCoords = editor.view.coordsAtPos(sel.head)
      // голова не сильно выше курсора → нормальное выделение, не трогаем
      if (e.clientY - headCoords.top < 80) return
      let fixed: number | null = null
      for (let dy = 0; dy <= 160 && fixed === null; dy += 8) {
        const probe = editor.view.posAtCoords({ left: e.clientX, top: e.clientY + dy })
        if (!probe) continue
        const c = editor.view.coordsAtPos(probe.pos)
        if (Math.abs(c.top - (e.clientY + dy)) < 28) fixed = probe.pos
      }
      if (fixed === null) return
      const from = Math.min(sel.anchor, fixed)
      const to = Math.max(sel.anchor, fixed)
      if (from === sel.from && to === sel.to) return
      editor.chain().setTextSelection({ from, to }).run()
    } catch {
      /* координаты недоступны — пропускаем */
    }
  }

  // S-H9: правый клик по ссылке — «Открыть» / «Убрать ссылку (оставить текст)»
  const onEditorContextMenu = (e: React.MouseEvent): void => {
    if (!editor) return

    // Ссылка на главу (📄) — атом с contentEditable=false, posAtCoords на него не
    // попадает, поэтому ищем по самому DOM-элементу под курсором.
    const internalEl = (e.target as HTMLElement).closest?.('.fc-internal-link') as HTMLElement | null
    if (internalEl) {
      e.preventDefault()
      const approx = editor.view.posAtDOM(internalEl, 0)
      let nodePos = -1
      let nodeSize = 0
      let label = 'глава'
      let attrs: Record<string, unknown> = {}
      editor.state.doc.nodesBetween(Math.max(0, approx - 2), approx + 2, (n, p) => {
        if (n.type.name === 'internalLink') {
          nodePos = p
          nodeSize = n.nodeSize
          label = (n.attrs.label as string) || 'глава'
          attrs = n.attrs
          return false
        }
        return true
      })
      const chapterId = internalEl.getAttribute('data-chapter-id') || ''
      const isPlain = !!attrs.plain
      openContextMenu(e, [
        { label: 'Открыть главу', onClick: () => chapterId && openChapterById(chapterId) },
        {
          label: isPlain ? 'Вернуть вид ссылки' : 'Сделать как обычный текст',
          onClick: () => {
            if (nodePos < 0) return
            editor.chain().focus().command(({ tr }) => {
              tr.setNodeMarkup(nodePos, undefined, { ...attrs, plain: !isPlain })
              return true
            }).run()
          }
        },
        {
          label: 'Убрать ссылку (оставить текст)',
          onClick: () => {
            if (nodePos < 0) return
            editor
              .chain()
              .focus()
              .command(({ tr }) => {
                tr.replaceWith(nodePos, nodePos + nodeSize, editor.schema.text(label))
                return true
              })
              .run()
          }
        }
      ])
      return
    }

    const found = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (!found) return
    const pos = found.pos
    const { doc, schema } = editor.state

    // ссылки-марки: вики-ссылка (на сущность) и обычная гиперссылка
    const linkType = schema.marks.link
    const wikiType = schema.marks.wikiLink
    const $pos = doc.resolve(pos)
    const marksHere = [...($pos.nodeAfter?.marks ?? []), ...($pos.nodeBefore?.marks ?? [])]
    const wikiMark = wikiType && marksHere.find((m) => m.type === wikiType)
    const linkMark = linkType && marksHere.find((m) => m.type === linkType)

    if (wikiMark) {
      e.preventDefault()
      const wikiPlain = !!wikiMark.attrs.plain
      openContextMenu(e, [
        { label: 'Открыть', onClick: () => openEntity(wikiMark.attrs.kind, wikiMark.attrs.refId) },
        {
          label: wikiPlain ? 'Вернуть вид ссылки' : 'Сделать как обычный текст',
          onClick: () =>
            editor
              .chain()
              .focus()
              .setTextSelection(pos)
              .extendMarkRange('wikiLink')
              .updateAttributes('wikiLink', { plain: !wikiPlain })
              .run()
        },
        {
          label: 'Убрать ссылку (оставить текст)',
          onClick: () =>
            editor.chain().focus().setTextSelection(pos).extendMarkRange('wikiLink').unsetMark('wikiLink').run()
        }
      ])
      return
    }
    if (linkMark) {
      e.preventDefault()
      const href = (linkMark.attrs.href as string) || ''
      const isPlain = !!linkMark.attrs.plain
      openContextMenu(e, [
        ...(href
          ? [{ label: 'Открыть ссылку', onClick: () => void window.api.shell.openExternal(href) }]
          : []),
        {
          label: isPlain ? 'Вернуть вид ссылки' : 'Сделать как обычный текст',
          onClick: () =>
            editor
              .chain()
              .focus()
              .setTextSelection(pos)
              .extendMarkRange('link')
              .updateAttributes('link', { plain: !isPlain })
              .run()
        },
        {
          label: 'Убрать ссылку (оставить текст)',
          onClick: () => editor.chain().focus().setTextSelection(pos).extendMarkRange('link').unsetLink().run()
        }
      ])
      return
    }

    // нумерованный список — «начать нумерацию с числа N» (восстановить/продолжить)
    const $p = doc.resolve(pos)
    let olPos = -1
    let olAttrs: Record<string, unknown> | null = null
    for (let d = $p.depth; d > 0; d--) {
      if ($p.node(d).type.name === 'orderedList') {
        olAttrs = $p.node(d).attrs
        olPos = $p.before(d)
        break
      }
    }
    if (olAttrs) {
      e.preventDefault()
      const attrs = olAttrs
      const setOl = (patch: Record<string, unknown>): void => {
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setNodeMarkup(olPos, undefined, { ...attrs, ...patch })
            return true
          })
          .run()
      }
      const cur = (attrs.listStartManual as number) || 1
      openContextMenu(e, [
        {
          // сквозная связь: список продолжает нумерацию предыдущего и пересчитывается сам
          label: attrs.listContinue ? '✓ Продолжать предыдущий список' : 'Продолжить нумерацию предыдущего',
          onClick: () => setOl({ listContinue: !attrs.listContinue })
        },
        {
          label: 'Начать заново с числа…',
          onClick: async () => {
            const v = await promptText({ title: 'Начать нумерацию с числа', initial: String(cur) })
            const n = Number(v)
            if (!Number.isFinite(n) || n < 1) return
            setOl({ listContinue: false, listStartManual: n > 1 ? n : null })
          }
        }
      ])
    }
  }

  const renderWikiPreview = (kind: string, refId: string): React.JSX.Element | null => {
    if (!current) return null
    if (kind === 'character') {
      const c = current.characters.find((x) => x.id === refId)
      if (!c) return null
      return (
        <>
          <div className="fc-wiki-kind">Персонаж</div>
          <div className="fc-wiki-title">{c.name}</div>
          {c.role && <div className="fc-wiki-sub">{c.role}</div>}
          {c.fields[0]?.value && <div className="fc-wiki-note">{c.fields[0].value}</div>}
        </>
      )
    }
    if (kind === 'timeline') {
      const t = current.timelines.find((x) => x.id === refId)
      if (!t) return null
      return (
        <>
          <div className="fc-wiki-kind">Таймлайн</div>
          <div className="fc-wiki-title">{t.title}</div>
          <div className="fc-wiki-sub">{t.events.length} событий</div>
        </>
      )
    }
    if (kind === 'story') {
      const s = current.stories.find((x) => x.id === refId)
      if (!s) return null
      return (
        <>
          <div className="fc-wiki-kind">История</div>
          <div className="fc-wiki-title">{s.title}</div>
          <div className="fc-wiki-sub">{s.chapters.length} глав</div>
          {s.synopsis && <div className="fc-wiki-note">{s.synopsis}</div>}
        </>
      )
    }
    for (const s of current.stories) {
      const c = s.chapters.find((x) => x.id === refId)
      if (c)
        return (
          <>
            <div className="fc-wiki-kind">Глава</div>
            <div className="fc-wiki-title">{c.title || 'Без названия'}</div>
            <div className="fc-wiki-sub">{s.title}</div>
            {c.plainText && <div className="fc-wiki-note">{c.plainText.slice(0, 200)}</div>}
          </>
        )
    }
    return null
  }

  if (!editor) return <div className="editor-loading">Загрузка редактора…</div>

  return (
    <div className="editor">
      <div className="editor-toolbar-wrap" data-tour="editor-toolbar">
        <Toolbar
          editor={editor}
          onToggleFind={() => setShowFind((v) => !v)}
          onInsertImage={() => fileInputRef.current?.click()}
          onInsertInternalLink={insertInternalLink}
          onCreateSubpage={createSubpage}
          onInsertWikiLink={insertWikiLink}
          onToggleToc={() => setTocOpen((v) => !v)}
          tocActive={tocOpen}
          onImportDocx={importDocx}
          onExportDocx={exportDocx}
          onFormatPainter={startFormatPainter}
          painterActive={painterActive}
        />
        {showFind && <FindReplace editor={editor} onClose={() => setShowFind(false)} />}
      </div>

      <div className="editor-body">
        {tocOpen && (
          <aside className="editor-toc">
            <div className="editor-toc-head">Оглавление</div>
            {toc.length === 0 ? (
              <div className="dim editor-toc-empty">
                Заголовков пока нет. Добавьте заголовок (H1–H3) в тексте.
              </div>
            ) : (
              toc.map((h, i) => (
                <button
                  key={i}
                  className="editor-toc-item"
                  style={{ paddingLeft: 10 + (h.level - 1) * 14 }}
                  onClick={() => goToHeading(h.pos)}
                >
                  {h.text || 'Без названия'}
                </button>
              ))
            )}
          </aside>
        )}
        <div
          ref={scrollRef}
          className={`editor-scroll${ready ? '' : ' editor-scroll--loading'}`}
          style={{ ['--page-zoom' as string]: zoom }}
          onScroll={handleScroll}
          onMouseUp={onEditorMouseUp}
          onContextMenu={onEditorContextMenu}
          onMouseDown={(e) => {
            // Клик по «столу»/обёртке вне самого текста не должен снимать фокус с
            // редактора — иначе Ctrl+A уходил в нативное выделение всего интерфейса,
            // а Delete не работал. Срабатывает для editor-scroll и зум-обёрток.
            if (!(e.target as HTMLElement).closest('.ProseMirror')) {
              e.preventDefault()
              editor.view.focus()
            }
          }}
          onWheel={(e) => {
            if (!e.ctrlKey) return
            e.preventDefault()
            setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))))
          }}
        >
          <div
            className="editor-zoom-outer"
            style={zoomLayerHeight ? { height: `${zoomLayerHeight}px` } : undefined}
          >
            <div
              ref={zoomInnerRef}
              className="editor-zoom-inner"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
          {showPageBadge && <div className="editor-page-badge">Стр. {currentPage} / {pageCount}</div>}
        </div>
      </div>

      <div className="editor-status">
        <span>{wordCount} слов</span>
        <span className="editor-status-sep">·</span>
        <button className="editor-page-jump" title="Перейти к странице" onClick={jumpToPage}>
          Стр. {currentPage} / {pageCount}
        </button>
        <span className="spacer" />
        <span className="editor-zoom">
          <button title="Уменьшить" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}>
            −
          </button>
          <button title="Сбросить масштаб" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button title="Увеличить" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}>
            +
          </button>
        </span>
        <span className="editor-status-sep">·</span>
        <span className="faint">{saved ? 'Сохранено' : 'Сохранение…'}</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onPickImageFile}
      />

      {wikiPreview && (
        <div className="fc-wiki-preview" style={{ left: wikiPreview.x, top: wikiPreview.y }}>
          {renderWikiPreview(wikiPreview.kind, wikiPreview.refId)}
        </div>
      )}
    </div>
  )
}
