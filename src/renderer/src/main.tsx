import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme/theme.css'
import './shared/ui/ui.css'
import './app/app.css'
import './features/editor/editor.css'
import './features/library/library.css'
import { StoreProvider } from './store/store'
import { App } from './app/App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
)
