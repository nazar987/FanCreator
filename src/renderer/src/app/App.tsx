import React from 'react'
import { useStore } from '../store/store'
import { DialogHost } from '../shared/ui/dialogs'
import { ContextMenuHost } from '../shared/ui/ContextMenu'
import { CommandPalette } from '../shared/ui/CommandPalette'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { Home } from '../features/library/Home'
import { Shelf } from '../features/library/Shelf'
import { Editor } from '../features/editor/Editor'
import { Characters } from '../features/characters/Characters'
import { Board } from '../features/board/Board'
import { Timeline } from '../features/timeline/Timeline'
import { HelpTour } from '../features/help/HelpTour'
import { UpdateBanner } from '../features/updates/UpdateBanner'

export function App(): React.JSX.Element {
  const { current, tabs, activeTabId } = useStore()

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  return (
    <div className="app">
      {!current ? (
        <Home />
      ) : (
        <>
          <Sidebar />
          <div className="main">
            <TabBar />
            <div className="tab-content">
              {active?.kind === 'shelf' && <Shelf />}
              {active?.kind === 'characters' && <Characters />}
              {active?.kind === 'board' && active.boardId && (
                <Board key={active.boardId} boardId={active.boardId} />
              )}
              {active?.kind === 'timeline' && active.timelineId && (
                <Timeline key={active.timelineId} timelineId={active.timelineId} />
              )}
              {active?.kind === 'chapter' && active.storyId && active.chapterId && (
                <Editor
                  key={active.chapterId}
                  storyId={active.storyId}
                  chapterId={active.chapterId}
                />
              )}
            </div>
          </div>
        </>
      )}

      <CommandPalette />
      <DialogHost />
      <ContextMenuHost />
      <HelpTour />
      <UpdateBanner />
    </div>
  )
}
