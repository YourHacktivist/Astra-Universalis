export function hashString(str: string): number {
  let h1 = 0xdeadbeef ^ 0
  let h2 = 0x41c6ce57 ^ 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 ^ h2) >>> 0
}

function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a |= 0
    b |= 0
    c |= 0
    d |= 0
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

export class Rng {
  private next: () => number
  readonly seed: number

  constructor(seed: number | string) {
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0
    this.seed = s
    this.next = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, s)
    for (let i = 0; i < 12; i++) this.next()
  }

  float(): number {
    return this.next()
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }
  int(min: number, max: number): number {
    return Math.floor(min + (max - min + 1) * this.next())
  }
  bool(p = 0.5): boolean {
    return this.next() < p
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0
    for (const [, w] of items) total += w
    let r = this.next() * total
    for (const [item, w] of items) {
      r -= w
      if (r <= 0) return item
    }
    return items[items.length - 1][0]
  }
  gaussian(mean = 0, sd = 1): number {
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  logRange(min: number, max: number): number {
    return Math.exp(this.range(Math.log(min), Math.log(max)))
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
  fork(label = ''): Rng {
    return new Rng((Math.floor(this.next() * 4294967296) ^ hashString(label)) >>> 0)
  }
  seed31(): number {
    return Math.floor(this.next() * 2147483647)
  }
}

export function randomSeedString(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  const buf = new Uint32Array(8)
  crypto.getRandomValues(buf)
  for (let i = 0; i < 8; i++) s += alphabet[buf[i] % alphabet.length]
  return s.slice(0, 4) + '-' + s.slice(4)
}
