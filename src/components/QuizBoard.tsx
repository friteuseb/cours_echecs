'use client'

import { useMemo, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'

interface QuizBoardProps {
  fen: string
  orientation: 'white' | 'black'
  interactive: boolean
  /** Appelé avec le coup UCI quand l'élève joue un coup légal */
  onMove: (uci: string) => void
}

/**
 * Échiquier interactif pour le téléphone de l'élève.
 * Supporte le glisser-déposer ET le tap-tap (plus pratique sur mobile).
 * Promotion automatique en dame pour rester simple.
 */
export default function QuizBoard({ fen, orientation, interactive, onMove }: QuizBoardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const chess = useMemo(() => new Chess(fen), [fen])

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<string>()
    return new Set(
      chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to as string)
    )
  }, [chess, selected])

  function buildUci(from: string, to: string): string | null {
    try {
      const probe = new Chess(fen)
      const move = probe.move({ from, to, promotion: 'q' })
      return move.from + move.to + (move.promotion ?? '')
    } catch {
      return null
    }
  }

  function tryMove(from: string, to: string): boolean {
    const uci = buildUci(from, to)
    if (!uci) return false
    setSelected(null)
    onMove(uci)
    return true
  }

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (selected) {
    squareStyles[selected] = { backgroundColor: 'rgba(250, 204, 21, 0.55)' }
    for (const sq of legalTargets) {
      squareStyles[sq] = {
        background:
          'radial-gradient(circle, rgba(34, 197, 94, 0.5) 22%, transparent 24%)',
      }
    }
  }

  return (
    <Chessboard
      options={{
        position: fen,
        boardOrientation: orientation,
        allowDragging: interactive,
        squareStyles,
        showAnimations: true,
        animationDurationInMs: 200,
        onPieceDrop: ({ sourceSquare, targetSquare }) => {
          if (!interactive || !targetSquare) return false
          return tryMove(sourceSquare, targetSquare)
        },
        onSquareClick: ({ square, piece }) => {
          if (!interactive) return
          if (selected && legalTargets.has(square)) {
            tryMove(selected, square)
            return
          }
          // Sélectionne une pièce du camp au trait, désélectionne sinon
          const turnColor = chess.turn() // 'w' | 'b'
          if (piece && piece.pieceType.startsWith(turnColor)) {
            setSelected(square)
          } else {
            setSelected(null)
          }
        },
      }}
    />
  )
}
