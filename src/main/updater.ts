import { app, ipcMain, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '@shared/api'

const { autoUpdater } = electronUpdater

/**
 * Авто-обновление (S-H): проверка/загрузка через GitHub Releases (см. publish в
 * electron-builder.yml). Статус транслируется в renderer каналом 'updates:status'.
 * Реально работает только в собранном (packaged) приложении.
 */
export function setupUpdater(win: BrowserWindow): void {
  const send = (status: UpdateStatus): void => {
    if (!win.isDestroyed()) win.webContents.send('updates:status', status)
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) =>
    send({ state: 'error', message: err == null ? 'unknown' : (err.message ?? String(err)) })
  )

  ipcMain.on('updates:check', () => {
    if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => undefined)
  })
  ipcMain.on('updates:install', () => {
    if (app.isPackaged) autoUpdater.quitAndInstall()
  })

  // первичная проверка при запуске (только в собранном приложении)
  if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => undefined)
}
