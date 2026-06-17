import { app, BrowserWindow, protocol, net, screen, Menu, MenuItem } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import Store from 'electron-store'
import { initStore, resolveAssetUrl } from './store/store'
import { registerIpc } from './ipc'
import { setupUpdater } from './updater'

const isDev = !app.isPackaged

// asset:// должен быть привилегированным, чтобы рендер мог грузить картинки
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: { secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
])

/** Сохранение/восстановление позиции и размера окна. */
function createMainWindow(): BrowserWindow {
  const store = new Store<{ bounds?: Electron.Rectangle }>({ name: 'window-state' })
  const defaults = { width: 1280, height: 840 }
  let bounds = store.get('bounds')

  // если окно вне видимых дисплеев — сбросить на дефолт по центру
  if (bounds) {
    const visible = screen.getAllDisplays().some((d) => {
      const b = d.bounds
      return (
        bounds!.x >= b.x &&
        bounds!.y >= b.y &&
        bounds!.x + bounds!.width <= b.x + b.width &&
        bounds!.y + bounds!.height <= b.y + b.height
      )
    })
    if (!visible) bounds = undefined
  }

  const win = new BrowserWindow({
    ...defaults,
    ...bounds,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0e0e14',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => win.show())

  // проверка орфографии (п.4): русский + английский словари
  try {
    win.webContents.session.setSpellCheckerLanguages(['ru', 'en-US'])
  } catch {
    // некоторые языки могут быть недоступны — не валим запуск
  }
  // контекстное меню с вариантами исправления для слова с ошибкой
  win.webContents.on('context-menu', (_e, params) => {
    if (!params.misspelledWord) return
    const menu = new Menu()
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion)
        })
      )
    }
    if (params.dictionarySuggestions.length) menu.append(new MenuItem({ type: 'separator' }))
    menu.append(
      new MenuItem({
        label: 'Добавить в словарь',
        click: () =>
          win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
    )
    menu.popup()
  })

  const save = (): void => {
    if (!win.isMinimized() && !win.isMaximized()) store.set('bounds', win.getBounds())
  }
  win.on('close', save)

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  // обслуживание asset://<projectId>/<file> с диска
  protocol.handle('asset', (request) => {
    const filePath = resolveAssetUrl(request.url)
    if (!filePath) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(filePath).toString())
  })

  await initStore()
  registerIpc()
  const win = createMainWindow()
  setupUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
