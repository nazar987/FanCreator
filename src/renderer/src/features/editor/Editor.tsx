import React from 'react'
import { useEditor, EditorContent, type Content } from '@tiptap/react'
import { useStore } from '../../store/store'
import { buildExtensions } from './extensions'
import { Toolbar } from './Toolbar'
import { FindReplace } from './FindReplace'
import { openContextMenu } from '../../shared/ui/ContextMenu'
import { promptText } from '../../shared/ui/dialogs'
import type { Chapter, Story } from '@shared/types'

interface EditorProps {
  storyId: string
  chapterId: string
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

export function Editor({ storyId, chapterId }: EditorProps): React.JSX.Element {
  const { current, reloadCurrent, openTab, applyProject } = useStore()
  const story = current?.stories.find((s) => s.id === storyId)
  const chapter = story?.chapters.find((c) => c.id === chapterId)

  // ссылки-подстраницы (п.14): открытие главы по id из контента редактора
  const currentRef = React.useRef(current)
  currentRef.current = current
  const openChapterById = React.useRef((id: string) => {
    const proj = currentRef.current
    for (const s of proj?.stories ?? []) {
      const c = s.chapters.find((c) => c.id === id)
      if (c) {
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
  const [pageCount, setPageCount] = React.useState(1)
  const [wordCount, setWordCount] = React.useState(chapter?.wordCount ?? 0)
  const [saved, setSaved] = React.useState(true)
  // S-G: всплывающая вики-карточка при наведении на ссылку
  const [wikiPreview, setWikiPreview] = React.useState<{
    kind: string
    refId: string
    x: number
    y: number
  } | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const reloadRef = React.useRef(reloadCurrent)
  reloadRef.current = reloadCurrent
  const projectId = current?.id ?? ''

  const persistImage = React.useCallback(
    async (dataUrl: string): Promise<string | null> => {
      if (!projectId) return null
      return window.api.assets.saveImage({ projectId, dataUrl })
    },
    [projectId]
  )

  const editor = useEditor({
    extensions: buildExtensions({ onOpenInternalLink: openChapterById }),
    content: initialContent(chapter),
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'fc-prose', spellcheck: 'true' },
      // S-G: наведение/клик по вики-ссылке (делегирование событий)
      handleDOMEvents: {
        mouseover: (_view, event) => {
          const el = (event.target as HTMLElement).closest('.fc-wikilink') as HTMLElement | null
          if (!el) return false
          const r = el.getBoundingClientRect()
          setWikiPreview({
            kind: el.dataset.kind ?? 'chapter',
            refId: el.dataset.refId ?? '',
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
          const el = (event.target as HTMLElement).closest('.fc-wikilink') as HTMLElement | null
          if (!el) return false
          event.preventDefault()
          openEntity(el.dataset.kind ?? 'chapter', el.dataset.refId ?? '')
          return true
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
    await window.api.chapters.update({
      projectId,
      storyId,
      chapterId,
      patch: {
        content: editor.getJSON(),
        plainText: editor.getText(),
        wordCount: editor.storage.characterCount.words()
      }
    })
    setSaved(true)
    reloadRef.current()
  }, [editor, projectId, storyId, chapterId])

  const schedulePageCount = React.useCallback(() => {
    setTimeout(() => {
      if (!editor) return
      const el = editor.view.dom.querySelector('[data-rm-pagination]')
      setPageCount(el ? Math.max(1, el.children.length) : 1)
    }, 60)
  }, [editor])

  // первичный расчёт числа страниц
  React.useEffect(() => {
    if (editor) schedulePageCount()
  }, [editor, schedulePageCount])

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
    await window.api.docx.importToChapter({ projectId, storyId, chapterId })
    const p = await reloadRef.current()
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
          onImportDocx={importDocx}
          onExportDocx={exportDocx}
        />
        {showFind && <FindReplace editor={editor} onClose={() => setShowFind(false)} />}
      </div>

      <div className="editor-scroll">
        <EditorContent editor={editor} />
      </div>

      <div className="editor-status">
        <span>{wordCount} слов</span>
        <span className="editor-status-sep">·</span>
        <span>{pageCount} стр.</span>
        <span className="spacer" />
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
