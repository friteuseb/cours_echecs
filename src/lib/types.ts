// Types partagés entre les API routes et les composants client

export type SessionStatus = 'lobby' | 'question' | 'reveal' | 'finished'
export type AnswerStatus = 'playing' | 'correct' | 'wrong' | 'timeout'

export interface PuzzleSummary {
  id: string
  fen: string
  solution: string
  title: string | null
  themes: string | null
  difficulty: number | null
  source: string | null
}

export interface PlayerState {
  id: string
  name: string
  score: number
}

/** État renvoyé aux téléphones des élèves (sans la solution !) */
export interface StudentState {
  status: SessionStatus
  currentIndex: number
  totalPuzzles: number
  timeLimit: number
  questionStartedAt: string | null
  fen: string | null
  /** Camp de l'élève : 'white' ou 'black' (le trait de la position) */
  orientation: 'white' | 'black' | null
  /** État de la réponse de CE joueur pour la question en cours */
  answer: {
    status: AnswerStatus
    movesPlayed: string
    score: number
  } | null
  /** Classement, envoyé seulement en reveal/finished */
  leaderboard: PlayerState[] | null
  /** Solution en SAN, envoyée seulement en reveal/finished */
  solutionSan: string[] | null
}

export interface ScreenAnswerStat {
  playerName: string
  status: AnswerStatus
  timeMs: number | null
  score: number
}

/** État complet renvoyé à l'écran du prof */
export interface ScreenState {
  status: SessionStatus
  code: string
  name: string | null
  currentIndex: number
  totalPuzzles: number
  timeLimit: number
  questionStartedAt: string | null
  fen: string | null
  orientation: 'white' | 'black' | null
  puzzleTitle: string | null
  solutionSan: string[] | null
  solutionUci: string[] | null
  players: PlayerState[]
  answers: ScreenAnswerStat[]
}

export interface MoveResult {
  result: 'continue' | 'solved' | 'wrong' | 'closed'
  /** Réponse automatique de l'adversaire (UCI), si la ligne continue */
  reply: string | null
  score: number
}

export interface ImportPuzzleInput {
  fen: string
  solution: string
  title?: string
  themes?: string
  difficulty?: number
  source?: string
}
