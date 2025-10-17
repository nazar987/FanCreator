import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Promise-based IPC
  invoke(channel, ...args) {
    return ipcRenderer.invoke(channel, ...args)
  },
  // Event-based IPC
  send(channel, value) {
    ipcRenderer.send(channel, value)
  },
  on(channel, callback) {
    const subscription = (_event, ...args) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
}

contextBridge.exposeInMainWorld('api', api)
// keep backwards compat with your old code
contextBridge.exposeInMainWorld('ipc', api)