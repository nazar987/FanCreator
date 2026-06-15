import { app, BrowserWindow, protocol, net, screen } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import Store from 'electron-store'
import { initStore, resolveAssetUrl } from './store/store'
import { registerIpc } from './ipc'

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
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
