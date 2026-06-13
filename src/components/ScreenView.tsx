'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Chess } from 'chess.js'
import StaticBoard from './StaticBoard'
import { usePoll } from './usePoll'
import { uciToMove } from '@/lib/chess-utils'
import type { ScreenState } from '@/lib/types'

interface ScreenViewProps {
  code: string
}

const noopSubscribe = () => () => {}

/** Vue projecteur du prof : QR code, échiquier géant, chrono, résultats, pilotage. */
export default function ScreenView({ code }: ScreenViewProps) {
  const { data: state, error } = usePoll<ScreenState>(`/api/sessions/${code}/screen`, 1200)
  // URL à encoder dans le QR code : connue côté client uniquement
  const joinUrl = useSyncExternalStore(
    noopSubscribe,
    () => `${window.location.origin}/jouer/${code}`,
    () => ''
  )

  // Pas de relecture de la solution, remis à zéro à chaque nouveau problème
  const [stepState, setStepState] = useState({ key: -1, step: 0 })
  const stepKey = state?.currentIndex ?? -1
  if (stepState.key !== stepKey) {
    setStepState({ key: stepKey, step: 0 })
  }
  const solutionStep = stepState.key === stepKey ? stepState.step : 0
  const setSolutionStep = useCallback(
    (next: (s: number) => number) =>
      setStepState((prev) => ({ key: prev.key, step: next(prev.step) })),
    []
  )

  const advance = useCallback(
    async (action: 'start' | 'reveal' | 'next' | 'finish') => {
      await fetch(`/api/sessions/${code}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
    },
    [code]
  )

  // Le chrono déclenche automatiquement le reveal à zéro
  // (le composant Countdown garantit un seul déclenchement par question)
  const handleTimeUp = useCallback(() => {
    advance('reveal')
  }, [advance])

  if (error) return <Centered><p className="text-2xl text-red-400">{error}</p></Centered>
  if (!state) return <Centered><p className="animate-pulse text-2xl text-zinc-400">Chargement…</p></Centered>

  if (state.status === 'lobby') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-8">
        <h1 className="text-4xl font-bold">♟️ {state.name ?? 'Tempête sur l’échiquier'}</h1>
        <div className="flex flex-wrap items-center justify-center gap-12">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6">
            {joinUrl && <QRCodeSVG value={joinUrl} size={280} />}
            <p className="font-mono text-sm text-zinc-700">{joinUrl}</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <p className="text-2xl text-zinc-300">Code de la partie</p>
            <p className="font-mono text-7xl font-bold tracking-widest text-amber-400">{state.code}</p>
            <p className="text-xl text-zinc-400">
              {state.players.length} joueur{state.players.length > 1 ? 's' : ''} connecté
              {state.players.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex max-w-3xl flex-wrap justify-center gap-2">
          {state.players.map((p) => (
            <span key={p.id} className="rounded-full bg-zinc-800 px-4 py-1.5 text-lg">
              {p.name}
            </span>
          ))}
        </div>
        <button
          onClick={() => advance('start')}
          disabled={state.players.length === 0}
          className="rounded-xl bg-amber-500 px-10 py-4 text-2xl font-bold text-zinc-950 disabled:opacity-40"
        >
          🚀 Démarrer ({state.totalPuzzles} problème{state.totalPuzzles > 1 ? 's' : ''})
        </button>
      </div>
    )
  }

  if (state.status === 'finished') {
    const podium = state.players.slice(0, 3)
    const medals = ['🥇', '🥈', '🥉']
    return (
      <Centered>
        <h1 className="text-5xl font-bold">🏆 Classement final</h1>
        <div className="flex items-end gap-8 py-8">
          {podium.map((p, i) => (
            <div key={p.id} className={`flex flex-col items-center gap-2 ${i === 0 ? 'order-2 scale-125' : i === 1 ? 'order-1' : 'order-3'}`}>
              <span className="text-6xl">{medals[i]}</span>
              <span className="text-2xl font-bold">{p.name}</span>
              <span className="font-mono text-xl text-amber-400">{p.score} pts</span>
            </div>
          ))}
        </div>
        <ol className="w-full max-w-md divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-lg">
          {state.players.slice(3).map((p, i) => (
            <li key={p.id} className="flex justify-between px-4 py-2">
              <span>{i + 4}. {p.name}</span>
              <span className="font-mono">{p.score}</span>
            </li>
          ))}
        </ol>
      </Centered>
    )
  }

  const isReveal = state.status === 'reveal'
  const answered = state.answers.filter((a) => a.status !== 'playing')
  const corrects = answered.filter((a) => a.status === 'correct')

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Problème {state.currentIndex + 1}/{state.totalPuzzles}
          {state.puzzleTitle && <span className="ml-3 text-zinc-400">{state.puzzleTitle}</span>}
        </h1>
        <div className="flex items-center gap-4">
          {!isReveal && state.questionStartedAt && (
            <Countdown
              startedAt={state.questionStartedAt}
              timeLimit={state.timeLimit}
              onTimeUp={handleTimeUp}
            />
          )}
          <span className="rounded-lg bg-zinc-800 px-4 py-2 font-mono text-xl">
            {answered.length}/{state.players.length} 📱
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-wrap items-start justify-center gap-8">
        <div className="w-full max-w-[min(70dvh,600px)]">
          {state.fen && state.orientation && (
            <RevealBoard state={state} isReveal={isReveal} step={solutionStep} />
          )}
          {!isReveal && state.orientation && (
            <p className="mt-3 text-center text-2xl font-semibold">
              {state.orientation === 'white' ? '⬜ Les Blancs jouent' : '⬛ Les Noirs jouent'}
            </p>
          )}
        </div>

        <aside className="flex w-80 flex-col gap-4">
          {isReveal ? (
            <>
              <div className="rounded-xl border border-zinc-800 p-4">
                <h3 className="mb-2 text-lg font-bold text-amber-400">Solution</h3>
                <p className="font-mono text-xl">{state.solutionSan?.join(' ')}</p>
                {state.solutionUci && state.solutionUci.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="rounded bg-zinc-800 px-3 py-1.5 disabled:opacity-30"
                      disabled={solutionStep === 0}
                      onClick={() => setSolutionStep((s) => Math.max(0, s - 1))}
                    >
                      ◀
                    </button>
                    <span className="text-sm text-zinc-400">
                      {solutionStep}/{state.solutionUci.length}
                    </span>
                    <button
                      className="rounded bg-zinc-800 px-3 py-1.5 disabled:opacity-30"
                      disabled={solutionStep >= state.solutionUci.length}
                      onClick={() => setSolutionStep((s) => s + 1)}
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800 p-4">
                <h3 className="mb-2 text-lg font-bold">
                  ✅ {corrects.length}/{state.players.length} ont trouvé
                </h3>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                  {[...answered]
                    .sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0))
                    .map((a) => (
                      <li key={a.playerName} className="flex justify-between">
                        <span>
                          {a.status === 'correct' ? '✅' : '❌'} {a.playerName}
                        </span>
                        <span className="font-mono text-zinc-400">
                          {a.status === 'correct'
                            ? `${((a.timeMs ?? 0) / 1000).toFixed(1)}s · +${a.score}`
                            : ''}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-800 p-4">
                <h3 className="mb-2 text-lg font-bold">🏆 Classement</h3>
                <ol className="space-y-1">
                  {state.players.slice(0, 5).map((p, i) => (
                    <li key={p.id} className="flex justify-between">
                      <span>{i + 1}. {p.name}</span>
                      <span className="font-mono text-amber-400">{p.score}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <button
                onClick={() => advance('next')}
                className="rounded-xl bg-amber-500 px-6 py-3 text-xl font-bold text-zinc-950"
              >
                {state.currentIndex + 1 < state.totalPuzzles ? 'Problème suivant ▶' : 'Voir le classement final 🏆'}
              </button>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-zinc-800 p-4 text-center">
                <p className="text-5xl font-bold">{answered.length}</p>
                <p className="text-zinc-400">réponses reçues</p>
              </div>
              <button
                onClick={() => advance('reveal')}
                className="rounded-xl bg-amber-500 px-6 py-3 text-xl font-bold text-zinc-950"
              >
                Révéler la solution 👁
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

/** Échiquier qui rejoue la solution pas à pas pendant le reveal */
function RevealBoard({ state, isReveal, step }: { state: ScreenState; isReveal: boolean; step: number }) {
  const { fen, displayed } = useMemo(() => {
    if (!state.fen) return { fen: '', displayed: null as string | null }
    if (!isReveal || !state.solutionUci) return { fen: state.fen, displayed: null }
    const chess = new Chess(state.fen)
    let last: string | null = null
    for (let i = 0; i < step && i < state.solutionUci.length; i++) {
      chess.move(uciToMove(state.solutionUci[i]))
      last = state.solutionUci[i]
    }
    return { fen: chess.fen(), displayed: last }
  }, [state.fen, state.solutionUci, isReveal, step])

  return <StaticBoard fen={fen} orientation={state.orientation ?? 'white'} highlightUci={displayed} />
}

function Countdown({
  startedAt,
  timeLimit,
  onTimeUp,
}: {
  startedAt: string
  timeLimit: number
  onTimeUp: () => void
}) {
  const [remaining, setRemaining] = useState(timeLimit)
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    const start = new Date(startedAt).getTime()
    function update() {
      const left = Math.max(0, timeLimit - (Date.now() - start) / 1000)
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        onTimeUp()
      }
    }
    update()
    const id = setInterval(update, 250)
    return () => clearInterval(id)
  }, [startedAt, timeLimit, onTimeUp])

  const secs = Math.ceil(remaining)
  return (
    <span
      className={`rounded-lg px-4 py-2 font-mono text-3xl font-bold ${
        secs <= 10 ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-amber-400'
      }`}
    >
      ⏱ {secs}s
    </span>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      {children}
    </div>
  )
}
