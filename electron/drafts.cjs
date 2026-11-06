const path = require('node:path')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')

const MAX_DRAFTS = 20
const pad = (n) => String(n).padStart(2, '0')

function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}h${pad(d.getMinutes())}`
}

async function saveDraft(dir, name, content, ext) {
  await fs.mkdir(dir, { recursive: true })
  const safe =
    String(name || 'Projet')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'Projet'
  const base = `${safe} ${stamp()}`
  let filePath = path.join(dir, `${base}.${ext}`)
  for (let i = 2; fsSync.existsSync(filePath); i++) filePath = path.join(dir, `${base} (${i}).${ext}`)
  await fs.writeFile(filePath, content, 'utf8')
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.' + ext))
  if (files.length > MAX_DRAFTS) {
    const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(dir, f))).mtimeMs })))
    stats.sort((a, b) => b.t - a.t)
    for (const { f } of stats.slice(MAX_DRAFTS)) await fs.unlink(path.join(dir, f)).catch(() => {})
  }
  return filePath
}

module.exports = { saveDraft, MAX_DRAFTS }
