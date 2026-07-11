import React from 'react'
import {
  Plus,
  Sparkles,
  Trash2,
  Pencil,
  FolderOpen,
  CircleHelp,
  ArchiveRestore,
  PackageOpen
} from 'lucide-react'
import { useStore } from '../../store/store'
import { Button, Card, Hashtags } from '../../shared/ui/components'
import { promptText, confirmDialog, messageDialog } from '../../shared/ui/dialogs'
import { openContextMenu, type MenuItem } from '../../shared/ui/ContextMenu'
import { ThemeSwitcher } from '../../app/ThemeSwitcher'
import { CoverArt } from './CoverArt'
import { startHelpTour } from '../help/HelpTour'
import { openWhatsNew } from '../updates/WhatsNew'
import { plural } from '../../shared/plural'
import type { ProjectSummary } from '@shared/types'

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''

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

  const dropCover = async (p: ProjectSummary, dataUrl: string): Promise<void> => {
    await window.api.projects.setCover({
      projectId: p.id,
      source: dataUrl,
      isDataUrl: true
    })
    await refreshProjects()
  }

  const pickCover = async (p: ProjectSummary): Promise<void> => {
    await window.api.projects.pickCover({ projectId: p.id })
    await refreshProjects()
  }

  const exportBackup = async (p: ProjectSummary): Promise<void> => {
    const result = await window.api.projects.exportBackup({ projectId: p.id })
    if (result.status === 'success') {
      await messageDialog({
        title: 'Резервная копия создана',
        message: `Проект «${p.title}» сохранён вместе с изображениями.`
      })
    } else if (result.status === 'error') {
      await messageDialog({ title: 'Не удалось создать копию', message: result.message })
    }
  }

  const importBackup = async (): Promise<void> => {
    const result = await window.api.projects.importBackup()
    if (result.status === 'error') {
      await messageDialog({ title: 'Не удалось восстановить проект', message: result.message })
      return
    }
    if (result.status !== 'success' || !result.project) return
    await refreshProjects()
    openProject(result.project.id)
  }

  const menu = (p: ProjectSummary): MenuItem[] => [
    { label: 'Открыть', icon: <FolderOpen size={15} />, onClick: () => openProject(p.id) },
    { label: 'Переименовать', icon: <Pencil size={15} />, onClick: () => renameProject(p) },
    {
      label: 'Создать резервную копию',
      icon: <PackageOpen size={15} />,
      onClick: () => exportBackup(p)
    },
    { type: 'sep' },
    { label: 'Удалить', icon: <Trash2 size={15} />, danger: true, onClick: () => deleteProject(p) }
  ]

  return (
    <div className="home" data-tour="library">
      <div className="home-glow" aria-hidden />
      <div className="home-inner">
        <div className="home-top">
          <div>
            <div className="home-title">
              <span className="brand-mark">
                <Sparkles size={18} />
              </span>
              FanCreator
            </div>
            <div className="home-sub">
              Ваша библиотека историй и миров
              {APP_VERSION && (
                <button
                  className="home-version"
                  onClick={openWhatsNew}
                  title="Что нового в этой версии"
                >
                  v{APP_VERSION}
                </button>
              )}
            </div>
          </div>
          <div className="row">
            <ThemeSwitcher />
            <Button variant="soft" icon title="Помощь" onClick={startHelpTour}>
              <CircleHelp size={17} />
            </Button>
            <Button variant="soft" onClick={importBackup}>
              <ArchiveRestore size={17} /> Восстановить
            </Button>
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
                <CoverArt
                  title={p.title}
                  coverPath={p.coverPath}
                  onDropImage={(dataUrl) => dropCover(p, dataUrl)}
                  onPick={() => pickCover(p)}
                />
                <div>
                  <div className="book-title truncate">{p.title}</div>
                  <div className="book-meta">
                    {plural(p.storyCount, 'история', 'истории', 'историй')} ·{' '}
                    {plural(p.chapterCount, 'глава', 'главы', 'глав')}
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
