'use client'

import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  AppShell, Button, TextInput, Stack, Group, Title, Card,
  Tabs, Badge, Text, ScrollArea, ActionIcon, Divider, Box
} from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconPlus, IconSearch, IconTrash, IconFileText,
  IconGripVertical, IconArrowRight, IconPencil
} from '@tabler/icons-react'

// DnD
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

/* ----- Helpers ----- */
function StatusBadge({ status }) {
  const map = {
    idea: { color: 'yellow', label: 'Идея' },
    draft: { color: 'indigo', label: 'Черновик' },
    editing: { color: 'cyan', label: 'Редактируется' },
    done: { color: 'teal', label: 'Готово' },
  }
  const v = map[status || 'draft']
  return <Badge color={v.color} variant="light">{v.label}</Badge>
}

function promptString({ title, placeholder = '', initial = '' }) {
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
            onChange={(e)=> (val = e.currentTarget.value)}
            onKeyDown={(e)=>{ if (e.key === 'Enter') { modals.close(id); resolve(val.trim()) } }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={()=>{ modals.close(id); resolve(null) }}>Отмена</Button>
            <Button onClick={()=>{ modals.close(id); resolve(val.trim()) }}>Ок</Button>
          </Group>
        </Stack>
      )
    })
  })
}

/* ----- Page ----- */
export default function HomePage() {
  const router = useRouter()
  const [projects, setProjects] = React.useState([])
  const [selectedProject, setSelectedProject] = React.useState(null)
  const [activeTab, setActiveTab] = React.useState('stories')
  const [search, setSearch] = React.useState('')
  const [searchResults, setSearchResults] = React.useState([])

  const refresh = async () => {
    const list = await window.api.invoke('projects:list')
    const sorted = list.sort((a, b) => b.updatedAt - a.updatedAt)
    setProjects(sorted)
    if (selectedProject) {
      const upd = sorted.find(p => p.id === selectedProject.id)
      setSelectedProject(upd || null)
    }
    return sorted
  }
  React.useEffect(() => { refresh() }, [])

  // Auto-select project when returning from editor via ?projectId=...
  React.useEffect(() => {
    const { projectId } = router.query
    if (!projectId || projects.length === 0) return
    setSelectedProject(prev => {
      if (prev?.id === projectId) return prev
      return projects.find(p => p.id === projectId) || prev
    })
  }, [router.query, projects])

  /* ----- CRUD: Project ----- */
  const createProject = async () => {
    const name = await promptString({ title: 'Новый проект', placeholder: 'Введите название проекта' })
    if (!name) return
    const p = await window.api.invoke('projects:create', { title: name })
    await refresh()
    setSelectedProject(p)
  }

  const renameProject = async (project) => {
    const name = await promptString({ title: 'Переименовать проект', initial: project.title })
    if (name === null || name === project.title || !name.trim()) return
    await window.api.invoke('projects:update', { projectId: project.id, patch: { title: name.trim() } })
    refresh()
  }

  const deleteProject = async (project) => {
    modals.openConfirmModal({
      title: 'Удалить проект?',
      children: <Text size="sm">Проект «{project.title}» и все его истории/главы/персонажи будут удалены.</Text>,
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await window.api.invoke('projects:delete', { projectId: project.id })
        setSelectedProject(null)
        refresh()
      },
    })
  }

  /* ----- Search ----- */
  const doSearch = async () => {
    const res = await window.api.invoke('search:query', { query: search })
    setSearchResults(res)
  }

  const openEditor = (pId, sId, cId) => {
    router.push(`/editor?projectId=${pId}&storyId=${sId}&chapterId=${cId}`)
  }

  /* ----- CRUD: Story ----- */
  const addStory = async (project) => {
    const name = await promptString({ title: 'Новая история', placeholder: 'Введите название истории' })
    if (!name) return
    await window.api.invoke('stories:add', { projectId: project.id, title: name })
    refresh()
  }

  const renameStory = async (project, story) => {
    const name = await promptString({ title: 'Переименовать историю', initial: story.title })
    if (name === null || name === story.title || !name.trim()) return
    await window.api.invoke('stories:update', {
      projectId: project.id,
      storyId: story.id,
      patch: { title: name.trim() }
    })
    refresh()
  }

  const deleteStory = async (project, story) => {
    modals.openConfirmModal({
      title: 'Удалить историю?',
      children: <Text size="sm">История «{story.title}» и все её главы будут удалены.</Text>,
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await window.api.invoke('stories:delete', { projectId: project.id, storyId: story.id })
        refresh()
      },
    })
  }

  /* ----- CRUD: Chapter ----- */
  const addChapter = async (project, story) => {
    const name = await promptString({ title: 'Новая глава', placeholder: 'Введите название главы' })
    if (!name) return
    await window.api.invoke('chapters:add', {
      projectId: project.id,
      storyId: story.id,
      title: name
    })
    refresh()
  }

  const renameChapter = async (project, story, chapter) => {
    const name = await promptString({ title: 'Переименовать главу', initial: chapter.title || 'Без названия' })
    if (name === null || name === chapter.title) return
    await window.api.invoke('chapters:update', {
      projectId: project.id,
      storyId: story.id,
      chapterId: chapter.id,
      patch: { title: name.trim() }
    })
    refresh()
  }

  const deleteChapter = async (project, story, chapter) => {
    modals.openConfirmModal({
      title: 'Удалить главу?',
      children: <Text size="sm">Глава «{chapter.title || ''}» будет удалена.</Text>,
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await window.api.invoke('chapters:delete', {
          projectId: project.id,
          storyId: story.id,
          chapterId: chapter.id,
        })
        refresh()
      },
    })
  }

  /* ----- Drag & Drop: chapters reorder ----- */
  const onDragEnd = async (result, story) => {
    const { destination, source } = result
    if (!destination) return
    if (destination.index === source.index) return
    const reordered = Array.from(story.chapters || [])
    const [moved] = reordered.splice(source.index, 1)
    reordered.splice(destination.index, 0, moved)
    // отрисуем локально
    setSelectedProject(prev => {
      if (!prev) return prev
      const stories = prev.stories.map(s => s.id === story.id ? { ...s, chapters: reordered } : s)
      return { ...prev, stories }
    })
    // сохраним на диск
    await window.api.invoke('chapters:reorder', {
      projectId: selectedProject.id,
      storyId: story.id,
      order: reordered.map(c => c.id)
    })
    refresh()
  }

  return (
    <>
      <Head>
        <title>Fanfic Studio</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <AppShell padding="md" navbar={{ width: 340, breakpoint: 'sm' }}>
        {/* NAVBAR */}
        <AppShell.Navbar p="md" width={{ base: 340 }}>
          <ScrollArea type="scroll">
            <Stack gap="sm">
              <Title order={3}>Проекты</Title>

              <Group wrap="nowrap">
                <Button leftSection={<IconPlus size={16} />} onClick={createProject}>
                  Создать проект
                </Button>
              </Group>

              <Group wrap="nowrap">
                <TextInput
                  placeholder="Поиск по всем проектам…"
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                  leftSection={<IconSearch size={16} />}
                  style={{ flex: 1 }}
                />
                <Button variant="light" onClick={doSearch}>Найти</Button>
              </Group>

              <Divider my="xs" label="Список проектов" />
              <Stack gap="xs">
                {projects.map(p => (
                  <Card
                    key={p.id}
                    withBorder
                    shadow="sm"
                    onClick={() => setSelectedProject(p)}
                    style={{ cursor: 'pointer' }}
                    radius="md"
                  >
                    <Group justify="space-between" align="center">
                      <div onDoubleClick={(e)=>{ e.stopPropagation(); renameProject(p) }}>
                        <Text fw={600}>{p.title}</Text>
                        <Text size="xs" c="dimmed">Обновлён: {new Date(p.updatedAt).toLocaleString()}</Text>
                      </div>
                      <Group gap={6}>
                        <ActionIcon variant="subtle" onClick={(e)=>{ e.stopPropagation(); renameProject(p) }}>
                          <IconPencil size={18}/>
                        </ActionIcon>
                        <ActionIcon
                          size="lg"
                          variant="subtle"
                          color="red"
                          onClick={(e) => { e.stopPropagation(); deleteProject(p) }}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>

              {searchResults.length > 0 && (
                <>
                  <Divider my="xs" label={`Результаты (${searchResults.length})`} />
                  <Stack gap={6}>
                    {searchResults.map((r, i) => (
                      <Box key={i} p="xs" style={{ border: '1px dashed var(--stroke)', borderRadius: 12 }}>
                        <Text size="xs" c="dimmed">{r.type}</Text>
                        <Text fw={600}>{r.title}</Text>
                        <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{r.snippet}</Text>
                      </Box>
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          </ScrollArea>
        </AppShell.Navbar>

        {/* MAIN */}
        <AppShell.Main>
          {!selectedProject ? (
            <Card withBorder radius="md" shadow="sm" p="xl">
              <Title order={2} mb="sm">Добро пожаловать 👋</Title>
              <Text c="dimmed">Создайте новый проект слева, выберите существующий или найдите нужный по ключевым словам.</Text>
            </Card>
          ) : (
            <>
              <Group align="center" justify="space-between" mb="sm">
                <Group>
                  <Title order={2} onDoubleClick={()=>renameProject(selectedProject)} style={{ cursor: 'text' }}>
                    {selectedProject.title}
                  </Title>
                  <ActionIcon variant="subtle" onClick={()=>renameProject(selectedProject)}>
                    <IconPencil size={18}/>
                  </ActionIcon>
                </Group>
                <Group>
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => deleteProject(selectedProject)}
                  >
                    Удалить проект
                  </Button>
                </Group>
              </Group>

              <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
                <Tabs.List>
                  <Tabs.Tab value="stories">Истории</Tabs.Tab>
                  <Tabs.Tab value="characters">Персонажи</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="stories" pt="md">
                  {/* Кнопка добавления истории */}
                  <Group mb="sm">
                    <Button leftSection={<IconPlus size={16}/>}
                      onClick={()=>addStory(selectedProject)}>
                      Добавить историю
                    </Button>
                  </Group>

                  <Stack gap="md">
                    {(selectedProject.stories || []).map(s => (
                      <Card key={s.id} withBorder shadow="sm" radius="md">
                        <Group justify="space-between" align="center" gap="md">
                          <Group onDoubleClick={()=>renameStory(selectedProject, s)} style={{ cursor:'text' }}>
                            <IconFileText size={18} />
                            <Text fw={600}>{s.title}</Text>
                          </Group>
                          <Group>
                            <ActionIcon variant="subtle" onClick={()=>renameStory(selectedProject, s)}>
                              <IconPencil size={16}/>
                            </ActionIcon>
                            <Button
                              size="xs"
                              variant="light"
                              leftSection={<IconPlus size={14} />}
                              onClick={() => addChapter(selectedProject, s)}
                            >
                              Добавить главу
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              variant="subtle"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => deleteStory(selectedProject, s)}
                            >
                              Удалить
                            </Button>
                          </Group>
                        </Group>

                        <Divider my="sm" />

                        {/* DnD список глав */}
                        <DragDropContext onDragEnd={(result)=>onDragEnd(result, s)}>
                          <Droppable droppableId={`story-${s.id}`}>
                            {(provided)=>(
                              <Stack gap={6} ref={provided.innerRef} {...provided.droppableProps}>
                                {(s.chapters || []).map((c, index) => (
                                  <Draggable key={c.id} draggableId={c.id} index={index}>
                                    {(drag)=>(
                                      <Group
                                        ref={drag.innerRef}
                                        {...drag.draggableProps}
                                        {...drag.dragHandleProps}
                                        justify="space-between"
                                        style={{
                                          border: '1px solid var(--stroke)',
                                          borderRadius: 10,
                                          padding: 8,
                                          background: 'var(--panel)',
                                        }}
                                      >
                                        <Group wrap="nowrap">
                                          <IconGripVertical size={16} />
                                          <Text onDoubleClick={()=>renameChapter(selectedProject, s, c)} style={{ cursor:'text' }}>
                                            {c.title || 'Без названия'}
                                          </Text>
                                          <StatusBadge status={c.status} />
                                          <ActionIcon variant="subtle" onClick={()=>renameChapter(selectedProject, s, c)}>
                                            <IconPencil size={16}/>
                                          </ActionIcon>
                                        </Group>
                                        <Group gap="xs">
                                          <Button
                                            variant="light"
                                            size="xs"
                                            rightSection={<IconArrowRight size={14} />}
                                            onClick={() => openEditor(selectedProject.id, s.id, c.id)}
                                          >
                                            Открыть редактор
                                          </Button>
                                          <ActionIcon
                                            color="red"
                                            variant="subtle"
                                            onClick={() => deleteChapter(selectedProject, s, c)}
                                          >
                                            <IconTrash size={16} />
                                          </ActionIcon>
                                        </Group>
                                      </Group>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </Stack>
                            )}
                          </Droppable>
                        </DragDropContext>
                      </Card>
                    ))}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="characters" pt="md">
                  <Stack>
                    <Group>
                      <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() =>
                          window.api.invoke('characters:add', {
                            projectId: selectedProject.id,
                            name: 'Новый персонаж',
                          }).then(refresh)
                        }
                      >
                        Добавить персонажа
                      </Button>
                    </Group>

                    {(selectedProject.characters || []).map(ch => (
                      <Card key={ch.id} withBorder shadow="sm" radius="md">
                        <Group justify="space-between">
                          <TextInput
                            label="Имя"
                            defaultValue={ch.name}
                            onBlur={(e) =>
                              window.api.invoke('characters:update', {
                                projectId: selectedProject.id,
                                characterId: ch.id,
                                patch: { name: e.currentTarget.value },
                              }).then(refresh)
                            }
                            style={{ flex: 1 }}
                          />
                          <TextInput
                            label="Роль / архетип"
                            defaultValue={ch.role}
                            onBlur={(e) =>
                              window.api.invoke('characters:update', {
                                projectId: selectedProject.id,
                                characterId: ch.id,
                                patch: { role: e.currentTarget.value },
                              }).then(refresh)
                            }
                            style={{ flex: 1 }}
                          />
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() =>
                              modals.openConfirmModal({
                                title: 'Удалить персонажа?',
                                children: <Text size="sm">Персонаж «{ch.name || ''}» будет удалён.</Text>,
                                labels: { confirm: 'Удалить', cancel: 'Отмена' },
                                confirmProps: { color: 'red' },
                                onConfirm: async () => {
                                  await window.api.invoke('characters:delete', {
                                    projectId: selectedProject.id,
                                    characterId: ch.id,
                                  })
                                  refresh()
                                },
                              })
                            }
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>

                        <TextInput
                          mt="sm"
                          label="Кратко"
                          defaultValue={ch.summary}
                          onBlur={(e) =>
                            window.api.invoke('characters:update', {
                              projectId: selectedProject.id,
                              characterId: ch.id,
                              patch: { summary: e.currentTarget.value },
                            }).then(refresh)
                          }
                        />
                        <TextInput
                          mt="sm"
                          label="Биография"
                          defaultValue={ch.bio}
                          onBlur={(e) =>
                            window.api.invoke('characters:update', {
                              projectId: selectedProject.id,
                              characterId: ch.id,
                              patch: { bio: e.currentTarget.value },
                            }).then(refresh)
                          }
                        />
                      </Card>
                    ))}
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </>
          )}
        </AppShell.Main>
      </AppShell>
    </>
  )
}
