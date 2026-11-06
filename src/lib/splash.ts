interface SplashApi {
  step(label: string, progress: number): void
  done(): void
}

declare global {
  interface Window {
    __astraSplash?: SplashApi
  }
}

export function splashStep(label: string, progress: number) {
  window.__astraSplash?.step(label, progress)
}

export function splashDone() {
  if (window.__astraSplash) window.__astraSplash.done()
  else document.getElementById('astra-splash')?.remove()
}
