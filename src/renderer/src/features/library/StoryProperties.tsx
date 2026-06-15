import React from 'react'
import type { ChapterStatus, Story } from '@shared/types'
import { useStore } from '../../store/store'
import { Button, Input, STATUS_LABEL } from '../../shared/ui/components'
import { TagEditor } from '../../shared/ui/TagEditor'

interface StoryPropertiesProps {
  story: Story
  onClose: () => void
}

export function StoryProperties({ story, onClose }: StoryPropertiesProps): React.JSX.Element {
  const { current, applyProject } = useStore()
  const [title, setTitle] = React.useState(story.title)
  const [synopsis, setSynopsis] = React.useState(story.synopsis)
  const [status, setStatus] = React.useState<ChapterStatus>(story.status)
  const [tags, setTags] = React.useState(story.tags)
  const [genres, setGenres] = React.useState(story.genres)

  const save = async (): Promise<void> => {
    if (!current) return
    applyProject(
      await window.api.stories.update({
        projectId: current.id,
        storyId: story.id,
        patch: { title: title.trim(), synopsis, status, tags, genres }
      })
    )
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="modal story-properties" onMouseDown={(event) => event.stopPropagation()}>
        <h3>Свойства истории</h3>
        <label className="modal-control">
          <span>Название</span>
          <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="modal-control">
          <span>Синопсис</span>
          <textarea
            className="input story-properties-synopsis"
            value={synopsis}
            placeholder="Краткое описание истории"
            onChange={(event) => setSynopsis(event.target.value)}
          />
        </label>
        <label className="modal-control">
          <span>Статус</span>
          <select
            className="input"
            value={status}
            onChange={(event) => setStatus(event.target.value as ChapterStatus)}
          >
            {(Object.keys(STATUS_LABEL) as ChapterStatus[]).map((value) => (
              <option value={value} key={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-control">
          <span>Теги</span>
          <TagEditor tags={tags} onChange={setTags} placeholder="Добавить тег" />
        </div>
        <div className="modal-control">
          <span>Жанры</span>
          <TagEditor tags={genres} onChange={setGenres} placeholder="Добавить жанр" />
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" disabled={!title.trim()} onClick={save}>
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  )
}
