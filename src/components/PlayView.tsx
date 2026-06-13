'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { Chess } from 'chess.js'
import QuizBoard from './QuizBoard'
import { usePoll } from './usePoll'
import { uciToMove } from '@/lib/chess-utils'
import type { MoveResult, StudentState } from '@/lib/types'

interface PlayViewProps {
  code: string
}

interface StoredPlayer {
  playerId: string
  name: string
}

const PLAYER_CHANGE_EVENT = 'tse-player-change'

/** Identité du joueur conservée dans localStorage (survit au rechargement de la page) */
function usePlayerStorage(storageKey: string) {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(PLAYER_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(PLAYER_CHANGE_EVENT, onChange)
  }, [])
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(storageKey),
    () => null
  )
  const player = useMemo<StoredPlayer | null>(() => {
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }, [raw])
  const setPlayer = useCallback(
    (p: StoredPlayer) => {
      localStorage.setItem(storageKey, JSON.stringify(p))
      window.dispatchEvent(new Event(PLAYER_CHANGE_EVENT))
    },
    [storageKey]
  )
  return { player, setPlayer }
}

/** Vue téléphone de l'élève : rejoindre, jouer, voir son résultat. */
export default function PlayView({ code }: PlayViewProps) {
  const { player, setPlayer } = usePlayerStorage(`tse-player-${code}`)
  const [nameInput, setNameInput] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  // Coups joués localement pour la question en cours (optimiste)
  const [localMoves, setLocalMoves] = useState<string[]>([])
  const [localStatus, setLocalStatus] = useState<'playing' | 'correct' | 'wrong'>('playing')
  const [earnedScore, setEarnedScore] = useState(0)
  const [seenIndex, setSeenIndex] = useState(-1)

  const pollUrl = player
    ? `/api/sessions/${code}?playerId=${encodeURIComponent(player.playerId)}`
    : null
  const { data: state, error: pollError } = usePoll<StudentState>(pollUrl, 1500)

  // Nouvelle question : on remet l'état local à zéro (ajustement d'état pendant le rendu)
  if (state && state.status === 'question' && state.currentIndex !== seenIndex) {
    setSeenIndex(state.currentIndex)
    setLocalMoves(state.answer?.movesPlayed ? state.answer.movesPlayed.split(' ') : [])
    setLocalStatus(
      state.answer?.status === 'correct' ? 'correct'
      : state.answer?.status === 'wrong' ? 'wrong'
      : 'playing'
    )
    setEarnedScore(state.answer?.score ?? 0)
  }

  let displayFen: string | null = null
  if (state?.fen) {
    const chess = new Chess(state.fen)
    for (const uci of localMoves) {
      try {
        chess.move(uciToMove(uci))
      } catch {
        break
      }
    }
    displayFen = chess.fen()
  }

  async function join() {
    const name = nameInput.trim()
    if (!name) return
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch(`/api/sessions/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const body = await res.json()
      if (!res.ok) {
        setJoinError(body.error ?? 'Impossible de rejoindre')
        return
      }
      setPlayer({ playerId: body.playerId, name })
    } catch {
      setJoinError('Erreur réseau, réessayez')
    } finally {
      setJoining(false)
    }
  }

  const handleMove = useCallback(
    async (uci: string) => {
      if (!player || localStatus !== 'playing') return
      setLocalMoves((prev) => [...prev, uci])
      try {
        const res = await fetch(`/api/sessions/${code}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: player.playerId, move: uci }),
        })
        const result: MoveResult = await res.json()
        if (result.result === 'wrong') {
          setLocalStatus('wrong')
        } else if (result.result === 'solved') {
          setLocalStatus('correct')
          setEarnedScore(result.score)
        } else if (result.result === 'continue' && result.reply) {
          const reply = result.reply
          setTimeout(() => setLocalMoves((prev) => [...prev, reply]), 350)
        } else if (result.result === 'closed') {
          // La question est fermée (temps écoulé ou déjà répondu) : on retire le coup optimiste
          setLocalMoves((prev) => prev.slice(0, -1))
        }
      } catch {
        setLocalMoves((prev) => prev.slice(0, -1))
      }
    },
    [code, player, localStatus]
  )

  // --- Rendu ---

  if (!player) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-3xl font-bold">♟️ Tempête sur l&apos;échiquier</h1>
        <p className="text-zinc-400">Session <span className="font-mono font-bold text-amber-400">{code}</span></p>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <input
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg outline-none focus:border-amber-400"
            placeholder="Ton prénom"
            value={nameInput}
            maxLength={30}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button
            onClick={join}
            disabled={joining || !nameInput.trim()}
            className="rounded-lg bg-amber-500 px-4 py-3 text-lg font-bold text-zinc-950 disabled:opacity-40"
          >
            {joining ? 'Connexion…' : 'Rejoindre la partie'}
          </button>
          {joinError && <p className="text-center text-red-400">{joinError}</p>}
        </div>
      </div>
    )
  }

  if (pollError) {
    return (
      <Centered>
        <p className="text-red-400">{pollError}</p>
      </Centered>
    )
  }
  if (!state) {
    return (
      <Centered>
        <p className="animate-pulse text-zinc-400">Chargement…</p>
      </Centered>
    )
  }

  if (state.status === 'lobby') {
    return (
      <Centered>
        <h2 className="text-2xl font-bold">Bienvenue {player.name} !</h2>
        <p className="animate-pulse text-zinc-400">En attente du début de la partie…</p>
      </Centered>
    )
  }

  if (state.status === 'finished') {
    const me = state.leaderboard?.findIndex((p) => p.id === player.playerId) ?? -1
    return (
      <Centered>
        <h2 className="text-3xl font-bold">🏁 Partie terminée !</h2>
        {me >= 0 && state.leaderboard && (
          <p className="text-xl">
            Tu finis <span className="font-bold text-amber-400">{me + 1}ᵉ</span> avec{' '}
            <span className="font-bold">{state.leaderboard[me].score}</span> points
          </p>
        )}
        <Leaderboard state={state} highlightId={player.playerId} />
      </Centered>
    )
  }

  if (state.status === 'reveal') {
    return (
      <div className="flex min-h-dvh flex-col items-center gap-4 p-4">
        <h2 className="text-xl font-bold">
          {localStatus === 'correct' && <span className="text-green-400">✅ Bien joué ! +{earnedScore} pts</span>}
          {localStatus === 'wrong' && <span className="text-red-400">❌ Raté…</span>}
          {localStatus === 'playing' && <span className="text-zinc-400">⏱️ Temps écoulé</span>}
        </h2>
        {state.solutionSan && (
          <p className="text-lg">
            Solution : <span className="font-mono font-bold text-amber-400">{state.solutionSan.join(' ')}</span>
          </p>
        )}
        <Leaderboard state={state} highlightId={player.playerId} />
        <p className="animate-pulse text-sm text-zinc-500">En attente de la question suivante…</p>
      </div>
    )
  }

  // status === 'question'
  return (
    <div className="flex min-h-dvh flex-col items-center gap-3 p-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm text-zinc-400">
        <span>
          Problème {state.currentIndex + 1}/{state.totalPuzzles}
        </span>
        <span>{player.name}</span>
      </div>
      {state.orientation && (
        <p className="font-semibold">
          {localStatus === 'playing' &&
            (state.orientation === 'white' ? '⬜ Les Blancs jouent' : '⬛ Les Noirs jouent')}
          {localStatus === 'correct' && <span className="text-green-400">✅ Trouvé ! +{earnedScore} pts</span>}
          {localStatus === 'wrong' && <span className="text-red-400">❌ Mauvais coup…</span>}
        </p>
      )}
      <div className="w-full max-w-md">
        {displayFen && state.orientation && (
          <QuizBoard
            fen={displayFen}
            orientation={state.orientation}
            interactive={localStatus === 'playing'}
            onMove={handleMove}
          />
        )}
      </div>
      {localStatus !== 'playing' && (
        <p className="animate-pulse text-sm text-zinc-500">En attente des autres joueurs…</p>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </div>
  )
}

function Leaderboard({ state, highlightId }: { state: StudentState; highlightId: string }) {
  if (!state.leaderboard) return null
  return (
    <ol className="w-full max-w-sm divide-y divide-zinc-800 rounded-lg border border-zinc-800">
      {state.leaderboard.slice(0, 10).map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center justify-between px-4 py-2 ${
            p.id === highlightId ? 'bg-amber-500/10 font-bold text-amber-300' : ''
          }`}
        >
          <span>
            {i + 1}. {p.name}
          </span>
          <span className="font-mono">{p.score}</span>
        </li>
      ))}
    </ol>
  )
}
