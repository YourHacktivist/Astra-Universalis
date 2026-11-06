import { forwardRef, useMemo, type ReactNode } from 'react'
import type { Body, PlanetProps, StarSystem } from '@/core/types'
import { formatSimDate, num } from '@/lib/format'
import {
  bodyColor,
  buildRows,
  font,
  habitableCount,
  measure,
  schematic,
  systemCounts,
  typeLabel,
  wrap,
  type SheetRow,
  type SheetTheme,
} from './sheetData'

export const SHEET_W = 1600
const PAD = 64
const INNER = SHEET_W - PAD * 2

interface Props {
  system: StarSystem
  theme: SheetTheme
  playerMode: boolean
  time: number
  logoHref: string
}

function Lines({
  x,
  y,
  lines,
  lh,
  f,
  fill,
  anchor = 'start',
  spacing,
}: {
  x: number
  y: number
  lines: string[]
  lh: number
  f: string
  fill: string
  anchor?: 'start' | 'middle' | 'end'
  spacing?: number
}) {
  return (
    <text y={y} style={{ font: f, letterSpacing: spacing ? `${spacing}px` : undefined }} fill={fill} textAnchor={anchor}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>
          {l}
        </tspan>
      ))}
    </text>
  )
}

function planetRadiusPx(b: Body, maxR: number) {
  if (b.kind === 'planet' || b.kind === 'moon') return Math.min(maxR, Math.max(5, 6 + 15.5 * Math.sqrt(b.props.radius)))
  if (b.kind === 'star') return Math.min(maxR, 30)
  return 9
}

function PlanetDisc({ id, p, cx, cy, r, theme, maxRx }: { id: string; p: PlanetProps; cx: number; cy: number; r: number; theme: SheetTheme; maxRx: number }) {
  const giant = p.planetType === 'gas' || p.planetType === 'icegiant' || p.planetType === 'hotjupiter' || p.planetType === 'toxic'
  const clip = `${id}-clip`
  const ring = p.rings.enabled
  const rx = Math.max(r * 1.12, Math.min(r * Math.max(1.15, p.rings.outer), maxRx))
  const ry = rx * 0.26
  const rot = -14
  const bands = giant ? Math.max(5, Math.min(18, Math.round(p.bands || 8))) : 0
  const ringW = Math.max(2, r * 0.2)
  const ringArc = (sweep: 0 | 1, k = 1) =>
    `M ${cx - rx * k} ${cy} A ${rx * k} ${ry * k} 0 0 ${sweep} ${cx + rx * k} ${cy}`
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      {ring && <path d={ringArc(1)} transform={`rotate(${rot} ${cx} ${cy})`} fill="none" stroke={p.rings.colorA} strokeOpacity={0.55 * p.rings.opacity + 0.2} strokeWidth={ringW} />}
      <circle cx={cx} cy={cy} r={r} fill={p.palette[giant ? 1 : 2]} />
      <g clipPath={`url(#${clip})`}>
        {giant &&
          Array.from({ length: bands }, (_, k) => (
            <rect key={k} x={cx - r} y={cy - r + (k / bands) * 2 * r} width={2 * r} height={(2 * r) / bands + 0.5} fill={p.palette[k % 4]} opacity={0.5 + ((k * 37) % 5) * 0.09} />
          ))}
        {!giant && p.seaLevel > 0.3 && (
          <>
            <circle cx={cx - r * 0.25} cy={cy - r * 0.1} r={r * 0.55} fill={p.palette[0]} opacity={0.6} />
            <circle cx={cx + r * 0.35} cy={cy + r * 0.35} r={r * 0.35} fill={p.palette[1]} opacity={0.55} />
          </>
        )}
        {!giant && p.iceCaps > 0.1 && (
          <>
            <rect x={cx - r} y={cy - r} width={2 * r} height={r * 0.28 * p.iceCaps + 1} fill={p.palette[4]} opacity={0.85} />
            <rect x={cx - r} y={cy + r - r * 0.24 * p.iceCaps - 1} width={2 * r} height={r * 0.24 * p.iceCaps + 1} fill={p.palette[4]} opacity={0.8} />
          </>
        )}
        {giant && p.storms > 0.2 && <ellipse cx={cx + r * 0.25} cy={cy + r * 0.3} rx={r * 0.18} ry={r * 0.1} fill={p.palette[4]} opacity={0.9} />}
        {p.clouds.enabled && p.clouds.coverage > 0.4 && (
          <circle cx={cx} cy={cy} r={r} fill={p.clouds.color} opacity={Math.min(0.5, p.clouds.coverage * 0.45) * p.clouds.opacity} />
        )}
        <path d={`M ${cx} ${cy - r} A ${r * 0.45} ${r} 0 0 1 ${cx} ${cy + r} A ${r} ${r} 0 0 0 ${cx} ${cy - r} Z`} fill="#000" opacity={0.42} />
      </g>
      {theme.planetOutline && <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.planetOutline} strokeWidth={1} />}
      {ring && (
        <>
          <path d={ringArc(0)} transform={`rotate(${rot} ${cx} ${cy})`} fill="none" stroke={p.rings.colorA} strokeOpacity={0.7 * p.rings.opacity + 0.2} strokeWidth={ringW} />
          <path d={ringArc(0, 0.86)} transform={`rotate(${rot} ${cx} ${cy})`} fill="none" stroke={p.rings.colorB} strokeOpacity={0.7 * p.rings.opacity} strokeWidth={Math.max(1, r * 0.07)} />
        </>
      )}
    </g>
  )
}

function Diamond({ cx, cy, s, fill }: { cx: number; cy: number; s: number; fill: string }) {
  return <path d={`M ${cx} ${cy - s} L ${cx + s} ${cy} L ${cx} ${cy + s} L ${cx - s} ${cy} Z`} fill={fill} />
}

const TABLE_COLS: { key: keyof Omit<SheetRow, 'body' | 'depth'>; label: string; w: number; kind: 'name' | 'mono' | 'text' }[] = [
  { key: 'name', label: 'Corps', w: 214, kind: 'name' },
  { key: 'type', label: 'Type', w: 150, kind: 'text' },
  { key: 'distance', label: 'Distance', w: 118, kind: 'mono' },
  { key: 'period', label: 'Période', w: 96, kind: 'mono' },
  { key: 'radius', label: 'Rayon', w: 86, kind: 'mono' },
  { key: 'gravity', label: 'Gravité', w: 76, kind: 'mono' },
  { key: 'temp', label: 'Temp.', w: 80, kind: 'mono' },
  { key: 'atmosphere', label: 'Atmosphère', w: 210, kind: 'text' },
  { key: 'people', label: 'Population · faction', w: 222, kind: 'text' },
  { key: 'hazards', label: 'Dangers', w: 220, kind: 'text' },
]

let sheetSeq = 0

export const SheetSvg = forwardRef<SVGSVGElement, Props>(function SheetSvg({ system, theme, playerMode, time, logoHref }, ref) {
  const T = theme
  const uid = useMemo(() => `sh${++sheetSeq}`, [])
  const print = T.id === 'print'
  const disp = (size: number) => font(size, T.display.family, T.display.weight, T.display.italic)
  const body = (size: number, w = 400) => font(size, T.body, w)
  const mono = (size: number, w = 400) => font(size, T.mono, w)
  const up = (s: string) => (T.display.upper ? s.toUpperCase() : s)
  const wrapDisp = (s: string, size: number, maxW: number) => wrap(up(s), disp(size), maxW, T.display.spacing * size)
  const wrapMono = (s: string, size: number, maxW: number, spacingEm: number, w = 500) => wrap(s.toUpperCase(), mono(size, w), maxW, spacingEm * size)

  const data = useMemo(() => {
    const rows = buildRows(system, playerMode)
    const sch = schematic(system, playerMode)
    const counts = systemCounts(system, playerMode)
    const hab = habitableCount(system, playerMode)
    return { rows, sch, counts, hab }
  }, [system, playerMode])
  const { rows, sch, counts, hab } = data

  const els: ReactNode[] = []
  const breaks: number[] = []
  let y = 0

  const factsX = SHEET_W - PAD - 400
  const titleX = PAD + 136
  const titleW = factsX - titleX - 40
  const nameSize = print ? 52 : 64
  const nameLines = wrapDisp(system.name, nameSize, titleW)
  const descLines = system.description ? wrap(system.description, body(15), titleW) : []
  const starsLabel = sch.rootStars.map((s) => typeLabel(s)).join(' + ') || '–'

  let ty = 92
  els.push(
    <Lines key="eyebrow" x={titleX} y={ty} lines={wrapMono([system.designation, 'Fiche système'].filter(Boolean).join('  ·  '), 12, titleW, 0.22)} lh={16} f={mono(12, 500)} fill={T.accent} spacing={12 * 0.22} />,
  )
  ty += 58
  els.push(<Lines key="name" x={titleX - 2} y={ty} lines={nameLines} lh={nameSize * 1.02} f={disp(nameSize)} fill={T.ink} spacing={T.display.spacing * nameSize} />)
  ty += (nameLines.length - 1) * nameSize * 1.02 + 36
  if (descLines.length) {
    els.push(<Lines key="desc" x={titleX} y={ty} lines={descLines} lh={22} f={body(15)} fill={T.ink2} />)
    ty += (descLines.length - 1) * 22
  }
  els.push(<image key="logo" href={logoHref} x={PAD - 8} y={44} width={124} height={124} />)

  const facts: [string, string, boolean][] = [
    ['Étoiles', starsLabel, false],
    ['Planètes', String(counts.planet ?? 0), true],
    ['Lunes', String(counts.moon ?? 0), true],
    ['Habitables', String(hab), true],
    ['Stations & vaisseaux', String((counts.station ?? 0) + (counts.ship ?? 0)), true],
    ['Date', formatSimDate(system.calendar.epochYear, time, false) + (system.calendar.era ? ` ${system.calendar.era}` : ''), true],
  ]
  let fy = 62
  for (let r = 0; r < 3; r++) {
    let rowH = 0
    for (let c = 0; c < 2; c++) {
      const [k, v, isNum] = facts[r * 2 + c]
      const x = factsX + c * 210
      const vf = isNum ? mono(18, 500) : body(14, 600)
      const vl = wrap(v, vf, 190)
      const kl = wrapMono(k, 10, 190, 0.18)
      els.push(
        <g key={`fact-${k}`}>
          <Lines x={x} y={fy} lines={kl} lh={13} f={mono(10, 500)} fill={T.ink3} spacing={1.8} />
          <Lines x={x} y={fy + 9 + kl.length * 13} lines={vl} lh={20} f={vf} fill={k === 'Habitables' && hab && !print ? '#86d6a6' : T.ink} />
        </g>,
      )
      rowH = Math.max(rowH, kl.length * 13 + vl.length * 20 + 18)
    }
    fy += rowH
  }
  const headerH = Math.max(ty, fy) + 34
  y = headerH
  els.push(<rect key="hr1" x={PAD} y={y} width={INNER} height={print ? 3 : 1} fill={print ? T.ink : T.lineStrong} />)
  breaks.push(y)

  const cols = sch.columns
  const n = Math.max(1, cols.length)
  const x0 = 290
  const x1 = SHEET_W - PAD - 60
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0
  const colW = n > 1 ? Math.min(210, step) : 240
  const textW = colW - 16
  const maxR = Math.max(10, Math.min(62, colW * 0.38))
  const discMax = cols.reduce((m, c) => Math.max(m, planetRadiusPx(c.body, maxR)), 20)
  const colNameSize = print ? 13 : 19

  const colLayouts = cols.map((c) => {
    const b = c.body
    const name = wrapDisp(b.name, colNameSize, textW)
    const type = wrapMono(typeLabel(b), 9.5, textW, 0.1)
    const dist = b.kind === 'belt' ? `${num(b.props.inner)}–${num(b.props.outer)} UA` : b.orbit ? `${num(b.orbit.a)} UA` : ''
    const distL = dist ? wrap(dist, mono(10.5), textW) : []
    const sats = c.satellites.map((s) => ({ s, lines: wrap(s.name, body(11.5, 500), colW - 40) }))
    const labelH = name.length * (colNameSize + 3) + type.length * 13 + distL.length * 14 + 14
    const satH = sats.reduce((h, x) => h + Math.max(22, x.lines.length * 15 + 8), 0)
    return { name, type, distL, sats, labelH, satH }
  })
  const contentH = colLayouts.reduce((m, l) => Math.max(m, l.labelH + l.satH), 60)
  const starNameSize = print ? 17 : 24
  const starNameLines = wrapDisp(sch.rootStars.map((s) => s.name).join(' & ') || system.name, starNameSize, 210)
  const starSpecLines = wrapMono(starsLabel, 10, 210, 0.12)
  const starBoxH = starNameLines.length * (starNameSize + 2) + starSpecLines.length * 13 + 24
  const cy = y + 70 + discMax
  const bandH = Math.max(70 + discMax * 2 + 26 + contentH + 40, starBoxH + discMax * 2 + 120)

  const star = sch.rootStars[0]
  if (star && star.kind === 'star') {
    const sc = bodyColor(star)
    const bh = star.props.starClass === 'BH'
    const clip = `${uid}-starclip`
    const bw = Math.max(...starNameLines.map((l) => measure(l, disp(starNameSize), T.display.spacing * starNameSize)), ...starSpecLines.map((l) => measure(l, mono(10, 500), 1.2))) + 28
    const by = y + bandH - starBoxH - 22
    els.push(
      <g key="star">
        <defs>
          <clipPath id={clip}>
            <rect x={PAD} y={y + 1} width={SHEET_W} height={bandH - 1} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <circle cx={PAD - 150} cy={cy} r={250} fill={bh ? '#000' : sc} stroke={print ? T.ink : bh ? star.props.diskColorOuter : 'none'} strokeWidth={print ? 1.5 : bh ? 3 : 0} />
          {!print && !bh && [262, 276, 292].map((r, i) => <circle key={r} cx={PAD - 150} cy={cy} r={r} fill="none" stroke={sc} strokeOpacity={0.35 - i * 0.1} strokeWidth={1} />)}
          {sch.rootStars[1] && (
            <circle cx={PAD + 70} cy={cy - discMax - 20} r={26} fill={bodyColor(sch.rootStars[1])} stroke={T.planetOutline ?? 'none'} strokeWidth={T.planetOutline ? 1 : 0} />
          )}
        </g>
        <rect x={PAD + 10} y={by} width={bw} height={starBoxH} rx={print ? 0 : 3} fill={print ? T.bg : T.panel} stroke={print ? T.ink : T.lineStrong} strokeWidth={print ? 1.5 : 1} />
        <Lines x={PAD + 24} y={by + starNameSize + 6} lines={starNameLines} lh={starNameSize + 2} f={disp(starNameSize)} fill={T.ink} spacing={T.display.spacing * starNameSize} />
        <Lines x={PAD + 24} y={by + starNameSize + 6 + starNameLines.length * (starNameSize + 2) - 2} lines={starSpecLines} lh={13} f={mono(10, 500)} fill={T.accent} spacing={1.2} />
      </g>,
    )
  }
  if (cols.length) els.push(<line key="bar" x1={PAD + 110} y1={cy} x2={x0 + step * (n - 1) + 30} y2={cy} stroke={T.lineStrong} strokeWidth={1} />)

  cols.forEach((c, i) => {
    const b = c.body
    const L = colLayouts[i]
    const x = n > 1 ? x0 + step * i : x0 + 120
    const inner: ReactNode[] = []
    const r = planetRadiusPx(b, maxR)
    inner.push(<line key="tick" x1={x} y1={cy - discMax - 18} x2={x} y2={cy - discMax - 8} stroke={T.lineStrong} strokeWidth={1} />)
    if (b.kind === 'planet') inner.push(<PlanetDisc key="disc" id={`${uid}-${b.id}`} p={b.props} cx={x} cy={cy} r={r} theme={T} maxRx={colW * 0.5 - 4} />)
    else if (b.kind === 'belt') {
      for (let k = 0; k < 46; k++) {
        const h = Math.sin(k * 12.9898 + b.seed) * 43758.5453
        const fr = h - Math.floor(h)
        const h2 = Math.sin(k * 78.233 + b.seed) * 12345.678
        const fr2 = h2 - Math.floor(h2)
        inner.push(<circle key={`d${k}`} cx={x + (fr - 0.5) * colW * 0.5} cy={cy + (fr2 - 0.5) * discMax * 1.6} r={0.8 + fr2 * 1.8} fill={print ? T.ink2 : b.props.colorA} opacity={0.9} />)
      }
    } else if (b.kind === 'star') {
      inner.push(<circle key="s" cx={x} cy={cy} r={r} fill={bodyColor(b)} stroke={T.planetOutline ?? 'none'} strokeWidth={T.planetOutline ? 1 : 0} />)
    } else if (b.kind === 'gate') {
      inner.push(<circle key="g" cx={x} cy={cy} r={12} fill="none" stroke={print ? T.ink : b.color} strokeWidth={2.5} />)
      inner.push(<circle key="g2" cx={x} cy={cy} r={5} fill={print ? T.ink : b.color} opacity={0.5} />)
    } else {
      inner.push(<Diamond key="st" cx={x} cy={cy} s={8} fill={print ? T.ink : T.accent2} />)
    }
    let ly = cy + discMax + 30
    inner.push(<Lines key="name" x={x} y={ly} lines={L.name} lh={colNameSize + 3} f={disp(colNameSize)} fill={T.ink} anchor="middle" spacing={T.display.spacing * colNameSize} />)
    ly += (L.name.length - 1) * (colNameSize + 3) + 17
    inner.push(<Lines key="type" x={x} y={ly} lines={L.type} lh={13} f={mono(9.5, 500)} fill={T.ink3} anchor="middle" spacing={0.95} />)
    ly += (L.type.length - 1) * 13 + 15
    if (L.distL.length) {
      inner.push(<Lines key="dist" x={x} y={ly} lines={L.distL} lh={14} f={mono(10.5)} fill={print ? T.ink : T.accent2} anchor="middle" />)
      ly += (L.distL.length - 1) * 14
    }
    ly += 24
    for (const { s, lines } of L.sats) {
      const sx = x - colW / 2 + 16
      if (s.kind === 'moon' || s.kind === 'planet') {
        const mr = Math.min(9, Math.max(3, 3 + 7 * Math.sqrt(s.props.radius)))
        inner.push(<circle key={`m${s.id}`} cx={sx} cy={ly - 4} r={mr} fill={s.props.palette[2]} stroke={T.planetOutline ?? 'none'} strokeWidth={T.planetOutline ? 1 : 0} />)
      } else inner.push(<Diamond key={`m${s.id}`} cx={sx} cy={ly - 4} s={5} fill={print ? T.ink : T.accent2} />)
      inner.push(<Lines key={`mt${s.id}`} x={sx + 14} y={ly} lines={lines} lh={15} f={body(11.5, 500)} fill={T.ink2} />)
      ly += Math.max(22, lines.length * 15 + 8)
    }
    els.push(<g key={`col-${b.id}`}>{inner}</g>)
  })
  if (!cols.length) {
    els.push(
      <text key="empty" x={SHEET_W / 2} y={cy} style={{ font: body(14) }} fill={T.ink3} textAnchor="middle">
        Aucun corps en orbite.
      </text>,
    )
  }
  y += bandH
  els.push(<rect key="hr2" x={PAD} y={y} width={INNER} height={print ? 3 : 1} fill={print ? T.ink : T.lineStrong} />)
  breaks.push(y)

  y += 48
  els.push(<Lines key="tt" x={PAD} y={y} lines={['CATALOGUE DES CORPS']} lh={14} f={mono(11, 500)} fill={T.accent} spacing={2.4} />)
  y += 22
  const headLabels = TABLE_COLS.map((c) => wrapMono(c.label, 9.5, c.w - 14, 0.14))
  const headH = Math.max(...headLabels.map((l) => l.length)) * 12 + 16
  els.push(<rect key="th-bg" x={PAD} y={y} width={INNER} height={headH} fill={print ? T.ink : T.panel} />)
  if (!print) els.push(<rect key="th-line" x={PAD} y={y + headH - 1} width={INNER} height={1} fill={T.lineStrong} />)
  let hx = PAD + 10
  TABLE_COLS.forEach((c, i) => {
    els.push(<Lines key={`th-${c.key}`} x={hx} y={y + 18} lines={headLabels[i]} lh={12} f={mono(9.5, 500)} fill={print ? T.bg : T.ink3} spacing={1.33} />)
    hx += c.w
  })
  y += headH
  breaks.push(y)
  rows.forEach((row, ri) => {
    const indent = row.depth * 16
    const cells = TABLE_COLS.map((c) => {
      const isName = c.kind === 'name'
      const f = isName ? body(13, row.body.kind === 'star' || row.body.kind === 'planet' ? 600 : 500) : c.kind === 'mono' ? mono(11.5) : body(12)
      const w = c.w - 14 - (isName ? indent + 12 : 0)
      return { c, f, lines: wrap(String(row[c.key]), f, w), isName }
    })
    const lh = 16
    const rowH = Math.max(32, Math.max(...cells.map((x) => x.lines.length)) * lh + 16)
    if (ri % 2 === 1) els.push(<rect key={`rb-${row.body.id}`} x={PAD} y={y} width={INNER} height={rowH} fill={T.panel} />)
    els.push(<rect key={`rl-${row.body.id}`} x={PAD} y={y + rowH - 1} width={INNER} height={1} fill={T.line} />)
    let x = PAD + 10
    for (const { c, f, lines, isName } of cells) {
      const value = lines.join(' ')
      const color = c.key === 'hazards' && value !== '–' ? T.danger : isName ? T.ink : T.ink2
      if (isName) {
        els.push(<circle key={`dot-${row.body.id}`} cx={x + indent + 3} cy={y + 15} r={3.2} fill={bodyColor(row.body)} />)
        if (row.depth > 0) els.push(<path key={`ind-${row.body.id}`} d={`M ${x + indent - 10} ${y} V ${y + 15} H ${x + indent - 3}`} stroke={T.lineStrong} fill="none" />)
      }
      els.push(<Lines key={`td-${row.body.id}-${c.key}`} x={x + (isName ? indent + 12 : 0)} y={y + 20} lines={lines} lh={lh} f={f} fill={color} />)
      x += c.w
    }
    y += rowH
    breaks.push(y)
  })

  const noteBodies = rows
    .map((r) => r.body)
    .filter((b) => b.notes.description || b.notes.resources || b.notes.pois || b.notes.rumors || (!playerMode && b.notes.gm))
  if (noteBodies.length) {
    y += 64
    els.push(<Lines key="nt" x={PAD} y={y} lines={[playerMode ? 'NOTES' : 'NOTES DU MENEUR']} lh={14} f={mono(11, 500)} fill={T.accent} spacing={2.4} />)
    y += 22
    breaks.push(y - 40)
    const gap = 24
    const cw = (INNER - gap * 2) / 3
    const colY = [y, y, y]
    const tw = cw - 32
    const lf = body(12.5)
    const cards: [number, number][] = []
    for (const b of noteBodies) {
      const fields: [string, string, boolean][] = [
        ['', b.notes.description, false],
        ['Ressources', b.notes.resources, false],
        ["Points d'intérêt", b.notes.pois, false],
        ['Rumeurs', b.notes.rumors, false],
      ]
      if (!playerMode && b.notes.gm) fields.push(['Secret', b.notes.gm, true])
      const blocks = fields.filter(([, v]) => v).map(([label, v, secret]) => ({ lines: wrap(label ? `${label} : ${v}` : v, lf, secret ? tw - 16 : tw), secret }))
      const titleSize = print ? 15 : 20
      const typeL = wrapMono(typeLabel(b), 9.5, 150, 0.1)
      const titleL = wrapDisp(b.name, titleSize, cw - 60 - 160)
      const headH = Math.max(titleL.length * (titleSize + 2), typeL.length * 13) + 34
      const h = headH + blocks.reduce((s, bl) => s + bl.lines.length * 18 + (bl.secret ? 22 : 8), 0) + 10
      const k = colY.indexOf(Math.min(...colY))
      const x = PAD + k * (cw + gap)
      const top = colY[k]
      const inner: ReactNode[] = [
        <rect key="bg" x={x} y={top} width={cw} height={h} rx={print ? 0 : 3} fill={T.panel} stroke={print ? T.ink : T.line} strokeWidth={print ? 1.5 : 1} />,
        <circle key="dot" cx={x + 20} cy={top + 25} r={4} fill={bodyColor(b)} />,
        <Lines key="n" x={x + 32} y={top + 31} lines={titleL} lh={titleSize + 2} f={disp(titleSize)} fill={T.ink} spacing={T.display.spacing * titleSize} />,
        <Lines key="t" x={x + cw - 16} y={top + 29} lines={typeL} lh={13} f={mono(9.5, 500)} fill={T.ink3} anchor="end" spacing={0.95} />,
      ]
      let ly = top + headH + 18
      blocks.forEach((bl, bi) => {
        if (bl.secret) {
          const sh = bl.lines.length * 18 + 12
          inner.push(<rect key={`sb${bi}`} x={x + 12} y={ly - 14} width={cw - 24} height={sh} rx={print ? 0 : 2} fill={print ? '#111' : 'rgba(240,132,112,0.08)'} stroke={print ? 'none' : 'rgba(240,132,112,0.35)'} />)
        }
        inner.push(
          <Lines key={`l${bi}`} x={x + (bl.secret ? 22 : 16)} y={ly + (bl.secret ? 2 : 0)} lines={bl.lines} lh={18} f={lf} fill={bl.secret ? (print ? '#f3f1ea' : '#f5b3a6') : T.ink2} />,
        )
        ly += bl.lines.length * 18 + (bl.secret ? 22 : 8)
      })
      els.push(<g key={`note-${b.id}`}>{inner}</g>)
      cards.push([top, top + h])
      colY[k] = top + h + gap
    }
    for (const [, bottom] of cards) {
      const cand = bottom + gap / 2
      if (!cards.some(([t, b2]) => cand > t && cand < b2)) breaks.push(cand)
    }
    y = Math.max(...colY)
  }

  y += 40
  breaks.push(y - 20)
  els.push(<rect key="hr4" x={PAD} y={y} width={INNER} height={1} fill={print ? T.ink : T.lineStrong} />)
  y += 28
  els.push(
    <g key="footer">
      <Lines x={PAD} y={y} lines={['ASTRA UNIVERSALIS']} lh={12} f={mono(10, 500)} fill={T.ink3} spacing={2} />
      <Lines
        x={SHEET_W / 2}
        y={y}
        lines={[`Date de campagne : ${formatSimDate(system.calendar.epochYear, time, false)}${playerMode ? '  ·  Version joueurs' : ''}`]}
        lh={12}
        f={mono(10)}
        fill={T.ink3}
        anchor="middle"
      />
      <Lines x={SHEET_W - PAD} y={y} lines={[`Généré le ${new Date().toLocaleDateString('fr-FR')}`]} lh={12} f={mono(10)} fill={T.ink3} anchor="end" />
    </g>,
  )
  const H = Math.ceil(y + 48)

  return (
    <svg
      ref={ref}
      data-astra-sheet=""
      data-breaks={breaks.map((b) => Math.round(b)).join(',')}
      xmlns="http://www.w3.org/2000/svg"
      width={SHEET_W}
      height={H}
      viewBox={`0 0 ${SHEET_W} ${H}`}
      style={{ display: 'block' }}
    >
      <rect width={SHEET_W} height={H} fill={T.bg} />
      <rect x={20} y={20} width={SHEET_W - 40} height={H - 40} rx={print ? 0 : 4} fill="none" stroke={print ? '#111' : T.lineStrong} strokeWidth={print ? 3 : 1} />
      {els}
    </svg>
  )
})
