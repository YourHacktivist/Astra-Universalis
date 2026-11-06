const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

export function prefersReducedMotion(): boolean {
  return !!query?.matches
}
