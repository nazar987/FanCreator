'use client'

import React from 'react'
import { useRouter } from 'next/router'
import {
  AppShell,
  Group,
  Button,
  Select,
  Title,
  Text,
  ActionIcon,
  Tooltip,
  Divider,
  Stack,
  TextInput,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconArrowLeft,
  IconDownload,
  IconUpload,
  IconDeviceFloppy,
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrikethrough,
  IconH1,
  IconH2,
  IconList,
  IconListNumbers,
  IconListCheck,
  IconLink,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconTable,
  IconPhotoPlus,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconAlignJustified,
  IconTableMinus,
} from '@tabler/icons-react'

import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { CharacterCount } from '@tiptap/extension-character-count'
import { Highlight } from '@tiptap/extension-highlight'
import { Typography } from '@tiptap/extension-typography'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Image } from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import TextAlign from '@tiptap/extension-text-align'

function askString({ title, placeholder = '', initial = '' }) {
  return new Promise((resolve) => {
    let val = initial
    const id = modals.open({
      title,
      withCloseButton: false,
      children: (
        <Stack>
          <TextInput
            autoFocus
            placeholder={placeholder}
            defaultValue={initial}
            onChange={(e) => (val = e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                modals.close(id)
                resolve(val.trim())
              }
            }}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                modals.close(id)
                resolve(null)
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={() => {
                modals.close(id)
                resolve(val.trim())
              }}
            >
              Ок
            </Button>
          </Group>
        </Stack>
      ),
    })
  })
}

export default function EditorPage() {
  if (typeof window === 'undefined') return null

  const router = useRouter()
  const { projectId, storyId, chapterId, q } = router.query

  const [data, setData] = React.useState(null)
  const [title, setTitle] = React.useState('')
  const [status, setStatus] = React.useState('draft')
  const [saveState, setSaveState] = React.useState('idle')

  const [lineHeight, setLineHeight] = React.useState('1.5')
  const [firstIndent, setFirstIndent] = React.useState('1.25cm')
  const [pSpace, setPSpace] = React.useState('12px')

  // --- Пагинация ---
  const [pages, setPages] = React.useState([0])
  const [activePage, setActivePage] = React.useState(0)
  const [editorsMap, setEditorsMap] = React.useState(() => new Map())
  const [pending, setPending] = React.useState([]) // { page, json }

  const suspendAutosaveRef = React.useRef(false)
  const initialContentRef = React.useRef(null)
  const focusNextRef = React.useRef(null)

  const extensions = React.useMemo(
    () => [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Начните писать историю…' }),
      CharacterCount,
      Highlight,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    []
  )

  React.useEffect(() => {
    try {
      const lh = localStorage.getItem('editor:lh')
      const fi = localStorage.getItem('editor:firstIndent')
      const ps = localStorage.getItem('editor:pSpace')
      if (lh) setLineHeight(lh)
      if (fi) setFirstIndent(fi)
      if (ps) setPSpace(ps)
    } catch {}
  }, [])

  React.useEffect(() => {
    try {
      localStorage.setItem('editor:lh', lineHeight)
    } catch {}
  }, [lineHeight])
  React.useEffect(() => {
    try {
      localStorage.setItem('editor:firstIndent', firstIndent)
    } catch {}
  }, [firstIndent])
  React.useEffect(() => {
    try {
      localStorage.setItem('editor:pSpace', pSpace)
    } catch {}
  }, [pSpace])

  const setEditorForPage = React.useCallback((page, editor) => {
    setEditorsMap((prev) => {
      const next = new Map(prev)
      if (editor) next.set(page, editor)
      else next.delete(page)
      return next
    })

    // применяем отложенные вставки
    if (editor) {
      setPending((prev) => {
        const idx = prev.findIndex((x) => x.page === page)
        if (idx === -1) return prev
        const copy = [...prev]
        const [{ json }] = copy.splice(idx, 1)
        editor.chain().insertContentAt(1, json).run()
        return copy
      })

      // фокус на следующую страницу (после Ctrl+Enter)
      if (focusNextRef.current === page) {
        requestAnimationFrame(() => {
          editor.chain().focus().setTextSelection(1).run()
          focusNextRef.current = null
        })
      }

      // загрузка контента (только когда смонтирована 1-я страница)
      if (page === 0 && initialContentRef.current != null) {
        const html = initialContentRef.current
        initialContentRef.current = null
        suspendAutosaveRef.current = true
        setPages([0])
        setActivePage(0)
        // очищаем и вставляем
        editor.commands.setContent(html || '<p></p>')
        // автоматическая пагинация после setContent
        requestAnimationFrame(() => {
          repaginateFromPage0({
            page0Editor: editor,
            editorsMapGetter: () => editorsMap,
            setPages,
            setPending,
          })
          suspendAutosaveRef.current = false
        })
      }
    }
  }, [editorsMap])

  const refreshSelected = React.useCallback(async () => {
    if (!projectId) return
    const list = await window.api.invoke('projects:list')
    const p = list.find((x) => x.id === projectId)
    const s = p?.stories?.find((x) => x.id === storyId)
    const c = s?.chapters?.find((x) => x.id === chapterId)

    setData({ project: p, story: s, chapter: c })
    setTitle(c?.title || '')
    setStatus(c?.status || 'draft')

    // перезагрузка страниц: сбросим состояние и дождёмся mount первой страницы
    setPages([0])
    setActivePage(0)
    setEditorsMap(new Map())
    setPending([])
    initialContentRef.current = c?.content || '<p></p>'
  }, [projectId, storyId, chapterId])

  React.useEffect(() => {
    refreshSelected()
  }, [refreshSelected])

  // --- Autosave ---
  const timer = React.useRef(null)
  function scheduleAutoSave() {
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, 800)
  }

  function getEditorsInOrder() {
    return [...pages]
      .sort((a, b) => a - b)
      .map((p) => editorsMap.get(p))
      .filter(Boolean)
  }

  function getCombinedHTML() {
    return getEditorsInOrder()
      .map((ed) => ed.getHTML())
      .join('')
  }

  function getCombinedText() {
    return getEditorsInOrder()
      .map((ed) => ed.getText())
      .join('\n')
  }

  async function save() {
    if (!data?.chapter) return

    const html = getCombinedHTML()
    const plainText = getCombinedText()

    await window.api.invoke('chapters:update', {
      projectId: data.project.id,
      storyId: data.story.id,
      chapterId: data.chapter.id,
      patch: { title, status, content: html, plainText },
    })

    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 1200)
  }

  async function setLink() {
    const url = await askString({ title: 'Вставить ссылку', placeholder: 'https://…' })
    if (url === null) return
    const editor = editorsMap.get(activePage)
    if (!editor) return
    if (url === '') return editor.chain().focus().extendMarkRange('link').unsetLink().run()
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  async function insertImageUrl() {
    const url = await askString({ title: 'Вставить изображение', placeholder: 'URL изображения' })
    if (!url) return
    const editor = editorsMap.get(activePage)
    editor?.chain().focus().setImage({ src: url }).run()
  }

  // поиск по страницам (первое совпадение)
  React.useEffect(() => {
    if (!q) return
    const query = String(q).toLowerCase()
    if (!query) return

    // подождём, пока появятся редакторы
    const t = setTimeout(() => {
      for (const p of [...pages].sort((a, b) => a - b)) {
        const ed = editorsMap.get(p)
        if (!ed) continue
        const text = ed.getText().toLowerCase()
        const idx = text.indexOf(query)
        if (idx >= 0) {
          setActivePage(p)
          // tiptap positions are 1-based
          ed.commands.focus()
          ed.commands.setTextSelection({ from: idx + 1, to: idx + query.length + 1 })
          break
        }
      }
    }, 60)

    return () => clearTimeout(t)
  }, [q, pages, editorsMap])

  if (!data?.chapter) {
    return (
      <AppShell padding="md">
        <Text c="dimmed">Загрузка…</Text>
      </AppShell>
    )
  }

  const combinedText = getCombinedText()
  const words = combinedText.trim().split(/\s+/).filter(Boolean).length
  const chars = combinedText.length
  const pagesCount = pages.length

  const activeEditor = editorsMap.get(activePage) || null
  const cmd = (fn) => {
    if (!activeEditor) return
    fn(activeEditor)
  }

  const requestPageBreak = (pageIndex) => {
    const next = pageIndex + 1
    setPages((p) => (p.includes(next) ? p : [...p, next]))
    focusNextRef.current = next
    setActivePage(next)
  }

  const onOverflow = (pageIndex, json) => {
    overflowToNext({
      pageIndex,
      json,
      setPages,
      editorsMap,
      setPending,
    })
  }

  return (
    <AppShell padding="md" header={{ height: 84 }}>
      <AppShell.Header withBorder className="editor-header" style={{ padding: 12 }}>
        <Group justify="space-between" align="center">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.push(`/home?projectId=${projectId}`)}
            >
              Назад
            </Button>
            <Title order={4} style={{ marginLeft: 8 }}>
              {data.story.title} — {title || 'Без названия'}
            </Title>
          </Group>

          <Group gap="xs">
            <Select
              title="Межстрочный"
              data={[
                { value: '1', label: '1.0' },
                { value: '1.15', label: '1.15' },
                { value: '1.5', label: '1.5' },
                { value: '2', label: '2.0' },
              ]}
              value={lineHeight}
              onChange={setLineHeight}
              w={90}
            />
            <Select
              title="Красная строка"
              data={[
                { value: '0', label: '0' },
                { value: '1em', label: '1em' },
                { value: '1.25cm', label: '1.25 см' },
                { value: '2cm', label: '2 см' },
                { value: '48px', label: '48 px' },
              ]}
              value={firstIndent}
              onChange={setFirstIndent}
              w={110}
            />
            <Select
              title="Интервал абзацев"
              data={[
                { value: '0', label: '0' },
                { value: '8px', label: '8 px' },
                { value: '12px', label: '12 px' },
                { value: '16px', label: '16 px' },
                { value: '24px', label: '24 px' },
              ]}
              value={pSpace}
              onChange={setPSpace}
              w={135}
            />

            <Divider orientation="vertical" />
            <Select
              data={[
                { value: 'idea', label: 'Идея' },
                { value: 'draft', label: 'Черновик' },
                { value: 'editing', label: 'Редактируется' },
                { value: 'done', label: 'Готово' },
              ]}
              value={status}
              onChange={(v) => {
                setStatus(v)
                scheduleAutoSave()
              }}
              w={150}
            />
            <Button leftSection={<IconDeviceFloppy size={16} />} onClick={save}>
              Сохранить
            </Button>
            <Button
              variant="light"
              leftSection={<IconUpload size={16} />}
              onClick={async () => {
                await window.api.invoke('docx:import', {
                  projectId: data.project.id,
                  storyId: data.story.id,
                  chapterId: data.chapter.id,
                })
                refreshSelected()
              }}
            >
              Импорт DOCX
            </Button>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={async () => {
                const html = getCombinedHTML()
                await window.api.invoke('docx:export', { title, html })
              }}
            >
              Экспорт DOCX
            </Button>
            <Text size="sm" c="dimmed">
              {saveState === 'saving'
                ? 'Сохранение…'
                : saveState === 'saved'
                  ? 'Сохранено'
                  : 'Неизменено'}{' '}
              • {words} слов • {pagesCount} стр.
            </Text>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <div className="editor-toolbar-wrapper">
          <Group
            className="editor-toolbar"
            gap="xs"
            align="center"
            wrap="nowrap"
            style={{
              overflowX: 'auto',
              padding: '8px 16px',
              minWidth: 'min-content',
              background: 'inherit',
            }}
          >
            <Group gap={4} style={{ flexShrink: 0 }}>
              <Tooltip label="H1">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleHeading({ level: 1 }).run())}
                >
                  <IconH1 size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="H2">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleHeading({ level: 2 }).run())}
                >
                  <IconH2 size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider orientation="vertical" />

            <Group gap={4} style={{ flexShrink: 0 }}>
              <Tooltip label="Жирный">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleBold().run())}
                >
                  <IconBold size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Курсив">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleItalic().run())}
                >
                  <IconItalic size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Подчёркнутый">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleUnderline().run())}
                >
                  <IconUnderline size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Зачёркнутый">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleStrike().run())}
                >
                  <IconStrikethrough size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider orientation="vertical" />

            <Group gap={4} style={{ flexShrink: 0 }}>
              <Tooltip label="Слева">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().setTextAlign('left').run())}
                >
                  <IconAlignLeft size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="По центру">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().setTextAlign('center').run())}
                >
                  <IconAlignCenter size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Справа">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().setTextAlign('right').run())}
                >
                  <IconAlignRight size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="По ширине">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().setTextAlign('justify').run())}
                >
                  <IconAlignJustified size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider orientation="vertical" />

            <Group gap={4} style={{ flexShrink: 0 }}>
              <Tooltip label="Маркированный">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleBulletList().run())}
                >
                  <IconList size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Нумерованный">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleOrderedList().run())}
                >
                  <IconListNumbers size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Задачи">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().toggleTaskList().run())}
                >
                  <IconListCheck size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider orientation="vertical" />

            <Group gap={4} style={{ flexShrink: 0 }}>
              <Tooltip label="Ссылка">
                <ActionIcon variant="subtle" size="md" onClick={setLink}>
                  <IconLink size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Изображение">
                <ActionIcon variant="subtle" size="md" onClick={insertImageUrl}>
                  <IconPhotoPlus size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Таблица">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() =>
                    cmd((ed) => ed.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())
                  }
                >
                  <IconTable size={18} />
                </ActionIcon>
              </Tooltip>

              {activeEditor?.isActive('table') && (
                <Tooltip label="Удалить таблицу">
                  <Button
                    variant="light"
                    color="red"
                    size="xs"
                    leftSection={<IconTableMinus size={16} />}
                    onClick={() => cmd((ed) => ed.chain().focus().deleteTable().run())}
                  >
                    Удалить
                  </Button>
                </Tooltip>
              )}
            </Group>

            <Divider orientation="vertical" />

            <Group gap={4} style={{ flexShrink: 0 }}>
              <Tooltip label="Отменить">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().undo().run())}
                >
                  <IconArrowBackUp size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Повторить">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  onClick={() => cmd((ed) => ed.chain().focus().redo().run())}
                >
                  <IconArrowForwardUp size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Group ml="auto" gap="xs" style={{ flexShrink: 0 }}>
              <Text size="sm" c="dimmed">
                {saveState === 'saving' ? 'Сохранение…' : saveState === 'saved' ? 'Сохранено' : 'Изменено'}
                {' '}• {chars} символов
              </Text>
            </Group>
          </Group>
        </div>

        <div className="editor-paper paged" style={{ '--lh': lineHeight, '--first-indent': firstIndent, '--p-space': pSpace }}>
          <div className="pages-container">
            {pages
              .slice()
              .sort((a, b) => a - b)
              .map((pIndex) => (
                <PageEditor
                  key={pIndex}
                  pageIndex={pIndex}
                  extensions={extensions}
                  onActive={() => setActivePage(pIndex)}
                  onMount={(ed) => setEditorForPage(pIndex, ed)}
                  onUnmount={() => setEditorForPage(pIndex, null)}
                  onOverflow={(json) => onOverflow(pIndex, json)}
                  onPageBreak={() => requestPageBreak(pIndex)}
                  onUserEdit={() => {
                    if (!suspendAutosaveRef.current) scheduleAutoSave()
                  }}
                />
              ))}
          </div>
        </div>
      </AppShell.Main>
    </AppShell>
  )
}

function overflowToNext({ pageIndex, json, setPages, editorsMap, setPending }) {
  const next = pageIndex + 1
  const target = editorsMap.get(next)
  if (target) {
    target.chain().insertContentAt(1, json).run()
  } else {
    setPages((p) => (p.includes(next) ? p : [...p, next]))
    setPending((prev) => [...prev, { page: next, json }])
  }
}

function PageEditor({
  pageIndex,
  extensions,
  onActive,
  onMount,
  onUnmount,
  onOverflow,
  onPageBreak,
  onUserEdit,
}) {
  const editor = useEditor({
    extensions,
    content: '<p></p>',
    editable: true,
    autofocus: pageIndex === 0,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-content page-flow',
        tabindex: '0',
        spellcheck: 'true',
        'aria-label': `Редактор текста, страница ${pageIndex + 1}`,
      },
    },
    onUpdate: ({ editor }) => {
      onUserEdit?.()
      const overflowJSON = findOverflowJSON(editor)
      if (overflowJSON) onOverflow(overflowJSON)
    },
  })

  React.useEffect(() => {
    if (editor) onMount(editor)
    return () => onUnmount()
  }, [editor])

  const onMouseDown = () => {
    onActive()
  }

  const onKeyDown = (e) => {
    if (!editor) return
    // Shift+Enter — разрыв строки
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      editor.chain().focus().setHardBreak().run()
      return
    }
    // Ctrl/⌘+Enter — новая страница (как в Word)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onPageBreak()
      return
    }
  }

  return (
    <div className="page" onMouseDown={onMouseDown}>
      <div className="page-inner">
        <EditorContent editor={editor} onKeyDown={onKeyDown} />
      </div>
      <div className="page-number">{pageIndex + 1}</div>
    </div>
  )
}

// Точный поиск позиции переполнения и перенос хвоста на следующую страницу
function findOverflowJSON(editor) {
  const pageEl = editor.view.dom.closest('.page')
  if (!pageEl) return null

  const inner = pageEl.querySelector('.page-inner')
  if (!inner) return null

  const bottomLimit = inner.getBoundingClientRect().bottom - 6
  const prose = pageEl.querySelector('.ProseMirror')
  if (!prose) return null

  const last = prose.lastElementChild
  if (!last) return null
  if (last.getBoundingClientRect().bottom <= bottomLimit) return null

  const doc = editor.state.doc
  const max = doc.content.size
  let lo = 1
  let hi = max
  let best = -1
  const view = editor.view

  const safeBottom = (pos) => {
    try {
      return view.coordsAtPos(Math.min(Math.max(pos, 1), max)).bottom
    } catch {
      return 1e12
    }
  }

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const btm = safeBottom(mid)
    if (btm <= bottomLimit) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (best === -1 || best >= max - 1) return null

  const tail = doc.cut(best + 1).toJSON()
  editor.commands.deleteRange({ from: best + 1, to: max })
  return tail
}

// При загрузке главы: прогнать переполнения «паровозиком» из страницы 0,
// чтобы сразу получить корректное количество страниц.
function repaginateFromPage0({ page0Editor, editorsMapGetter, setPages, setPending }) {
  let guard = 0
  let currentEditor = page0Editor
  let pageIndex = 0

  while (guard++ < 100) {
    const overflow = findOverflowJSON(currentEditor)
    if (!overflow) break

    const next = pageIndex + 1
    const map = editorsMapGetter()
    const target = map.get(next)

    if (target) {
      target.chain().insertContentAt(1, overflow).run()
      currentEditor = target
      pageIndex = next
      continue
    }

    setPages((p) => (p.includes(next) ? p : [...p, next]))
    setPending((prev) => [...prev, { page: next, json: overflow }])
    break
  }
}
