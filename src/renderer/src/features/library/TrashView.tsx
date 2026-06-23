import React from 'react'
import { RotateCcw, Trash2, BookOpen, FileText } from 'lucide-react'
import { useStore } from '../../store/store'
import { Button } from '../../shared/ui/components'
import { confirmDialog } from '../../shared/ui/dialogs'

/** Корзина (п.30): восстановление и окончательное удаление историй/глав. */
export function TrashView({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { current, applyProject } = useStore()
  if (!current) return <div />

  const trashedStories = current.stories.filter((s) => s.deletedAt)
  const trashedChapters = current.stories
    .filter((s) => !s.deletedAt)
    .flatMap((s) => s.chapters.filter((c) => c.deletedAt).map((c) => ({ story: s, chapter: c })))

  const empty = trashedStories.length === 0 && trashedChapters.length === 0

  const purgeStory = async (id: string, title: string): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить историю «${title}» навсегда?`, danger: true })))
      return
    applyProject(await window.api.stories.purge({ projectId: current.id, storyId: id }))
  }
  const purgeChapter = async (storyId: string, id: string, title: string): Promise<void> => {
    if (!(await confirmDialog({ title: `Удалить главу «${title}» навсегда?`, danger: true }))) return
    applyProject(await window.api.chapters.purge({ projectId: current.id, storyId, chapterId: id }))
  }

  const emptyTrash = async (): Promise<void> => {
    const count = trashedStories.length + trashedChapters.length
    if (
      !(await confirmDialog({
        title: 'Очистить корзину?',
        message: `${count} удалённых элементов будут уничтожены безвозвратно. Это действие нельзя отменить.`,
        confirmLabel: 'Очистить всё',
        danger: true
      }))
    )
      return
    applyProject(await window.api.trash.empty({ projectId: current.id }))
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal trash-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Корзина</h3>
        {empty ? (
          <div className="dim" style={{ padding: '12px 2px' }}>
            Корзина пуста. Удалённые истории и главы появятся здесь, и их можно будет восстановить.
          </div>
        ) : (
          <div className="trash-list">
            {trashedStories.map((s) => (
              <div className="trash-item" key={s.id}>
                <BookOpen size={15} />
                <span className="trash-item-title truncate">{s.title}</span>
                <span className="faint" style={{ fontSize: 12 }}>история</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  title="Восстановить"
                  onClick={async () =>
                    applyProject(
                      await window.api.stories.restore({ projectId: current.id, storyId: s.id })
                    )
                  }
                >
                  <RotateCcw size={15} />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon
                  title="Удалить навсегда"
                  onClick={() => purgeStory(s.id, s.title)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            {trashedChapters.map(({ story, chapter }) => (
              <div className="trash-item" key={chapter.id}>
                <FileText size={15} />
                <span className="trash-item-title truncate">
                  {chapter.title || 'Без названия'}
                </span>
                <span className="faint" style={{ fontSize: 12 }}>{story.title}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  title="Восстановить"
                  onClick={async () =>
                    applyProject(
                      await window.api.chapters.restore({
                        projectId: current.id,
                        storyId: story.id,
                        chapterId: chapter.id
                      })
                    )
                  }
                >
                  <RotateCcw size={15} />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon
                  title="Удалить навсегда"
                  onClick={() => purgeChapter(story.id, chapter.id, chapter.title)}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          {!empty && (
            <Button variant="danger" onClick={emptyTrash}>
              <Trash2 size={15} /> Очистить всё
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  )
}
