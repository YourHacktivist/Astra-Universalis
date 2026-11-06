const { contextBridge, ipcRenderer } = require('electron')

function on(channel, cb) {
  const listener = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('astra', {
  isElectron: true,
  platform: process.platform,
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    read: (path) => ipcRenderer.invoke('file:read', path),
    save: (opts) => ipcRenderer.invoke('file:save', opts),
    export: (opts) => ipcRenderer.invoke('file:export', opts),
  },
  clipboard: {
    writeImage: (base64Png) => ipcRenderer.invoke('clipboard:write-image', base64Png),
  },
  recent: {
    list: () => ipcRenderer.invoke('recent:list'),
    add: (path, name) => ipcRenderer.invoke('recent:add', { path, name }),
    remove: (path) => ipcRenderer.invoke('recent:remove', path),
    clear: () => ipcRenderer.invoke('recent:clear'),
  },
  autosave: {
    write: (content) => ipcRenderer.invoke('autosave:write', content),
    read: () => ipcRenderer.invoke('autosave:read'),
  },
  drafts: {
    save: (name, content) => ipcRenderer.invoke('drafts:save', { name, content }),
  },
  app: {
    pendingOpen: () => ipcRenderer.invoke('app:pending-open'),
    version: () => ipcRenderer.invoke('app:version'),
    confirmClose: () => ipcRenderer.send('app:close-confirmed'),
    onBeforeClose: (cb) => on('app:before-close', cb),
    onOpenFile: (cb) => on('app:open-file', cb),
  },
  shell: {
    showItem: (path) => ipcRenderer.send('shell:show-item', path),
    openExternal: (url) => ipcRenderer.send('shell:open-external', url),
  },
  window: {
    setTitle: (title) => ipcRenderer.send('window:set-title', title),
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    toggleFullscreen: () => ipcRenderer.send('window:toggle-fullscreen'),
    toggleDevtools: () => ipcRenderer.send('window:toggle-devtools'),
    setOverlay: (opts) => ipcRenderer.send('window:set-overlay', opts),
    onMaximized: (cb) => on('window:maximized', cb),
    onFullscreen: (cb) => on('window:fullscreen', cb),
  },
})
