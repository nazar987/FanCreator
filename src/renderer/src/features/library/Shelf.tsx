import React from 'react'
import { Plus, BookPlus } from 'lucide-react'
import { useStore } from '../../store/store'
import { Button, Hashtags } from '../../shared/ui/components'
import { promptText } from '../../shared/ui/dialogs'
import { CoverArt } from './CoverArt'
import type { Story } from '@shared/types'

export function Shelf(): React.JSX.Element {
  const { current, applyProject, openTab } = useStore()
  if (!current) return <div />

  const addStory = async (): Promise<void> => {
    const title = await promptText({ title: 'Новая история', placeholder: 'Название истории' })
    if (!title) return
    applyProject(await window.api.stories.add({ projectId: current.id, title }))
  }

  const dropCover = async (s: Story, dataUrl: string): Promise<void> => {
    applyProject(
      await window.api.stories.setCover({
        projectId: current.id,
        storyId: s.id,
        source: dataUrl,
        isDataUrl: true
      })
    )
  }

  const pickCover = async (s: Story): Promise<void> => {
    applyProject(await window.api.stories.pickCover({ projectId: current.id, storyId: s.id }))
  }

  const openStory = (s: Story): void => {
    const first = s.chapters[0]
    if (first) {
      openTab({
        id: `chapter:${first.id}`,
        kind: 'chapter',
        title: first.title || 'Без названия',
        storyId: s.id,
        chapterId: first.id
      })
    } else {
      addChapterAndOpen(s)
    }
  }

  const addChapterAndOpen = async (s: Story): Promise<void> => {
    const p = await window.api.chapters.add({
      projectId: current.id,
      storyId: s.id,
      title: 'Глава 1'
    })
    applyProject(p)
    const story = p?.stories.find((x) => x.id === s.id)
    const c = story?.chapters[story.chapters.length - 1]
    if (c)
      openTab({ id: `chapter:${c.id}`, kind: 'chapter', title: c.title, storyId: s.id, chapterId: c.id })
  }

  return (
    <div className="shelf" data-tour="library">
      <div className="shelf-inner">
        <div className="shelf-head">
          <div>
            <div className="home-title" style={{ fontSize: 24 }}>
              {current.title}
            </div>
            <div className="home-sub">
              {current.stories.length} историй в проекте
            </div>
          </div>
          <Button variant="primary" onClick={addStory}>
            <BookPlus size={17} /> Добавить историю
          </Button>
        </div>

        {current.stories.length === 0 ? (
          <div className="dim" style={{ textAlign: 'center', padding: '60px 0' }}>
            В этом проекте ещё нет историй. Добавьте первую — и она появится на полке.
          </div>
        ) : (
          <div className="shelf-grid">
            {current.stories.map((s) => (
              <div className="book" key={s.id}>
                <CoverArt
                  title={s.title}
                  coverPath={s.coverPath}
                  onClick={() => openStory(s)}
                  onDropImage={(d) => dropCover(s, d)}
                  onPick={() => pickCover(s)}
                />
                <div>
                  <div className="book-title truncate">{s.title}</div>
                  <div className="book-meta">{s.chapters.length} глав</div>
                  <div style={{ marginTop: 6 }}>
                    <Hashtags tags={[...s.tags, ...s.genres]} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
