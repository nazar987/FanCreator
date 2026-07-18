import React from 'react'
import { BookOpen, RotateCcw, Trash2 } from 'lucide-react'
import type { ProjectSummary } from '@shared/types'
import { Button } from '../../shared/ui/components'
import { confirmDialog } from '../../shared/ui/dialogs'
import { plural } from '../../shared/plural'

interface ProjectTrashProps {
  projects: ProjectSummary[]
  onChanged: () => Promise<void>
  onClose: () => void
}

function deletedDate(timestamp?: number | null): string {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(timestamp)
}

export function ProjectTrash({
  projects,
  onChanged,
  onClose
}: ProjectTrashProps): React.JSX.Element {
  const restore = async (project: ProjectSummary): Promise<void> => {
    await window.api.projects.restore(project.id)
    await onChanged()
  }

  const purge = async (project: ProjectSummary): Promise<void> => {
    const confirmed = await confirmDialog({
      title: `Удалить проект «${project.title}» навсегда?`,
      message:
        'Все истории, главы, персонажи и изображения проекта будут удалены. Это действие нельзя отменить.',
      confirmLabel: 'Удалить навсегда',
      danger: true
    })
    if (!confirmed) return
    await window.api.projects.purge(project.id)
    await onChanged()
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal trash-modal" onMouseDown={(event) => event.stopPropagation()}>
        <h3>Корзина проектов</h3>
        {projects.length === 0 ? (
          <div className="dim" style={{ padding: '12px 2px' }}>
            Корзина пуста. Удалённые проекты можно будет восстановить отсюда вместе со всеми данными.
          </div>
        ) : (
          <div className="trash-list">
            {projects.map((project) => (
              <div className="trash-item" key={project.id}>
                <BookOpen size={16} />
                <span className="trash-item-title truncate">{project.title}</span>
                <span className="faint project-trash-meta">
                  {project.storyCount} {plural(project.storyCount, 'история', 'истории', 'историй')} ·{' '}
                  {deletedDate(project.deletedAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  title="Восстановить проект"
                  aria-label={`Восстановить проект «${project.title}»`}
                  onClick={() => restore(project)}
                >
                  <RotateCcw size={15} />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon
                  title="Удалить навсегда"
                  aria-label={`Удалить проект «${project.title}» навсегда`}
                  onClick={() => purge(project)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  )
}
