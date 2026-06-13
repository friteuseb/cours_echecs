'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StaticBoard from './StaticBoard'
import {
  parseLichessCsv,
  parsePgnPositions,
  parseSolutionInput,
  sideToMove,
  uciLineToSan,
  type PgnPosition,
} from '@/lib/chess-utils'
import type { ImportPuzzleInput } from '@/lib/types'

type Tab = 'fen' | 'lichess' | 'pgn'

async function postPuzzles(puzzles: ImportPuzzleInput[]) {
  const res = await fetch('/api/puzzles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ puzzles }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Erreur serveur')
  return body as { created: number; errors: string[] }
}

export default function ImportTabs() {
  const [tab, setTab] = useState<Tab>('fen')
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Importer des problèmes</h1>
        <Link href="/" className="text-amber-400 hover:underline">← Retour à la bibliothèque</Link>
      </header>
      <nav className="flex gap-2">
        {([
          ['fen', 'Position FEN'],
          ['lichess', 'Puzzles Lichess (CSV)'],
          ['pgn', 'Partie PGN'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 font-semibold ${
              tab === t ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 hover:bg-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'fen' && <FenTab />}
      {tab === 'lichess' && <LichessTab />}
      {tab === 'pgn' && <PgnTab />}
    </div>
  )
}

function useSubmit() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(puzzles: ImportPuzzleInput[], goHome = false) {
    setBusy(true)
    setMessage(null)
    try {
      const { created, errors } = await postPuzzles(puzzles)
      setMessage(
        `✅ ${created} problème${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''}` +
          (errors.length ? ` — ${errors.length} erreur(s) : ${errors.slice(0, 3).join(' ; ')}` : '')
      )
      if (goHome && created > 0) router.push('/')
    } catch (e) {
      setMessage(`❌ ${e instanceof Error ? e.message : 'Erreur'}`)
    } finally {
      setBusy(false)
    }
  }
  return { busy, message, submit }
}

/** Onglet 1 : une position FEN + sa solution (SAN ou UCI) */
function FenTab() {
  const [fen, setFen] = useState('')
  const [solutionText, setSolutionText] = useState('')
  const [title, setTitle] = useState('')
  const { busy, message, submit } = useSubmit()

  const parsed = useMemo(() => {
    const f = fen.trim()
    if (!f) return null
    try {
      const uci = solutionText.trim() ? parseSolutionInput(f, solutionText) : []
      return { fen: f, uci, san: uci.length ? uciLineToSan(f, uci) : [], error: null as string | null }
    } catch (e) {
      return { fen: f, uci: [], san: [], error: e instanceof Error ? e.message : 'Erreur' }
    }
  }, [fen, solutionText])

  const ready = !!parsed && !parsed.error && parsed.uci.length > 0

  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex min-w-72 flex-1 flex-col gap-3">
        <label className="text-sm text-zinc-400" htmlFor="fen-input">Position FEN</label>
        <textarea
          id="fen-input"
          rows={2}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400"
          placeholder="r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"
          value={fen}
          onChange={(e) => setFen(e.target.value)}
        />
        <label className="text-sm text-zinc-400" htmlFor="sol-input">
          Solution — coups en notation anglaise (Qxf7#) ou UCI (h5f7), réponses de l&apos;adversaire incluses
        </label>
        <input
          id="sol-input"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono outline-none focus:border-amber-400"
          placeholder="Qxf7#  ou  h5f7"
          value={solutionText}
          onChange={(e) => setSolutionText(e.target.value)}
        />
        <label className="text-sm text-zinc-400" htmlFor="title-input">Titre (optionnel)</label>
        <input
          id="title-input"
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
          placeholder="Mat du berger"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
        {parsed?.error && <p className="text-sm text-red-400">{parsed.error}</p>}
        {ready && (
          <p className="text-sm text-green-400">
            Solution valide : <span className="font-mono">{parsed.san.join(' ')}</span>
          </p>
        )}
        <button
          disabled={!ready || busy}
          onClick={() => {
            if (!parsed) return
            submit([{ fen: parsed.fen, solution: parsed.uci.join(' '), title: title || undefined, source: 'manuel' }])
            setFen('')
            setSolutionText('')
            setTitle('')
          }}
          className="self-start rounded-lg bg-amber-500 px-6 py-2 font-bold text-zinc-950 disabled:opacity-40"
        >
          Ajouter à la bibliothèque
        </button>
        {message && <p className="text-sm">{message}</p>}
      </div>
      <div className="w-72">
        {parsed && !parsed.error ? (
          <>
            <StaticBoard fen={parsed.fen} orientation={sideToMove(parsed.fen)} />
            <p className="mt-2 text-center text-sm text-zinc-400">
              {sideToMove(parsed.fen) === 'white' ? 'Trait aux Blancs' : 'Trait aux Noirs'}
            </p>
          </>
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-600">
            Aperçu de la position
          </div>
        )}
      </div>
    </div>
  )
}

/** Onglet 2 : import du CSV de la base de puzzles Lichess */
function LichessTab() {
  const [text, setText] = useState('')
  const { busy, message, submit } = useSubmit()

  const parsed = useMemo(() => (text.trim() ? parseLichessCsv(text) : null), [text])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-zinc-400">
        Collez des lignes du fichier{' '}
        <a
          href="https://database.lichess.org/#puzzles"
          target="_blank"
          rel="noreferrer"
          className="text-amber-400 underline"
        >
          lichess_db_puzzle.csv
        </a>{' '}
        (ou sélectionnez le fichier). Format :{' '}
        <span className="font-mono text-xs">PuzzleId,FEN,Moves,Rating,…,Themes,…</span>
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-zinc-100"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) setText(await file.text())
        }}
      />
      <textarea
        rows={8}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs outline-none focus:border-amber-400"
        placeholder="00sHx,q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17,e8d7 a2e6 d7d8 f7f8,1760,80,83,72,mate mateIn2 middlegame short,https://lichess.org/yyznGmXs/black#34,"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {parsed && (
        <p className="text-sm">
          <span className="text-green-400">{parsed.puzzles.length} puzzle(s) reconnu(s)</span>
          {parsed.errors.length > 0 && (
            <span className="text-red-400"> — {parsed.errors.length} erreur(s) : {parsed.errors.slice(0, 3).join(' ; ')}</span>
          )}
        </p>
      )}
      <button
        disabled={!parsed || parsed.puzzles.length === 0 || busy}
        onClick={() => parsed && submit(parsed.puzzles, true)}
        className="self-start rounded-lg bg-amber-500 px-6 py-2 font-bold text-zinc-950 disabled:opacity-40"
      >
        {busy ? 'Import…' : `Importer ${parsed?.puzzles.length ?? 0} puzzle(s)`}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}

/** Onglet 3 : extraire un problème d'une partie PGN */
function PgnTab() {
  const [pgn, setPgn] = useState('')
  const [positions, setPositions] = useState<PgnPosition[] | null>(null)
  const [pgnError, setPgnError] = useState<string | null>(null)
  const [startPly, setStartPly] = useState<number | null>(null)
  const [solutionLength, setSolutionLength] = useState(1)
  const [title, setTitle] = useState('')
  const { busy, message, submit } = useSubmit()

  function parse() {
    try {
      const pos = parsePgnPositions(pgn)
      if (pos.length === 0) throw new Error('Aucun coup dans ce PGN')
      setPositions(pos)
      setStartPly(null)
      setPgnError(null)
    } catch (e) {
      setPositions(null)
      setPgnError(e instanceof Error ? e.message : 'PGN invalide')
    }
  }

  const start = positions && startPly !== null ? positions.find((p) => p.ply === startPly) : null
  const solutionUci = start ? start.remainingUci.slice(0, solutionLength) : []
  const maxLength = start ? start.remainingUci.length : 0

  return (
    <div className="flex flex-col gap-3">
      <p className="text-zinc-400">
        Collez une partie PGN, puis cliquez sur le coup <em>après lequel</em> commence le problème :
        la position affichée sera celle à deviner, les coups suivants formeront la solution.
      </p>
      <textarea
        rows={6}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs outline-none focus:border-amber-400"
        placeholder={'1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0'}
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
      />
      <button onClick={parse} className="self-start rounded-lg bg-zinc-800 px-4 py-2 hover:bg-zinc-700">
        Analyser le PGN
      </button>
      {pgnError && <p className="text-red-400">{pgnError}</p>}
      {positions && (
        <div className="flex flex-wrap gap-6">
          <div className="min-w-72 flex-1">
            <div className="flex max-h-64 flex-wrap content-start gap-1 overflow-y-auto rounded-lg border border-zinc-800 p-3">
              {positions.map((p) => (
                <button
                  key={p.ply}
                  onClick={() => setStartPly(p.ply)}
                  disabled={p.remainingUci.length === 0}
                  className={`rounded px-2 py-1 font-mono text-sm disabled:opacity-30 ${
                    startPly === p.ply ? 'bg-amber-500 text-zinc-950' : 'hover:bg-zinc-800'
                  }`}
                >
                  {p.ply % 2 === 1 ? `${Math.ceil(p.ply / 2)}.` : ''}
                  {p.san}
                </button>
              ))}
            </div>
            {start && (
              <div className="mt-3 flex flex-col gap-2">
                <label className="text-sm text-zinc-400" htmlFor="sol-length">
                  Longueur de la solution (demi-coups) : {solutionLength}
                </label>
                <input
                  id="sol-length"
                  type="range"
                  min={1}
                  max={maxLength}
                  value={solutionLength}
                  onChange={(e) => setSolutionLength(Number(e.target.value))}
                />
                <p className="font-mono text-sm text-green-400">
                  Solution : {uciLineToSan(start.fen, solutionUci).join(' ')}
                </p>
                <input
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
                  placeholder="Titre (optionnel)"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <button
                  disabled={busy || solutionUci.length === 0}
                  onClick={() =>
                    submit([
                      {
                        fen: start.fen,
                        solution: solutionUci.join(' '),
                        title: title || undefined,
                        source: 'pgn',
                      },
                    ])
                  }
                  className="self-start rounded-lg bg-amber-500 px-6 py-2 font-bold text-zinc-950 disabled:opacity-40"
                >
                  Ajouter à la bibliothèque
                </button>
              </div>
            )}
          </div>
          <div className="w-72">
            {start ? (
              <>
                <StaticBoard fen={start.fen} orientation={sideToMove(start.fen)} />
                <p className="mt-2 text-center text-sm text-zinc-400">
                  {sideToMove(start.fen) === 'white' ? 'Trait aux Blancs' : 'Trait aux Noirs'}
                </p>
              </>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-600">
                Cliquez sur un coup
              </div>
            )}
          </div>
        </div>
      )}
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}
