const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export function uid(prefix = ''): string {
  const buf = new Uint8Array(12)
  crypto.getRandomValues(buf)
  let s = ''
  for (let i = 0; i < buf.length; i++) s += ALPHABET[buf[i] % ALPHABET.length]
  return prefix ? `${prefix}_${s}` : s
}
