import React from 'react'
import { Plus, Sparkles, Trash2, Pencil, FolderOpen } from 'lucide-react'
import { useStore } from '../../store/store'
import { Button, Card, Hashtags } from '../../shared/ui/components'
import { promptText, confirmDialog } from '../../shared/ui/dialogs'
import { openContextMenu, type MenuItem } from '../../shared/ui/ContextMenu'
import { ThemeSwitcher } from '../../app/ThemeSwitcher'
import { CoverArt } from './CoverArt'
import type { ProjectSummary } from '@shared/types'

export function Home(): React.JSX.Element {
  const { projects, refreshProjects, openProject } = useStore()

  const createProject = async (): Promise<void> => {
    const title = await promptText({
      title: 'Новый проект',
      placeholder: 'Например: «Хроники Эфира»'
    })
    if (!title) return
    const p = await window.api.projects.create({ title })
    await refreshProjects()
    openProject(p.id)
  }

  const renameProject = async (p: ProjectSummary): Promise<void> => {
    const title = await promptText({ title: 'Переименовать проект', initial: p.title })
    if (!title || title === p.title) return
    await window.api.projects.update({ projectId: p.id, patch: { title } })
    refreshProjects()
  }

  const deleteProject = async (p: ProjectSummary): Promise<void> => {
    if (
      !(await confirmDialog({
        title: `Удалить проект «${p.title}»?`,
        message: 'Все истории, главы и персонажи проекта будут удалены безвозвратно.',
        danger: true,
        confirmLabel: 'Удалить'
      }))
    )
      return
    await window.api.projects.delete(p.id)
    refreshProjects()
  }

  const menu = (p: ProjectSummary): MenuItem[] => [
    { label: 'Открыть', icon: <FolderOpen size={15} />, onClick: () => openProject(p.id) },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameProject(p) },
    { type: 'sep' },
    { label: 'Удалить', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteProject(p) }
  ]

  return (
    <div className="home">
      <div className="home-inner">
        <div className="home-top">
          <div>
            <div className="home-title">
              <span className="brand-mark">
                <Sparkles size={18} />
              </span>
              FanCreator
            </div>
            <div className="home-sub">Ваша библиотека историй и миров</div>
          </div>
          <div className="row">
            <ThemeSwitcher />
            <Button variant="primary" onClick={createProject}>
              <Plus size={17} /> Новый проект
            </Button>
          </div>
        </div>

        {projects.length === 0 ? (
          <Card style={{ padding: 40, textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px' }}>Здесь пока пусто 📖</h2>
            <p className="dim" style={{ margin: '0 0 20px', lineHeight: 1.6 }}>
              Создайте свой первый проект — это может быть отдельная вселенная, сборник
              историй или один большой роман.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button variant="primary" onClick={createProject}>
                <Plus size={17} /> Создать проект
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="project-card"
                onClick={() => openProject(p.id)}
                onContextMenu={(e) => openContextMenu(e, menu(p))}
              >
                <CoverArt title={p.title} coverPath={p.coverPath} />
                <div>
                  <div className="book-title truncate">{p.title}</div>
                  <div className="book-meta">
                    {p.storyCount} историй · {p.chapterCount} глав
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Hashtags tags={p.tags} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
