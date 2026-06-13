'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'

type Color = 'white' | 'black'
type PieceType = string // ex : "wP", "bK"
/** Placement libre : case -> type de pièce. Permet des positions illégales (utile en cours). */
type Placement = Record<string, PieceType>

const ALL_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

const WHITE_PALETTE: PieceType[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP']
const BLACK_PALETTE: PieceType[] = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

const PIECE_GLYPH: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
}

/** Construit une FEN à partir d'un placement libre + camp au trait. */
function placementToFen(board: Placement, turn: 'w' | 'b'): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (const file of ALL_FILES) {
      const piece = board[`${file}${rank}`]
      if (!piece) {
        empty++
        continue
      }
      if (empty) {
        row += empty
        empty = 0
      }
      const letter = piece[1]
      row += piece[0] === 'w' ? letter.toUpperCase() : letter.toLowerCase()
    }
    if (empty) row += empty
    rows.push(row)
  }
  // Droits de roque déduits des positions standard (roi + tour sur leurs cases d'origine)
  let castling = ''
  if (board['e1'] === 'wK') {
    if (board['h1'] === 'wR') castling += 'K'
    if (board['a1'] === 'wR') castling += 'Q'
  }
  if (board['e8'] === 'bK') {
    if (board['h8'] === 'bR') castling += 'k'
    if (board['a8'] === 'bR') castling += 'q'
  }
  return `${rows.join('/')} ${turn} ${castling || '-'} - 0 1`
}

/** Décompose la partie « placement » d'une FEN en map case -> type de pièce. */
function fenToPlacement(fen: string): Placement {
  const board: Placement = {}
  const placement = fen.split(' ')[0]
  const ranks = placement.split('/')
  ranks.forEach((rankStr, i) => {
    const rank = 8 - i
    let fileIdx = 0
    for (const ch of rankStr) {
      if (/\d/.test(ch)) {
        fileIdx += Number(ch)
        continue
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b'
      const square = `${ALL_FILES[fileIdx]}${rank}`
      board[square] = color + ch.toUpperCase()
      fileIdx++
    }
  })
  return board
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/**
 * Échiquier libre pour le tableau du prof.
 * – Mode Analyse : on déplace les pièces par coups légaux (les deux camps), pour montrer une variante.
 * – Mode Édition : palette « clic pour poser », on compose n'importe quelle position (même illégale).
 */
export default function FreeBoard() {
  const [mode, setMode] = useState<'play' | 'edit'>('play')
  const [orientation, setOrientation] = useState<Color>('white')

  // --- Mode Analyse ---
  const [fen, setFen] = useState(START_FEN)
  const [history, setHistory] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  // --- Mode Édition ---
  const [board, setBoard] = useState<Placement>(() => fenToPlacement(START_FEN))
  const [editTurn, setEditTurn] = useState<'w' | 'b'>('w')
  const [tool, setTool] = useState<PieceType | 'move' | 'erase'>('move')

  // Champ FEN partagé
  const [fenInput, setFenInput] = useState(START_FEN)
  const [message, setMessage] = useState<string | null>(null)

  const chess = useMemo(() => {
    if (mode !== 'play') return null
    try {
      return new Chess(fen)
    } catch {
      return null
    }
  }, [mode, fen])

  const currentFen = mode === 'play' ? fen : placementToFen(board, editTurn)

  const legalTargets = useMemo(() => {
    if (mode !== 'play' || !chess || !selected) return new Set<string>()
    return new Set(chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to))
  }, [mode, chess, selected])

  // --- Actions Analyse ---
  function tryMove(from: string, to: string): boolean {
    try {
      const probe = new Chess(fen)
      probe.move({ from, to, promotion: 'q' })
      setHistory((h) => [...h, fen])
      setFen(probe.fen())
      setSelected(null)
      setMessage(null)
      return true
    } catch {
      return false
    }
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h
      const next = [...h]
      const prev = next.pop()!
      setFen(prev)
      setSelected(null)
      return next
    })
  }

  // --- Actions Édition ---
  function placeOrErase(square: string) {
    setBoard((b) => {
      const next = { ...b }
      if (tool === 'erase') delete next[square]
      else if (tool !== 'move') next[square] = tool
      return next
    })
  }

  function editDrop(from: string, to: string | null) {
    setBoard((b) => {
      const next = { ...b }
      const piece = next[from]
      if (!piece) return b
      delete next[from]
      if (to) next[to] = piece // sinon : glissé hors plateau = retiré
      return next
    })
    return true
  }

  // --- Transitions / chargement ---
  function goPlay() {
    const built = placementToFen(board, editTurn)
    try {
      const game = new Chess(built)
      setFen(game.fen())
      setFenInput(game.fen())
      setHistory([])
      setSelected(null)
      setMessage(null)
      setMode('play')
    } catch (e) {
      setMessage(
        `Position non jouable en analyse (${e instanceof Error ? e.message : 'FEN invalide'}). ` +
          'Vérifiez qu’il y a un roi par camp et aucune position impossible.'
      )
    }
  }

  function goEdit() {
    setBoard(fenToPlacement(currentFen))
    setEditTurn(currentFen.split(' ')[1] === 'b' ? 'b' : 'w')
    setTool('move')
    setMessage(null)
    setMode('edit')
  }

  function loadFen() {
    const value = fenInput.trim()
    if (!value) return
    try {
      const game = new Chess(value)
      setFen(game.fen())
      setFenInput(game.fen())
      setHistory([])
      setSelected(null)
      setMessage(null)
      setMode('play')
    } catch {
      // FEN incomplète ou illégale : on bascule en édition pour la composer
      setBoard(fenToPlacement(value))
      setEditTurn(value.split(' ')[1] === 'b' ? 'b' : 'w')
      setTool('move')
      setMode('edit')
      setMessage('Position chargée en mode Édition (non jouable telle quelle).')
    }
  }

  function resetStart() {
    setFen(START_FEN)
    setFenInput(START_FEN)
    setBoard(fenToPlacement(START_FEN))
    setEditTurn('w')
    setHistory([])
    setSelected(null)
    setMessage(null)
  }

  function clearBoard() {
    setBoard({})
    setTool('wK')
    setMessage('Plateau vidé. Choisissez une pièce dans la palette pour composer la position.')
  }

  async function copyFen() {
    try {
      await navigator.clipboard.writeText(currentFen)
      setMessage('FEN copiée dans le presse-papier.')
    } catch {
      setMessage('Copie impossible — sélectionnez la FEN manuellement.')
    }
  }

  // Surbrillances
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (mode === 'play' && selected) {
    squareStyles[selected] = { backgroundColor: 'rgba(250, 204, 21, 0.55)' }
    for (const sq of legalTargets) {
      squareStyles[sq] = {
        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.5) 22%, transparent 24%)',
      }
    }
  }

  const status = (() => {
    if (mode === 'edit') return 'Mode édition — composez la position'
    if (!chess) return 'Position invalide'
    if (chess.isCheckmate()) return `Échec et mat — ${chess.turn() === 'w' ? 'les Noirs gagnent' : 'les Blancs gagnent'}`
    if (chess.isStalemate()) return 'Pat — partie nulle'
    if (chess.isCheck()) return `Échec — trait aux ${chess.turn() === 'w' ? 'Blancs' : 'Noirs'}`
    return `Trait aux ${chess.turn() === 'w' ? 'Blancs' : 'Noirs'}`
  })()

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">♟️ Échiquier libre</h1>
          <p className="text-zinc-400">
            Montrez une position au tableau et déplacez les pièces en direct.
          </p>
        </div>
        <Link href="/" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
          ← Retour à la bibliothèque
        </Link>
      </header>

      {/* Bascule de mode */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-zinc-700 p-1">
          <button
            onClick={() => (mode === 'play' ? null : goPlay())}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
              mode === 'play' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            ▶ Analyse
          </button>
          <button
            onClick={() => (mode === 'edit' ? null : goEdit())}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
              mode === 'edit' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            ✎ Édition
          </button>
        </div>
        <span className="text-sm text-zinc-400">{status}</span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Échiquier */}
        <div className="w-full max-w-xl">
          <Chessboard
            options={{
              position: currentFen,
              boardOrientation: orientation,
              allowDragging: true,
              allowDragOffBoard: mode === 'edit',
              squareStyles,
              showAnimations: true,
              animationDurationInMs: 200,
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (mode === 'edit') return editDrop(sourceSquare, targetSquare)
                if (!targetSquare) return false
                return tryMove(sourceSquare, targetSquare)
              },
              onSquareClick: ({ square, piece }) => {
                if (mode === 'edit') {
                  if (tool === 'move') return
                  placeOrErase(square)
                  return
                }
                if (!chess) return
                if (selected && legalTargets.has(square)) {
                  tryMove(selected, square)
                  return
                }
                const turnColor = chess.turn()
                if (piece && piece.pieceType.startsWith(turnColor)) setSelected(square)
                else setSelected(null)
              },
            }}
          />
        </div>

        {/* Panneau latéral */}
        <div className="flex flex-1 flex-col gap-4">
          {mode === 'edit' ? (
            <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-sm text-zinc-400">
                Cliquez une pièce puis cliquez une case pour la poser. Glissez les pièces pour les
                déplacer, ou hors du plateau pour les retirer.
              </p>
              <div className="flex flex-col gap-2">
                <PaletteRow tools={WHITE_PALETTE} current={tool} onPick={setTool} />
                <PaletteRow tools={BLACK_PALETTE} current={tool} onPick={setTool} />
                <div className="flex gap-2">
                  <ToolButton active={tool === 'move'} onClick={() => setTool('move')} title="Déplacer">
                    ✋ Déplacer
                  </ToolButton>
                  <ToolButton active={tool === 'erase'} onClick={() => setTool('erase')} title="Gommer">
                    🧽 Gommer
                  </ToolButton>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-sm text-zinc-400">Trait aux :</span>
                <div className="inline-flex rounded-lg border border-zinc-700 p-1">
                  <button
                    onClick={() => setEditTurn('w')}
                    className={`rounded-md px-3 py-1 text-sm ${editTurn === 'w' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300'}`}
                  >
                    Blancs
                  </button>
                  <button
                    onClick={() => setEditTurn('b')}
                    className={`rounded-md px-3 py-1 text-sm ${editTurn === 'b' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300'}`}
                  >
                    Noirs
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={clearBoard} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
                  Vider le plateau
                </button>
                <button onClick={goPlay} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950">
                  ▶ Passer en analyse
                </button>
              </div>
            </section>
          ) : (
            <section className="flex flex-wrap gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-30"
              >
                ↩ Annuler le coup
              </button>
              <button onClick={goEdit} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
                ✎ Modifier la position
              </button>
            </section>
          )}

          {/* Outils communs */}
          <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
              >
                ⇅ Retourner l’échiquier
              </button>
              <button onClick={resetStart} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
                ⟲ Position de départ
              </button>
              <button onClick={copyFen} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
                ⧉ Copier la FEN
              </button>
            </div>
            <label className="text-sm text-zinc-400" htmlFor="fen-input">
              FEN
            </label>
            <textarea
              id="fen-input"
              rows={2}
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              spellCheck={false}
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs outline-none focus:border-amber-400"
            />
            <div className="flex items-center gap-2">
              <button onClick={loadFen} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950">
                Charger la FEN
              </button>
              <button
                onClick={() => setFenInput(currentFen)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                title="Recopier la FEN du plateau dans le champ"
              >
                ↺ FEN actuelle
              </button>
            </div>
          </section>

          {message && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PaletteRow({
  tools,
  current,
  onPick,
}: {
  tools: PieceType[]
  current: PieceType | 'move' | 'erase'
  onPick: (t: PieceType) => void
}) {
  return (
    <div className="flex gap-2">
      {tools.map((t) => (
        <button
          key={t}
          onClick={() => onPick(t)}
          title={t}
          className={`flex h-11 w-11 items-center justify-center rounded-lg border text-2xl leading-none transition ${
            current === t
              ? 'border-amber-400 bg-amber-500/15'
              : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
          }`}
        >
          {PIECE_GLYPH[t]}
        </button>
      ))}
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg border px-3 py-2 text-sm transition ${
        active ? 'border-amber-400 bg-amber-500/15' : 'border-zinc-700 hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  )
}
