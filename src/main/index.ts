import { app, BrowserWindow, protocol, net, screen, Menu, nativeTheme } from 'electron'
import path from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'
import Store from 'electron-store'
import { initStore, resolveAssetUrl } from './store/store'
import { autoBackupChangedProjects } from './store/profile'
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
  // Полностью убираем меню Electron (иначе по Alt всплывает верхняя менюшка) —
  // autoHideMenuBar только прятал его, но Alt всё равно показывал.
  Menu.setApplicationMenu(null)

  // Все темы приложения тёмные — системная БЕЛАЯ полоса заголовка Windows
  // выбивалась из интерфейса. Тёмная тема Chromium красит titlebar в тёмный.
  nativeTheme.themeSource = 'dark'

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

  // Иконка окна: в dev Electron показывает свой логотип — подставляем наш.
  // В собранном приложении иконка и так берётся из exe (resources при упаковке
  // не копируются рядом, поэтому existsSync-страховка).
  const iconPath = path.join(__dirname, '../../resources/icon.ico')

  const win = new BrowserWindow({
    ...defaults,
    ...bounds,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0e0e14',
    show: false,
    autoHideMenuBar: true,
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
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
  // Исправления орфографии показывает RENDERER своим контекстным меню: шлём ему
  // данные, а он объединяет их с пунктами редактора (например, «Продолжить
  // нумерацию…» в списке). Раньше нативный popup и кастомное меню конфликтовали —
  // в пунктах списка исправление слова не работало (п.11 фидбэка v2.1.1).
  win.webContents.on('context-menu', (_e, params) => {
    if (!params.isEditable) return
    win.webContents.send('spell:context', {
      x: params.x,
      y: params.y,
      word: params.misspelledWord || '',
      suggestions: params.dictionarySuggestions || []
    })
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

// ФАЗА 25 (S-V2): автобэкап изменённых проектов при выходе (если в профиле
// выбрана папка). Задерживаем quit один раз, доделываем архивы и выходим.
let quitBackupDone = false
app.on('before-quit', (event) => {
  if (quitBackupDone) return
  event.preventDefault()
  autoBackupChangedProjects().finally(() => {
    quitBackupDone = true
    app.quit()
  })
})
