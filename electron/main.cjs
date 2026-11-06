const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const { saveDraft } = require('./drafts.cjs')

const isDev = process.argv.includes('--dev')
const DEV_URL = 'http://127.0.0.1:5173'
const FILE_EXT = 'astra'
const MAX_RECENT = 12

let mainWindow = null
let pendingOpenPath = null
let allowClose = false

const recentFile = () => path.join(app.getPath('userData'), 'recent.json')

async function readRecent() {
  try {
    const list = JSON.parse(await fs.readFile(recentFile(), 'utf8'))
    return Array.isArray(list) ? list.filter((r) => r && typeof r.path === 'string') : []
  } catch {
    return []
  }
}

async function writeRecent(list) {
  await fs.mkdir(path.dirname(recentFile()), { recursive: true })
  await fs.writeFile(recentFile(), JSON.stringify(list.slice(0, MAX_RECENT), null, 2), 'utf8')
}

async function addRecent(filePath, name) {
  const list = (await readRecent()).filter((r) => path.resolve(r.path) !== path.resolve(filePath))
  list.unshift({ path: filePath, name: name || path.basename(filePath, '.' + FILE_EXT), openedAt: Date.now() })
  await writeRecent(list)
  app.addRecentDocument(filePath)
}

function findAstraArg(argv) {
  return argv.find((a) => typeof a === 'string' && a.toLowerCase().endsWith('.' + FILE_EXT) && fsSync.existsSync(a)) || null
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#030304',
    title: 'Astra Universalis',
    icon: path.join(__dirname, '..', isDev ? 'public' : 'dist', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#9aa0b2', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isDev && url.startsWith(DEV_URL)) return
    e.preventDefault()
  })

  mainWindow.webContents.on('console-message', (event) => {
    const level = event.level ?? event.params?.level
    if (level === 'error' || level === 3) console.error('[renderer]', event.message ?? event.params?.message)
  })
  const stamp = () => new Date().toISOString().slice(11, 23)
  mainWindow.webContents.on('did-finish-load', () => console.log(stamp(), '[loaded]'))
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => console.error(stamp(), '[load failed]', code, desc, url))
  mainWindow.webContents.on('render-process-gone', (_e, details) => console.error(stamp(), '[renderer gone]', details.reason, details.exitCode))

  mainWindow.on('close', (e) => {
    if (allowClose) return
    e.preventDefault()
    mainWindow.webContents.send('app:before-close')
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false))
  mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('window:fullscreen', true))
  mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('window:fullscreen', false))

  if (isDev) mainWindow.loadURL(DEV_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

const astraFilters = [{ name: 'Projet Astra Universalis', extensions: [FILE_EXT] }]

ipcMain.handle('file:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un projet',
    filters: [...astraFilters, { name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (res.canceled || !res.filePaths[0]) return null
  const filePath = res.filePaths[0]
  const content = await fs.readFile(filePath, 'utf8')
  return { path: filePath, content }
})

ipcMain.handle('file:read', async (_e, filePath) => {
  const content = await fs.readFile(filePath, 'utf8')
  return { path: filePath, content }
})

ipcMain.handle('file:save', async (_e, { path: filePath, content, defaultName, saveAs }) => {
  let target = filePath
  if (!target || saveAs) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le projet',
      defaultPath: (defaultName || 'Projet') + '.' + FILE_EXT,
      filters: astraFilters,
    })
    if (res.canceled || !res.filePath) return null
    target = res.filePath
  }
  const tmp = target + '.tmp'
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, target)
  return { path: target }
})

ipcMain.handle('file:export', async (_e, { data, defaultName, extension, filterName, encoding }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporter',
    defaultPath: defaultName + '.' + extension,
    filters: [{ name: filterName || extension.toUpperCase(), extensions: [extension] }],
  })
  if (res.canceled || !res.filePath) return null
  const buffer = encoding === 'base64' ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf8')
  await fs.writeFile(res.filePath, buffer)
  return { path: res.filePath }
})

ipcMain.handle('clipboard:write-image', async (_e, base64Png) => {
  clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(base64Png, 'base64')))
  return true
})

ipcMain.handle('recent:list', async () => {
  const list = await readRecent()
  return list.map((r) => ({ ...r, exists: fsSync.existsSync(r.path) }))
})
ipcMain.handle('recent:add', async (_e, { path: filePath, name }) => addRecent(filePath, name))
ipcMain.handle('recent:remove', async (_e, filePath) => {
  const list = (await readRecent()).filter((r) => r.path !== filePath)
  await writeRecent(list)
})
ipcMain.handle('recent:clear', async () => writeRecent([]))

ipcMain.handle('autosave:write', async (_e, content) => {
  const p = path.join(app.getPath('userData'), 'autosave.astra')
  await fs.writeFile(p + '.tmp', content, 'utf8')
  await fs.rename(p + '.tmp', p)
  return true
})
ipcMain.handle('drafts:save', async (_e, { name, content }) => {
  const filePath = await saveDraft(path.join(app.getPath('userData'), 'Brouillons'), name, content, FILE_EXT)
  await addRecent(filePath, `${name} (brouillon)`)
  return { path: filePath }
})

ipcMain.handle('autosave:read', async () => {
  try {
    return await fs.readFile(path.join(app.getPath('userData'), 'autosave.astra'), 'utf8')
  } catch {
    return null
  }
})

ipcMain.handle('app:pending-open', async () => {
  const p = pendingOpenPath
  pendingOpenPath = null
  if (!p) return null
  try {
    return { path: p, content: await fs.readFile(p, 'utf8') }
  } catch {
    return null
  }
})
ipcMain.handle('app:version', () => app.getVersion())

ipcMain.on('app:close-confirmed', () => {
  allowClose = true
  if (mainWindow) mainWindow.close()
})

ipcMain.on('shell:show-item', (_e, filePath) => shell.showItemInFolder(filePath))
ipcMain.on('shell:open-external', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url)
})

ipcMain.on('window:set-title', (_e, title) => mainWindow && mainWindow.setTitle(title))
ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize())
ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on('window:toggle-fullscreen', () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()))
ipcMain.on('window:toggle-devtools', () => mainWindow && mainWindow.webContents.toggleDevTools())
ipcMain.on('window:set-overlay', (_e, opts) => {
  try {
    if (mainWindow && mainWindow.setTitleBarOverlay) mainWindow.setTitleBarOverlay(opts)
  } catch {
  }
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', async (_e, argv) => {
    const p = findAstraArg(argv)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      if (p) {
        try {
          mainWindow.webContents.send('app:open-file', { path: p, content: await fs.readFile(p, 'utf8') })
        } catch {
        }
      }
    }
  })

  pendingOpenPath = findAstraArg(process.argv)

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
