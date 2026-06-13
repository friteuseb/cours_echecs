'use client'

import { Chessboard } from 'react-chessboard'

interface StaticBoardProps {
  fen: string
  orientation?: 'white' | 'black'
  /** Coup à mettre en évidence, au format UCI (ex : "e2e4") */
  highlightUci?: string | null
}

/** Échiquier d'affichage pur (projecteur, aperçus) : aucune interaction. */
export default function StaticBoard({ fen, orientation = 'white', highlightUci }: StaticBoardProps) {
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (highlightUci && highlightUci.length >= 4) {
    const style = { backgroundColor: 'rgba(250, 204, 21, 0.55)' }
    squareStyles[highlightUci.slice(0, 2)] = style
    squareStyles[highlightUci.slice(2, 4)] = style
  }
  return (
    <Chessboard
      options={{
        position: fen,
        boardOrientation: orientation,
        allowDragging: false,
        squareStyles,
        showAnimations: true,
        animationDurationInMs: 250,
      }}
    />
  )
}
