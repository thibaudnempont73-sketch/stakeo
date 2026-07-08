// Settlement engine — API-agnostic.
//
// Adapters (one per sport/source) normalize scores into `MatchResult`; this
// module decides the outcome of a bet's market from that normalized shape.
// It never talks to any API. Unrecognized markets return 'unknown' (a later
// LLM fallback, cached per market, will handle the long tail).

import { teamInText } from './match'

export type Outcome = 'won' | 'lost' | 'void' | 'halfwon' | 'halflost' | 'unknown'

export interface MatchResult {
  home: string
  away: string
  homeScore: number
  awayScore: number
  status: 'finished' | 'postponed' | 'cancelled' | 'in_progress' | 'unknown'
  halfTime?: { home: number; away: number }
  // Source tag + id, so the worker can lazily enrich the one matched fixture
  // with exotic data (corners/cards/scorers) from that provider.
  provider?: string
  providerId?: string
  // Optional richer data for exotic markets (filled by adapters when available).
  homeCorners?: number
  awayCorners?: number
  homeCards?: number
  awayCards?: number
  bothTeamsScored?: boolean
  scorers?: string[] // players who scored, in chronological order
  // Per-player stats keyed by player name (goals, shots on target, assists, cards…).
  players?: Record<string, PlayerStats>
}

export interface PlayerStats {
  goals?: number
  assists?: number
  shots?: number
  shotsOnTarget?: number
  cards?: number
  points?: number
  rebounds?: number
  assistsNba?: number
}

// ── text helpers ─────────────────────────────────────────────

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n))
}

// Match short/ambiguous tokens ("no", "gg", "dnb", "si") as whole words only,
// so they don't fire inside unrelated words (e.g. "no" inside "Norwich").
function includesWord(hay: string, needles: string[]): boolean {
  return needles.some((n) => new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`).test(hay))
}

/** Which side does a team reference point to? Token/prefix match so bookmaker
 * abbreviations resolve ("Man City" → Manchester City, "Rays" → Tampa Bay Rays). */
function sideOf(ref: string, home: string, away: string): 'home' | 'away' | null {
  if (!norm(ref)) return null
  const matchesHome = teamInText(home, ref)
  const matchesAway = teamInText(away, ref)
  if (matchesHome && !matchesAway) return 'home'
  if (matchesAway && !matchesHome) return 'away'
  return null
}

// ── keyword banks (6 languages) ─────────────────────────────

// Multilingual keyword banks (fr · en · es · de · it · pt). Multi-char phrases
// are matched as substrings; short/ambiguous tokens go through includesWord.
const KW = {
  // team win / moneyline
  win: [
    'victoire', 'vainqueur', 'remporte', 'gagnant', 'gagne', 'match winner', 'to win', 'wins', 'winner', 'win',
    'moneyline', 'money line', 'ganador', 'gana', 'vencedor', 'vence', 'sieger', 'gewinnt', 'sieg',
    'vittoria', 'vincitore', 'vince', 'vitoria', 'vitória',
  ],
  // draw (multi-char, safe as substring)
  drawPhrase: ['match nul', 'partida empatada', 'match drawn', 'unentschieden'],
  drawWord: ['nul', 'draw', 'tie', 'empate', 'egalite', 'remis', 'pareggio', 'empat'],
  over: ['plus de', 'over', '+ de', 'mas de', 'más de', 'superieur', 'superior a', 'uber', 'über', 'oltre', 'superiore', 'mais de', 'acima de'],
  under: ['moins de', 'under', '- de', 'menos de', 'inferieur', 'inferior a', 'unter', 'sotto', 'inferiore', 'menos que', 'abaixo de'],
  // both teams to score
  bttsPhrase: [
    'les deux marquent', 'les 2 equipes marquent', 'deux equipes marquent', 'both teams to score', 'both teams',
    'ambos marcan', 'ambos anotan', 'beide treffen', 'beide teams treffen', 'entrambe segnano', 'entrambe le squadre segnano',
    'ambas marcam', 'ambas equipes marcam', 'ambas equipas marcam',
  ],
  bttsWord: ['btts', 'gg'],
  no: ['non', 'no', 'nein', 'nao', 'não', 'ng'],
  doubleChance: ['double chance', 'chance double', 'doppia chance', 'doble oportunidad', 'doble chance', 'doppelte chance', 'dupla hipotese', 'dupla chance'],
  dnbPhrase: ['draw no bet', 'rembourse si nul', 'empate no bet', 'sin empate'],
  handicap: ['handicap', 'asian handicap', 'handicap asiatique', 'spread'],
  goals: ['but', 'buts', 'goal', 'goals', 'gol', 'goles', 'tore', 'reti', 'golos', 'gols'],
  corners: ['corner', 'corners', 'coup de pied de coin', 'saque de esquina', 'ecke', 'ecken', 'calcio d angolo', 'angolo', 'pontape de canto', 'escanteio'],
  cards: ['carton', 'cartons', 'card', 'cards', 'carte', 'tarjeta', 'tarjetas', 'karte', 'karten', 'cartellino', 'cartellini', 'cartao', 'cartão', 'cartoes', 'cartões'],
  // scorer nouns/phrases (substring) + short verbs (whole-word, so they don't
  // eat player names like "Marquez").
  scorer: ['buteur', 'to score', 'goalscorer', 'goal scorer', 'scorer', 'anytime', 'goleador', 'anotador', 'marcador', 'torschutze', 'torschütze', 'marcatore'],
  scorerWord: ['marque', 'marquera', 'marca', 'segna', 'anota', 'trifft'],
  first: ['premier', '1er', '1re', 'first', '1st', 'primer', 'erster', 'erste', 'primo', 'primeiro', 'ouvre le score'],
}

const isFinal = (r: MatchResult) => r.status === 'finished'

// ── market spec ─────────────────────────────────────────────

type Metric = 'goals' | 'corners' | 'cards'

type Spec =
  | { kind: '1x2'; pick: 'home' | 'draw' | 'away' }
  | { kind: 'doubleChance'; picks: Array<'home' | 'draw' | 'away'> }
  | { kind: 'dnb'; pick: 'home' | 'away' }
  | { kind: 'overUnder'; side: 'over' | 'under'; line: number; metric: Metric }
  | { kind: 'btts'; yes: boolean }
  | { kind: 'handicap'; side: 'home' | 'away'; line: number }
  | { kind: 'scorer'; player: string; first: boolean }

/** Parse a free-text market/selection into a structured spec, or null if unknown. */
export function parseMarket(market: string, home: string, away: string): Spec | null {
  const m = norm(market)
  if (!m) return null

  // Both teams to score
  if (includesAny(m, KW.bttsPhrase) || includesWord(m, KW.bttsWord)) {
    return { kind: 'btts', yes: !includesWord(m, KW.no) }
  }

  // Goalscorer ("Mbappé buteur", "Mbappé to score", "1er buteur : Mbappé")
  if (includesAny(m, KW.scorer) || includesWord(m, KW.scorerWord)) {
    const first = includesAny(m, KW.first)
    let player = market
    for (const k of [...KW.scorer, ...KW.scorerWord, ...KW.first]) {
      player = player.replace(new RegExp(`\\b${k}\\b`, 'gi'), ' ')
    }
    player = player.replace(/[:·.\-]/g, ' ').replace(/\s+/g, ' ').trim()
    if (player) return { kind: 'scorer', player, first }
  }

  // Double chance codes (1X / X2 / 12)
  if (includesAny(m, KW.doubleChance) || /\b(1x|x2|12)\b/.test(m)) {
    if (/\b1x\b/.test(m)) return { kind: 'doubleChance', picks: ['home', 'draw'] }
    if (/\bx2\b/.test(m)) return { kind: 'doubleChance', picks: ['draw', 'away'] }
    if (/\b12\b/.test(m)) return { kind: 'doubleChance', picks: ['home', 'away'] }
    const hs = sideOf(m, home, away)
    if (hs) return { kind: 'doubleChance', picks: [hs, 'draw'] }
  }

  // Draw no bet
  if (includesAny(m, KW.dnbPhrase) || includesWord(m, ['dnb'])) {
    const s = sideOf(m, home, away)
    if (s) return { kind: 'dnb', pick: s }
  }

  // Over / Under (goals / points by default, or corners / cards if named)
  if (includesAny(m, KW.over) || includesAny(m, KW.under)) {
    const line = extractLine(m)
    if (line != null) {
      const side: 'over' | 'under' = includesAny(m, KW.under) && !includesAny(m, KW.over) ? 'under' : 'over'
      const metric: Metric = includesAny(m, KW.corners) ? 'corners' : includesAny(m, KW.cards) ? 'cards' : 'goals'
      return { kind: 'overUnder', side, line, metric }
    }
  }

  // Handicap: "<team> -1.5" / "+1.5" / "handicap"
  const hc = m.match(/([+-]\s?\d+(?:[.,]\d+)?)/)
  if (hc && (includesAny(m, KW.handicap) || sideOf(m.replace(hc[0], ''), home, away))) {
    const line = parseFloat(hc[1].replace(/\s/g, '').replace(',', '.'))
    const side = sideOf(m.replace(hc[0], ''), home, away) || (m.trim().startsWith('1') ? 'home' : m.trim().startsWith('2') ? 'away' : null)
    if (side) return { kind: 'handicap', side, line }
  }

  // 1X2 — explicit 1/N/2
  if (/^\s*1\s*$/.test(m)) return { kind: '1x2', pick: 'home' }
  if (/^\s*2\s*$/.test(m)) return { kind: '1x2', pick: 'away' }
  if (/^\s*(n|x)\s*$/.test(m)) return { kind: '1x2', pick: 'draw' }

  // Draw / "team or draw" worded
  if (includesAny(m, KW.drawPhrase) || includesWord(m, KW.drawWord)) {
    const s = sideOf(m, home, away)
    if (s) return { kind: 'doubleChance', picks: [s, 'draw'] } // "Team ou nul"
    return { kind: '1x2', pick: 'draw' }
  }

  // 1X2 — team win ("victoire PSG", "PSG wins", "Man City")
  const side = sideOf(market, home, away)
  if (side) return { kind: '1x2', pick: side }

  return null
}

function extractLine(m: string): number | null {
  const dec = m.match(/(\d+)[.,](\d+)/)
  if (dec) return parseFloat(`${dec[1]}.${dec[2]}`)
  const int = m.match(/\b(\d+)\b/)
  if (int) return parseFloat(int[1])
  return null
}

// ── settle a parsed spec against a result ───────────────────

function settleSpec(spec: Spec, r: MatchResult): Outcome {
  const h = r.homeScore
  const a = r.awayScore
  const total = h + a
  const winner: 'home' | 'draw' | 'away' = h > a ? 'home' : h < a ? 'away' : 'draw'

  switch (spec.kind) {
    case '1x2':
      return spec.pick === winner ? 'won' : 'lost'
    case 'doubleChance':
      return spec.picks.includes(winner) ? 'won' : 'lost'
    case 'dnb':
      if (winner === 'draw') return 'void'
      return spec.pick === winner ? 'won' : 'lost'
    case 'btts': {
      const btts = r.bothTeamsScored ?? (h > 0 && a > 0)
      return btts === spec.yes ? 'won' : 'lost'
    }
    case 'overUnder': {
      let metricTotal: number | null = total
      if (spec.metric === 'corners') {
        metricTotal = r.homeCorners != null && r.awayCorners != null ? r.homeCorners + r.awayCorners : null
      } else if (spec.metric === 'cards') {
        metricTotal = r.homeCards != null && r.awayCards != null ? r.homeCards + r.awayCards : null
      }
      if (metricTotal == null) return 'unknown' // stat not available from the source
      if (metricTotal === spec.line) return 'void' // integer line push
      return (metricTotal > spec.line) === (spec.side === 'over') ? 'won' : 'lost'
    }
    case 'handicap': {
      const my = (spec.side === 'home' ? h : a) + spec.line
      const other = spec.side === 'home' ? a : h
      if (my > other) return 'won'
      if (my < other) return 'lost'
      return 'void'
    }
    case 'scorer': {
      if (!r.scorers) return 'unknown' // scorer data not available
      const target = norm(spec.player)
      if (!target) return 'unknown'
      const hit = (name: string) => {
        const n = norm(name)
        return n === target || n.includes(target) || target.includes(n)
      }
      if (spec.first) return r.scorers[0] && hit(r.scorers[0]) ? 'won' : 'lost'
      return r.scorers.some(hit) ? 'won' : 'lost'
    }
  }
}

/** Settle a single bet's market against a normalized result. */
export function settleMarket(market: string, result: MatchResult): Outcome {
  if (result.status === 'cancelled' || result.status === 'postponed') return 'void'
  if (!isFinal(result)) return 'unknown'
  const spec = parseMarket(market, result.home, result.away)
  if (!spec) return 'unknown'
  return settleSpec(spec, result)
}
