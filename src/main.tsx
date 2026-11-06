import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import './styles/index.css'
import { App } from './App'
import { splashDone, splashStep } from './lib/splash'

const params = new URLSearchParams(location.search)
const lab = params.get('lab')

async function start() {
  const root = createRoot(document.getElementById('root')!)
  splashStep('Initialisation de l’atlas', 0.4)
  if (lab) {
    splashDone()
    const labs = import.meta.glob('./labs/*Lab.tsx')
    const key = Object.keys(labs).find((k) => k.toLowerCase().endsWith(`/${lab.toLowerCase()}lab.tsx`))
    if (key) {
      const mod = (await labs[key]()) as { default: React.ComponentType }
      const Lab = mod.default
      root.render(<Lab />)
      return
    }
    root.render(
      <div style={{ padding: 24, color: '#e8eaf1', fontFamily: 'monospace' }}>
        Lab inconnu « {lab} ». Disponibles : {Object.keys(labs).map((k) => k.split('/').pop()).join(', ')}
      </div>,
    )
    return
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
