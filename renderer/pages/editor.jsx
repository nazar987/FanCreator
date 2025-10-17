'use client'

import React from 'react'
import { useRouter } from 'next/router'
import {
  AppShell, Group, Button, Select, Title, Text, ActionIcon,
  Tooltip, Divider, Stack, TextInput, Switch
} from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconArrowLeft, IconDownload, IconUpload, IconDeviceFloppy,
  IconBold, IconItalic, IconUnderline, IconStrikethrough, IconH1, IconH2,
  IconList, IconListNumbers, IconListCheck, IconQuote, IconCode, IconLink,
  IconEraser, IconArrowBackUp, IconArrowForwardUp, IconTable, IconPhotoPlus,
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
            onKeyDown={(e) => { if (e.key === 'Enter') { modals.close(id); resolve(val.trim()) } }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { modals.close(id); resolve(null) }}>Отмена</Button>
            <Button onClick={() => { modals.close(id); resolve(val.trim()) }}>Ок</Button>
          </Group>
        </Stack>
      ),
    })
  })
}

export default function EditorPage(){
  // 👉 Грубая, но надёжная защита от SSR: на сервере ничего не рендерим
  if (typeof window === 'undefined') return null

  const router = useRouter()
  const { projectId, storyId, chapterId, q } = router.query

  const [data, setData] = React.useState(null)
  const [title, setTitle] = React.useState('')
  const [status, setStatus] = React.useState('draft')
  const [saveState, setSaveState] = React.useState('idle') // idle|saving|saved

  // Визуальные настройки – безопасные дефолты, чтение из localStorage после маунта
  const [paged, setPaged] = React.useState(false)
  const [lineHeight, setLineHeight] = React.useState('1.5')
  const [firstIndent, setFirstIndent] = React.useState('1.25cm')
  const [pSpace, setPSpace] = React.useState('12px')

  React.useEffect(() => {
    try {
      const p = localStorage.getItem('editor:paged')
      const lh = localStorage.getItem('editor:lh')
      const fi = localStorage.getItem('editor:firstIndent')
      const ps = localStorage.getItem('editor:pSpace')
      if (p !== null) setPaged(p === 'true')
      if (lh) setLineHeight(lh)
      if (fi) setFirstIndent(fi)
      if (ps) setPSpace(ps)
    } catch {}
  }, [])
  React.useEffect(() => { try { localStorage.setItem('editor:paged', String(paged)) } catch {} }, [paged])
  React.useEffect(() => { try { localStorage.setItem('editor:lh', lineHeight) } catch {} }, [lineHeight])
  React.useEffect(() => { try { localStorage.setItem('editor:firstIndent', firstIndent) } catch {} }, [firstIndent])
  React.useEffect(() => { try { localStorage.setItem('editor:pSpace', pSpace) } catch {} }, [pSpace])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Начните писать историю…' }),
      CharacterCount, Highlight, Typography,
      TaskList, TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
    ],
    content: '<p></p>',
    editable: true,
    editorProps: {
      attributes: {
        class: 'tiptap-content',
        tabindex: '0',
        spellcheck: 'true',
        'aria-label': 'Редактор текста',
        style: 'caret-color: currentColor;'
      }
    },
    onUpdate(){ scheduleAutoSave() },
    immediatelyRender: false,
  })

  const refreshSelected = React.useCallback(async ()=>{
    if(!projectId) return
    const list = await window.api.invoke('projects:list')
    const p = list.find(x=>x.id===projectId)
    const s = p?.stories?.find(x=>x.id===storyId)
    const c = s?.chapters?.find(x=>x.id===chapterId)
    setData({project:p, story:s, chapter:c})
    setTitle(c?.title || '')
    setStatus(c?.status || 'draft')
    if (editor) editor.commands.setContent(c?.content || '<p></p>')
  }, [projectId, storyId, chapterId, editor])

  React.useEffect(()=>{ refreshSelected() }, [refreshSelected])

  // Перемотка к первому совпадению поиска
  React.useEffect(()=>{
    if (!editor || !q) return
    const text = editor.getText().toLowerCase()
    const idx = text.indexOf(String(q).toLowerCase())
    if (idx >= 0) editor.commands.setTextSelection({ from: idx + 1, to: idx + String(q).length + 1 })
  }, [editor, q])

  const timer = React.useRef(null)
  function scheduleAutoSave(){
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, 800)
  }

  async function save(){
    if(!data?.chapter) return
    const html = editor?.getHTML?.() || ''
    const plainText = editor?.getText?.() || ''
    await window.api.invoke('chapters:update', {
      projectId: data.project.id,
      storyId: data.story.id,
      chapterId: data.chapter.id,
      patch: { title, status, content: html, plainText }
    })
    setSaveState('saved')
    setTimeout(()=>setSaveState('idle'), 1200)
  }

  async function setLink(){
    const url = await askString({ title: 'Вставить ссылку', placeholder: 'https://…' })
    if (url === null) return
    if (url === '') return editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  async function insertImage(){
    const url = await askString({ title: 'Вставить изображение', placeholder: 'URL изображения' })
    if(!url) return
    editor?.chain().focus().setImage({ src: url }).run()
  }

  if(!data?.chapter){
    return <AppShell padding="md"><Text c="dimmed">Загрузка…</Text></AppShell>
  }

  const words = (editor?.getText?.() || '').trim().split(/\s+/).filter(Boolean).length

  return (
    <AppShell padding="md" header={{ height: 84 }}>
      <AppShell.Header withBorder style={{ padding:12 }}>
        <Group justify="space-between" align="center">
          <Group>
            <Button variant="subtle" leftSection={<IconArrowLeft size={16}/>} onClick={()=>router.back()}>Назад</Button>
            <Title order={4} style={{ marginLeft:8 }}>
              {data.story.title} — {title || 'Без названия'}
            </Title>
          </Group>

          <Group gap="xs">
            <Select title="Межстрочный интервал"
              data={[{value:'1',label:'1.0'},{value:'1.15',label:'1.15'},{value:'1.5',label:'1.5'},{value:'2',label:'2.0'}]}
              value={lineHeight} onChange={setLineHeight} w={90} />
            <Select title="Красная строка"
              data={[{value:'0',label:'0'},{value:'1em',label:'1em'},{value:'1.25cm',label:'1.25 см'},{value:'2cm',label:'2 см'},{value:'48px',label:'48 px'}]}
              value={firstIndent} onChange={setFirstIndent} w={110} />
            <Select title="Интервал между абзацами"
              data={[{value:'0',label:'0'},{value:'8px',label:'8 px'},{value:'12px',label:'12 px'},{value:'16px',label:'16 px'},{value:'24px',label:'24 px'}]}
              value={pSpace} onChange={setPSpace} w={135} />
            <Group gap={6}>
              <Text size="sm">Постраничный</Text>
              <Switch checked={paged} onChange={(e)=>setPaged(e.currentTarget.checked)} />
            </Group>

            <Divider orientation="vertical" />
            <Select
              data={[{value:'idea',label:'Идея'},{value:'draft',label:'Черновик'},{value:'editing',label:'Редактируется'},{value:'done',label:'Готово'}]}
              value={status} onChange={(v)=>{ setStatus(v); scheduleAutoSave() }} w={150}
            />
            <Button leftSection={<IconDeviceFloppy size={16}/>} onClick={save}>Сохранить</Button>
            <Button variant="light" leftSection={<IconUpload size={16}/>}
              onClick={async ()=>{
                await window.api.invoke('docx:import',{ projectId: data.project.id, storyId: data.story.id, chapterId: data.chapter.id })
                refreshSelected()
              }}>
              Импорт DOCX
            </Button>
            <Button variant="light" leftSection={<IconDownload size={16}/>}
              onClick={async ()=>{
                const html = editor?.getHTML?.() || ''
                await window.api.invoke('docx:export', { title, html })
              }}>
              Экспорт DOCX
            </Button>
            <Text size="sm" c="dimmed">
              {saveState==='saving'?'Сохранение…':saveState==='saved'?'Сохранено':'Неизменено'} • {words} слов
            </Text>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {/* Toolbar */}
        <Group gap="xs" mb="xs" wrap="wrap">
          <Tooltip label="Заголовок 1"><ActionIcon onClick={()=>editor?.chain().focus().toggleHeading({level:1}).run()}><IconH1 size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Заголовок 2"><ActionIcon onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}><IconH2 size={16}/></ActionIcon></Tooltip>
          <Divider orientation="vertical"/>
          <Tooltip label="Полужирный"><ActionIcon onClick={()=>editor?.chain().focus().toggleBold().run()}><IconBold size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Курсив"><ActionIcon onClick={()=>editor?.chain().focus().toggleItalic().run()}><IconItalic size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Подчёркнутый"><ActionIcon onClick={()=>editor?.chain().focus().toggleUnderline().run()}><IconUnderline size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Зачёркнутый"><ActionIcon onClick={()=>editor?.chain().focus().toggleStrike().run()}><IconStrikethrough size={16}/></ActionIcon></Tooltip>
          <Divider orientation="vertical"/>
          <Tooltip label="Маркированный список"><ActionIcon onClick={()=>editor?.chain().focus().toggleBulletList().run()}><IconList size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Нумерованный список"><ActionIcon onClick={()=>editor?.chain().focus().toggleOrderedList().run()}><IconListNumbers size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Список задач"><ActionIcon onClick={()=>editor?.chain().focus().toggleTaskList().run()}><IconListCheck size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Цитата"><ActionIcon onClick={()=>editor?.chain().focus().toggleBlockquote().run()}><IconQuote size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Код"><ActionIcon onClick={()=>editor?.chain().focus().toggleCode().run()}><IconCode size={16}/></ActionIcon></Tooltip>
          <Divider orientation="vertical"/>
          <Tooltip label="Ссылка"><ActionIcon onClick={setLink}><IconLink size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Изображение (URL)"><ActionIcon onClick={insertImage}><IconPhotoPlus size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Таблица 3×3"><ActionIcon onClick={()=>editor?.chain().focus().insertTable({rows:3, cols:3, withHeaderRow:true}).run()}><IconTable size={16}/></ActionIcon></Tooltip>
          <Divider orientation="vertical"/>
          <Tooltip label="Отменить"><ActionIcon onClick={()=>editor?.chain().focus().undo().run()}><IconArrowBackUp size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Повторить"><ActionIcon onClick={()=>editor?.chain().focus().redo().run()}><IconArrowForwardUp size={16}/></ActionIcon></Tooltip>
          <Tooltip label="Снять форматирование"><ActionIcon onClick={()=>editor?.chain().focus().unsetAllMarks().clearNodes().run()}><IconEraser size={16}/></ActionIcon></Tooltip>
        </Group>

        <div
          className={`editor-paper ${paged ? 'paged' : ''}`}
          style={{ ['--lh']: lineHeight, ['--first-indent']: firstIndent, ['--p-space']: pSpace }}
        >
          {editor && <EditorContent editor={editor} />}
        </div>
      </AppShell.Main>
    </AppShell>
  )
}
