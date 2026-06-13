// Libellés français des thèmes de puzzles Lichess

export const THEME_LABELS: Record<string, string> = {
  mate: 'Mat',
  mateIn1: 'Mat en 1',
  mateIn2: 'Mat en 2',
  mateIn3: 'Mat en 3',
  mateIn4: 'Mat en 4',
  mateIn5: 'Mat en 5+',
  fork: 'Fourchette',
  pin: 'Clouage',
  skewer: 'Enfilade',
  discoveredAttack: 'Attaque à la découverte',
  doubleCheck: 'Échec double',
  backRankMate: 'Mat du couloir',
  smotheredMate: 'Mat étouffé',
  anastasiaMate: 'Mat d’Anastasie',
  arabianMate: 'Mat des Arabes',
  bodenMate: 'Mat de Boden',
  hookMate: 'Mat du crochet',
  dovetailMate: 'Mat de Cozio',
  hangingPiece: 'Pièce en prise',
  trappedPiece: 'Pièce enfermée',
  promotion: 'Promotion',
  underPromotion: 'Sous-promotion',
  sacrifice: 'Sacrifice',
  deflection: 'Déviation',
  attraction: 'Attraction',
  clearance: 'Dégagement',
  interference: 'Interception',
  intermezzo: 'Coup intermédiaire',
  quietMove: 'Coup tranquille',
  zugzwang: 'Zugzwang',
  xRayAttack: 'Attaque rayons X',
  capturingDefender: 'Capture du défenseur',
  defensiveMove: 'Coup défensif',
  exposedKing: 'Roi exposé',
  kingsideAttack: 'Attaque sur le roque',
  queensideAttack: 'Attaque à l’aile dame',
  advancedPawn: 'Pion avancé',
  endgame: 'Finale',
  middlegame: 'Milieu de partie',
  opening: 'Ouverture',
  rookEndgame: 'Finale de tours',
  pawnEndgame: 'Finale de pions',
  queenEndgame: 'Finale de dames',
  bishopEndgame: 'Finale de fous',
  knightEndgame: 'Finale de cavaliers',
  queenRookEndgame: 'Finale dame et tour',
  crushing: 'Écrasant',
  advantage: 'Avantage',
  equality: 'Égalisation',
  oneMove: 'Un coup',
  short: 'Court',
  long: 'Long',
  veryLong: 'Très long',
}

/** Thèmes « pédagogiques » à privilégier pour l'affichage (les motifs avant les tags génériques) */
const DISPLAY_PRIORITY = [
  'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5',
  'smotheredMate', 'backRankMate', 'anastasiaMate', 'arabianMate', 'bodenMate', 'hookMate', 'dovetailMate',
  'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck',
  'hangingPiece', 'trappedPiece', 'promotion', 'underPromotion',
  'sacrifice', 'deflection', 'attraction', 'clearance', 'interference', 'intermezzo',
  'quietMove', 'zugzwang', 'xRayAttack', 'capturingDefender', 'exposedKing',
  'kingsideAttack', 'queensideAttack', 'advancedPawn',
  'rookEndgame', 'pawnEndgame', 'queenEndgame',
  'endgame', 'middlegame', 'opening',
]

/** Thèmes proposés dans le filtre de la bibliothèque (et ciblés par le script d'import) */
export const FILTER_THEMES = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'smotheredMate',
  'backRankMate',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleCheck',
  'hangingPiece',
  'trappedPiece',
  'promotion',
  'sacrifice',
  'deflection',
]

export function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme
}

/** Extrait les thèmes les plus parlants d'une chaîne de thèmes (séparés par espaces ou virgules) */
export function primaryThemes(themes: string | null | undefined, count = 2): string[] {
  if (!themes) return []
  const list = themes.split(/[\s,]+/).filter(Boolean)
  const known = DISPLAY_PRIORITY.filter((t) => list.includes(t))
  const result = known.length > 0 ? known : list
  return result.slice(0, count).map(themeLabel)
}
