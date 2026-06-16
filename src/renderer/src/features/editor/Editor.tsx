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

  const [showFind, setShowFind] = React.useState(false)
  const [pageCount, setPageCount] = React.useState(1)
  const [wordCount, setWordCount] = React.useState(chapter?.wordCount ?? 0)
  const [saved, setSaved] = React.useState(true)

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

  if (!editor) return <div className="editor-loading">Загрузка редактора…</div>

  return (
    <div className="editor">
      <div className="editor-toolbar-wrap">
        <Toolbar
          editor={editor}
          onToggleFind={() => setShowFind((v) => !v)}
          onInsertImage={() => fileInputRef.current?.click()}
          onInsertInternalLink={insertInternalLink}
          onCreateSubpage={createSubpage}
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
    </div>
  )
}
