import { Component, type ReactNode } from 'react'
import { MonitorX, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
  attempt: number
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[Astra] Rendu interrompu :', error)
  }

  render() {
    if (!this.state.error) return <div key={this.state.attempt} className="contents">{this.props.children}</div>
    const webgl = /webgl|context/i.test(this.state.error.message)
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-void">
        <div className="glass max-w-[420px] rounded-2xl px-6 py-5 text-center">
          <MonitorX className="mx-auto size-7 text-nova" strokeWidth={1.5} />
          <div className="mt-2 font-display text-[20px] font-semibold tracking-wide">{this.props.label ?? 'La vue 3D a rencontré un problème'}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
            {webgl
              ? "Impossible d'initialiser WebGL (pilote graphique occupé ou désactivé). Fermez d'autres fenêtres 3D puis réessayez."
              : this.state.error.message}
          </p>
          <button
            onClick={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-white/[0.05] px-3.5 text-[12px] text-ink hover:bg-white/[0.09]"
          >
            <RotateCcw className="size-3.5" /> Réessayer
          </button>
        </div>
      </div>
    )
  }
}
