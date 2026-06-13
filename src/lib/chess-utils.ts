import { Chess } from 'chess.js'
import type { ImportPuzzleInput } from './types'

/** Convertit un coup UCI ("e2e4", "e7e8q") en objet { from, to, promotion } */
export function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
  }
}

/** Le camp au trait d'une position FEN */
export function sideToMove(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white'
}

/** Vérifie qu'une FEN est valide et que la solution est jouable. Renvoie null si OK, sinon le message d'erreur. */
export function validatePuzzle(fen: string, solutionUci: string[]): string | null {
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch (e) {
    return `FEN invalide : ${e instanceof Error ? e.message : String(e)}`
  }
  if (solutionUci.length === 0) return 'La solution est vide'
  for (const uci of solutionUci) {
    try {
      chess.move(uciToMove(uci))
    } catch {
      return `Coup illégal dans la solution : ${uci}`
    }
  }
  return null
}

/** Rejoue une ligne UCI depuis une FEN et renvoie les coups en notation SAN */
export function uciLineToSan(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen)
  const san: string[] = []
  for (const uci of uciMoves) {
    const move = chess.move(uciToMove(uci))
    san.push(move.san)
  }
  return san
}

/**
 * Parse le format CSV des puzzles Lichess :
 * PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 * Particularité Lichess : la FEN est la position AVANT le coup de l'adversaire ;
 * le premier coup de Moves est joué par l'adversaire, la solution commence ensuite.
 */
export function parseLichessCsv(text: string): { puzzles: ImportPuzzleInput[]; errors: string[] } {
  const puzzles: ImportPuzzleInput[] = []
  const errors: string[] = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.startsWith('PuzzleId,')) continue // en-tête
    const cols = line.split(',')
    if (cols.length < 3) {
      errors.push(`Ligne ignorée (colonnes manquantes) : ${line.slice(0, 50)}`)
      continue
    }
    const [id, fen, moves, rating, , , , themes] = cols
    const allMoves = moves.split(' ').filter(Boolean)
    if (allMoves.length < 2) {
      errors.push(`Puzzle ${id} : pas assez de coups`)
      continue
    }
    try {
      const chess = new Chess(fen)
      chess.move(uciToMove(allMoves[0])) // coup de l'adversaire
      const startFen = chess.fen()
      const solution = allMoves.slice(1)
      const error = validatePuzzle(startFen, solution)
      if (error) {
        errors.push(`Puzzle ${id} : ${error}`)
        continue
      }
      puzzles.push({
        fen: startFen,
        solution: solution.join(' '),
        title: id ? `Lichess ${id}` : undefined,
        themes: themes || undefined,
        difficulty: rating ? parseInt(rating, 10) || undefined : undefined,
        source: 'lichess',
      })
    } catch (e) {
      errors.push(`Puzzle ${id} : ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { puzzles, errors }
}

export interface PgnPosition {
  /** Index du coup dans la partie (demi-coups) */
  ply: number
  /** SAN du coup qui vient d'être joué */
  san: string
  /** FEN après ce coup */
  fen: string
  /** Coups UCI restants jusqu'à la fin de la partie */
  remainingUci: string[]
}

/** Parse un PGN et renvoie la liste des positions après chaque coup, pour choisir le départ d'un puzzle */
export function parsePgnPositions(pgn: string): PgnPosition[] {
  const game = new Chess()
  game.loadPgn(pgn)
  const verbose = game.history({ verbose: true })
  const positions: PgnPosition[] = []
  const replay = new Chess()
  // Si le PGN démarre d'une position (tag FEN), history le gère via loadPgn ; on rejoue depuis le header
  const headers = game.getHeaders()
  if (headers.FEN) replay.load(headers.FEN)
  const allUci = verbose.map((m) => m.from + m.to + (m.promotion ?? ''))
  verbose.forEach((move, i) => {
    replay.move({ from: move.from, to: move.to, promotion: move.promotion })
    positions.push({
      ply: i + 1,
      san: move.san,
      fen: replay.fen(),
      remainingUci: allUci.slice(i + 1),
    })
  })
  return positions
}

/**
 * Parse une solution saisie par le prof : accepte la notation SAN ("Dxf7#", "Cg5+")
 * en anglais (Qxf7) comme les coups UCI ("h5f7"). Renvoie la ligne en UCI.
 * Lève une erreur si un coup est illégal.
 */
export function parseSolutionInput(fen: string, text: string): string[] {
  const tokens = text
    .replace(/\d+\.(\.\.)?/g, ' ')
    .replace(/[!?]+/g, '')
    .split(/\s+/)
    .filter((t) => t && !['1-0', '0-1', '1/2-1/2', '*'].includes(t))
  const chess = new Chess(fen)
  const uci: string[] = []
  for (const tok of tokens) {
    const move = /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(tok)
      ? chess.move(uciToMove(tok.toLowerCase()))
      : chess.move(tok)
    uci.push(move.from + move.to + (move.promotion ?? ''))
  }
  if (uci.length === 0) throw new Error('Aucun coup fourni')
  return uci
}

/** Génère un code de session lisible (sans caractères ambigus) */
export function generateSessionCode(length = 5): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

/** Score type Kahoot : 500 points de base + bonus de rapidité jusqu'à 500 */
export function computeScore(timeMs: number, timeLimitSec: number): number {
  const ratio = Math.max(0, 1 - timeMs / (timeLimitSec * 1000))
  return 500 + Math.round(500 * ratio)
}
