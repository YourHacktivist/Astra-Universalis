export interface OpenedFile {
  path: string | null
  content: string
}

export interface RecentEntry {
  path: string
  name: string
  openedAt: number
  exists?: boolean
}

interface AstraBridge {
  isElectron: true
  platform: string
  file: {
    open(): Promise<OpenedFile | null>
    read(path: string): Promise<OpenedFile>
    save(opts: { path?: string | null; content: string; defaultName?: string; saveAs?: boolean }): Promise<{ path: string } | null>
    export(opts: {
      data: string
      defaultName: string
      extension: string
      filterName?: string
      encoding: 'base64' | 'utf8'
    }): Promise<{ path: string } | null>
  }
  clipboard: { writeImage(base64Png: string): Promise<boolean> }
  recent: {
    list(): Promise<RecentEntry[]>
    add(path: string, name: string): Promise<void>
    remove(path: string): Promise<void>
    clear(): Promise<void>
  }
  autosave: { write(content: string): Promise<boolean>; read(): Promise<string | null> }
  drafts: { save(name: string, content: string): Promise<{ path: string }> }
  app: {
    pendingOpen(): Promise<OpenedFile | null>
    version(): Promise<string>
    confirmClose(): void
    onBeforeClose(cb: () => void): () => void
    onOpenFile(cb: (f: OpenedFile) => void): () => void
  }
  shell: { showItem(path: string): void; openExternal(url: string): void }
  window: {
    setTitle(title: string): void
    minimize(): void
    toggleMaximize(): void
    toggleFullscreen(): void
    toggleDevtools(): void
    setOverlay(opts: { color?: string; symbolColor?: string; height?: number }): void
    onMaximized(cb: (v: boolean) => void): () => void
    onFullscreen(cb: (v: boolean) => void): () => void
  }
}

declare global {
  interface Window {
    astra?: AstraBridge
  }
}

export const bridge: AstraBridge | undefined = typeof window !== 'undefined' ? window.astra : undefined
export const isElectron = !!bridge?.isElectron

const AUTOSAVE_KEY = 'astra.autosave.v1'
const RECENT_KEY = 'astra.recent.v1'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function base64ToBlob(base64: string, mime: string) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function pickFile(accept: string): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      resolve({ path: null, content: await f.text() })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export const platform = {
  isElectron,

  async openProject(): Promise<OpenedFile | null> {
    if (bridge) return bridge.file.open()
    return pickFile('.astra,.json,application/json')
  },

  async readProject(path: string): Promise<OpenedFile> {
    if (bridge) return bridge.file.read(path)
    throw new Error('Lecture directe indisponible dans le navigateur')
  },

  async saveProject(content: string, opts: { path?: string | null; defaultName: string; saveAs?: boolean }) {
    if (bridge) return bridge.file.save({ content, ...opts })
    downloadBlob(new Blob([content], { type: 'application/json' }), `${opts.defaultName}.astra`)
    return { path: null as string | null }
  },

  async exportBinary(base64: string, defaultName: string, extension: string, mime: string) {
    if (bridge) return bridge.file.export({ data: base64, defaultName, extension, encoding: 'base64', filterName: extension.toUpperCase() })
    downloadBlob(base64ToBlob(base64, mime), `${defaultName}.${extension}`)
    return { path: null as string | null }
  },

  async exportText(text: string, defaultName: string, extension: string, mime = 'application/json') {
    if (bridge) return bridge.file.export({ data: text, defaultName, extension, encoding: 'utf8' })
    downloadBlob(new Blob([text], { type: mime }), `${defaultName}.${extension}`)
    return { path: null as string | null }
  },

  async copyImage(base64Png: string) {
    if (bridge) return bridge.clipboard.writeImage(base64Png)
    const blob = base64ToBlob(base64Png, 'image/png')
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  },

  async recentList(): Promise<RecentEntry[]> {
    if (bridge) return bridge.recent.list()
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    } catch {
      return []
    }
  },
  async recentAdd(path: string, name: string) {
    if (bridge) return bridge.recent.add(path, name)
  },
  async recentRemove(path: string) {
    if (bridge) return bridge.recent.remove(path)
  },
  async recentClear() {
    if (bridge) return bridge.recent.clear()
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
    }
  },

  async autosaveWrite(content: string) {
    if (bridge) return bridge.autosave.write(content)
    try {
      localStorage.setItem(AUTOSAVE_KEY, content)
    } catch {
    }
    return true
  },
  async autosaveRead(): Promise<string | null> {
    if (bridge) return bridge.autosave.read()
    try {
      return localStorage.getItem(AUTOSAVE_KEY)
    } catch {
      return null
    }
  },

  async pendingOpen(): Promise<OpenedFile | null> {
    return bridge ? bridge.app.pendingOpen() : null
  },

  setTitle(title: string) {
    if (bridge) bridge.window.setTitle(title)
    else document.title = title
  },

  showItem(path: string) {
    bridge?.shell.showItem(path)
  },

  openExternal(url: string) {
    if (bridge) bridge.shell.openExternal(url)
    else window.open(url, '_blank', 'noopener')
  },
}
