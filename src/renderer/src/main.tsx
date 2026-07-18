import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/cyrillic-400.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/cyrillic-500.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/cyrillic-600.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/cyrillic-700.css'
import '@fontsource/inter/latin-700.css'
// капитель для тем-миров (гравированные заголовки Dark Fantasy)
import '@fontsource/cormorant-sc/cyrillic-600.css'
import '@fontsource/cormorant-sc/latin-600.css'
import '@fontsource/cormorant-sc/cyrillic-700.css'
import '@fontsource/cormorant-sc/latin-700.css'
import './theme/theme.css'
import './shared/ui/ui.css'
import './app/app.css'
import './features/editor/editor.css'
import './features/library/library.css'
import './features/characters/characters.css'
import './features/board/board.css'
import './features/timeline/timeline.css'
import './features/help/help.css'
import './features/achievements/achievements.css'
import './features/updates/updates.css'
import './theme/theme-gallery.css'
// слой тем-миров — последним, чтобы перекрывать компонентные стили
import './theme/worlds.css'
// семантический контракт Theme Worlds 3.0 (профили материалов пяти миров)
import './theme/worlds/index.css'
import { StoreProvider } from './store/store'
import { App } from './app/App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
)
