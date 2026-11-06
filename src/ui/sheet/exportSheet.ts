import plexSansUrl from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url'
import plexMono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url'
import plexMono500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url'
import corm400 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2?url'
import corm500 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2?url'
import corm600 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url'
import corm500i from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2?url'

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

let fontCssCache: Promise<string> | null = null

export function embeddedFontCss(): Promise<string> {
  if (!fontCssCache) {
    fontCssCache = (async () => {
      const faces: [string, string, string, string][] = [
        ['IBM Plex Sans Variable', plexSansUrl, '100 700', 'normal'],
        ['IBM Plex Mono', plexMono400, '400', 'normal'],
        ['IBM Plex Mono', plexMono500, '500', 'normal'],
        ['Cormorant Garamond', corm400, '400', 'normal'],
        ['Cormorant Garamond', corm500, '500', 'normal'],
        ['Cormorant Garamond', corm600, '600', 'normal'],
        ['Cormorant Garamond', corm500i, '500', 'italic'],
      ]
      const css = await Promise.all(
        faces.map(async ([family, url, weight, style]) => {
          const data = await toDataUrl(url)
          return `@font-face{font-family:'${family}';src:url(${data}) format('woff2');font-weight:${weight};font-style:${style};}`
        }),
      )
      return css.join('\n')
    })()
    fontCssCache.catch(() => (fontCssCache = null))
  }
  return fontCssCache
}

export async function loadSheetFonts() {
  const specs = [
    "600 20px 'Cormorant Garamond'",
    "500 20px 'Cormorant Garamond'",
    "italic 500 20px 'Cormorant Garamond'",
    "400 14px 'IBM Plex Sans Variable'",
    "600 14px 'IBM Plex Sans Variable'",
    "800 14px 'IBM Plex Sans Variable'",
    "400 12px 'IBM Plex Mono'",
    "500 12px 'IBM Plex Mono'",
  ]
  await Promise.all(specs.map((s) => document.fonts.load(s, 'AÉé').catch(() => null)))
  await document.fonts.ready
}

export async function standaloneSvg(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = await embeddedFontCss()
  clone.insertBefore(style, clone.firstChild)
  for (const img of Array.from(clone.querySelectorAll('image'))) {
    const href = img.getAttribute('href')
    if (href && !href.startsWith('data:')) img.setAttribute('href', await toDataUrl(href))
  }
  return new XMLSerializer().serializeToString(clone)
}

export async function svgToCanvas(svgText: string, width: number, height: number, scale: number): Promise<HTMLCanvasElement> {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Rendu SVG impossible'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function sheetSize(svg: SVGSVGElement) {
  return { w: Number(svg.getAttribute('width')), h: Number(svg.getAttribute('height')) }
}

function safeScale(w: number, h: number, scale: number) {
  return Math.min(scale, 16000 / Math.max(w, h), Math.sqrt(200e6 / (w * h)))
}

export async function sheetToPngBase64(svg: SVGSVGElement, scale = 2): Promise<{ base64: string; width: number; height: number }> {
  const { w, h } = sheetSize(svg)
  const canvas = await svgToCanvas(await standaloneSvg(svg), w, h, safeScale(w, h, scale))
  const dataUrl = canvas.toDataURL('image/png')
  return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), width: canvas.width, height: canvas.height }
}

export function pageSlices(svg: SVGSVGElement, pageRatio = 281 / 194): [number, number][] {
  const { w, h } = sheetSize(svg)
  const pageH = w * pageRatio
  const breaks = (svg.getAttribute('data-breaks') ?? '')
    .split(',')
    .map(Number)
    .filter((b) => Number.isFinite(b) && b > 0 && b < h)
    .sort((a, b) => a - b)
  const slices: [number, number][] = []
  let start = 0
  while (h - start > pageH) {
    const limit = start + pageH
    const cand = breaks.filter((b) => b > start + pageH * 0.35 && b <= limit)
    const end = cand.length ? cand[cand.length - 1] : limit
    slices.push([start, end])
    start = end
  }
  slices.push([start, h])
  return slices
}

export async function printSheet(svg: SVGSVGElement) {
  const { w, h } = sheetSize(svg)
  const scale = safeScale(w, h, 1.5)
  const canvas = await svgToCanvas(await standaloneSvg(svg), w, h, scale)
  const root = document.createElement('div')
  root.id = 'astra-print-root'
  const loads: Promise<void>[] = []
  for (const [a, b] of pageSlices(svg)) {
    const page = document.createElement('canvas')
    page.width = canvas.width
    page.height = Math.max(1, Math.round((b - a) * scale))
    page.getContext('2d')!.drawImage(canvas, 0, Math.round(a * scale), canvas.width, page.height, 0, 0, page.width, page.height)
    const img = document.createElement('img')
    img.src = page.toDataURL('image/png')
    img.className = 'astra-print-page'
    loads.push(new Promise((r) => (img.onload = () => r())))
    root.appendChild(img)
  }
  const style = document.createElement('style')
  style.textContent = `
    #astra-print-root { display: none; }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
      body > *:not(#astra-print-root) { display: none !important; }
      #astra-print-root { display: block !important; }
      .astra-print-page { display: block; width: 100%; break-after: page; page-break-after: always; }
      .astra-print-page:last-child { break-after: auto; page-break-after: auto; }
    }`
  document.body.appendChild(style)
  document.body.appendChild(root)
  await Promise.all(loads)
  const cleanup = () => {
    root.remove()
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  setTimeout(cleanup, 60_000)
}
