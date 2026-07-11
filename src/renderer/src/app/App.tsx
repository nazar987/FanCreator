import React from 'react'
import { useStore } from '../store/store'
import { DialogHost } from '../shared/ui/dialogs'
import { ContextMenuHost } from '../shared/ui/ContextMenu'
import { initSpellMenu } from '../shared/ui/SpellMenu'
import { CommandPalette } from '../shared/ui/CommandPalette'
import { ColorPickerHost } from '../shared/ui/ColorPalette'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { Home } from '../features/library/Home'
import { Shelf } from '../features/library/Shelf'
import { Editor } from '../features/editor/Editor'
import { Characters } from '../features/characters/Characters'
import { CharacterPage } from '../features/characters/CharacterPage'
import { Board } from '../features/board/Board'
import { Timeline } from '../features/timeline/Timeline'
import { HierarchyView } from '../features/hierarchy/HierarchyView'
import { HelpTour } from '../features/help/HelpTour'
import { UpdateBanner } from '../features/updates/UpdateBanner'
import { WhatsNew } from '../features/updates/WhatsNew'

const SIDEBAR_STORAGE_KEY = 'fancreator.sidebarOpen'

function initialSidebarOpen(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored !== null) return stored === 'true'
  } catch {
    // localStorage недоступен — используем размер окна
  }
  return !window.matchMedia('(max-width: 900px)').matches
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"], .ProseMirror'))
  )
}

export function App(): React.JSX.Element {
  const { current, tabs, activeTabId } = useStore()
  const [sidebarOpen, setSidebarOpen] = React.useState(initialSidebarOpen)

  // единое меню орфографии (исправления слова приходят из main по IPC)
  React.useEffect(() => initSpellMenu(), [])

  React.useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen))
    } catch {
      // localStorage недоступен — состояние сохранится только до перезапуска
    }
  }, [sidebarOpen])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!current || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 'b' || isEditableTarget(event.target)) return
      if (document.querySelector('.modal-overlay, .cmdk-overlay')) return
      event.preventDefault()
      setSidebarOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current])

  const active = tabs.find((t) => t.id === activeTabId) ?? tabs[0]

  return (
    <div className="app">
      {!current ? (
        <Home />
      ) : (
        <>
          {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
          {sidebarOpen && (
            <button
              className="sidebar-backdrop"
              aria-label="Закрыть боковую панель"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <div className="main">
            <TabBar
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((open) => !open)}
            />
            <div className="tab-content">
              {active?.kind === 'shelf' && <Shelf key={current.id} />}
              {active?.kind === 'characters' && <Characters key={current.id} />}
              {active?.kind === 'character' && active.characterId && (
                <CharacterPage key={active.characterId} characterId={active.characterId} />
              )}
              {active?.kind === 'board' && active.boardId && (
                <Board key={active.boardId} boardId={active.boardId} />
              )}
              {active?.kind === 'timeline' && active.timelineId && (
                <Timeline key={active.timelineId} timelineId={active.timelineId} />
              )}
              {active?.kind === 'hierarchy' && active.hierarchyId && (
                <HierarchyView key={active.hierarchyId} hierarchyId={active.hierarchyId} />
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
      <ColorPickerHost />
      <DialogHost />
      <ContextMenuHost />
      <HelpTour />
      <UpdateBanner />
      <WhatsNew />
    </div>
  )
}
