// Settlement engine — API-agnostic.
//
// Adapters (one per sport/source) normalize scores into `MatchResult`; this
// module decides the outcome of a bet's market from that normalized shape.
// It never talks to any API. Unrecognized markets return 'unknown' (a later
// LLM fallback, cached per market, will handle the long tail).

export type Outcome = 'won' | 'lost' | 'void' | 'halfwon' | 'halflost' | 'unknown'

export interface MatchResult {
  home: string
  away: string
  homeScore: number
  awayScore: number
  status: 'finished' | 'postponed' | 'cancelled' | 'in_progress' | 'unknown'
  // Optional richer data for exotic markets (filled by adapters when available).
  homeCorners?: number
  awayCorners?: number
  homeCards?: number
  awayCards?: number
  bothTeamsScored?: boolean
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

/** Which side does a team reference point to? Fuzzy: substring both ways. */
function sideOf(ref: string, home: string, away: string): 'home' | 'away' | null {
  const r = norm(ref)
  const h = norm(home)
  const a = norm(away)
  if (!r) return null
  const matchesHome = h && (r.includes(h) || h.includes(r))
  const matchesAway = a && (r.includes(a) || a.includes(r))
  if (matchesHome && !matchesAway) return 'home'
  if (matchesAway && !matchesHome) return 'away'
  return null
}

// ── keyword banks (6 languages) ─────────────────────────────

const KW = {
  draw: ['match nul', 'nul', 'draw', 'tie', 'empate', 'unentschieden', 'remis', 'pareggio', 'x'],
  over: ['plus de', 'over', '+ de', 'mas de', 'más de', 'uber', 'über', 'oltre', 'mais de', 'superiore'],
  under: ['moins de', 'under', '- de', 'menos de', 'unter', 'sotto', 'inferiore'],
  bttsYes: ['les deux marquent', 'both teams to score', 'btts', 'ambos marcan', 'beide treffen', 'entrambe segnano', 'ambas marcam', 'oui', 'yes', 'si', 'ja'],
  bttsNo: ['non', 'no', 'nein', 'nao', 'não'],
  win: ['victoire', 'vainqueur', 'gagne', 'wins', 'win', 'winner', 'gana', 'sieg', 'gewinnt', 'vince', 'vitoria', 'vitória', 'vence'],
  doubleChance: ['double chance', 'doppia chance', 'doble oportunidad', 'doppelte chance', 'dupla hipotese'],
  goals: ['but', 'buts', 'goal', 'goals', 'gol', 'goles', 'tore', 'reti', 'golos'],
}

const isFinal = (r: MatchResult) => r.status === 'finished'

// ── market spec ─────────────────────────────────────────────

type Spec =
  | { kind: '1x2'; pick: 'home' | 'draw' | 'away' }
  | { kind: 'doubleChance'; picks: Array<'home' | 'draw' | 'away'> }
  | { kind: 'dnb'; pick: 'home' | 'away' }
  | { kind: 'overUnder'; side: 'over' | 'under'; line: number }
  | { kind: 'btts'; yes: boolean }
  | { kind: 'handicap'; side: 'home' | 'away'; line: number }

/** Parse a free-text market/selection into a structured spec, or null if unknown. */
export function parseMarket(market: string, home: string, away: string): Spec | null {
  const m = norm(market)
  if (!m) return null

  // Both teams to score
  if (includesAny(m, ['btts', 'les deux marquent', 'both teams', 'ambos marcan', 'beide treffen', 'entrambe segnano', 'ambas marcam'])) {
    const no = KW.bttsNo.some((n) => new RegExp(`\\b${n}\\b`).test(m))
    return { kind: 'btts', yes: !no }
  }

  // Double chance (1X / X2 / 12 or worded)
  if (includesAny(m, KW.doubleChance) || /\b(1x|x2|12)\b/.test(m)) {
    if (/\b1x\b/.test(m)) return { kind: 'doubleChance', picks: ['home', 'draw'] }
    if (/\bx2\b/.test(m)) return { kind: 'doubleChance', picks: ['draw', 'away'] }
    if (/\b12\b/.test(m)) return { kind: 'doubleChance', picks: ['home', 'away'] }
    const hs = sideOf(m, home, away)
    if (hs) return { kind: 'doubleChance', picks: [hs, 'draw'] }
  }

  // Draw no bet
  if (includesAny(m, ['draw no bet', 'rembourse si nul', 'dnb'])) {
    const s = sideOf(m, home, away)
    if (s) return { kind: 'dnb', pick: s }
  }

  // Over / Under total (needs a number)
  if (includesAny(m, KW.over) || includesAny(m, KW.under)) {
    const line = extractLine(m)
    if (line != null) {
      const side: 'over' | 'under' = includesAny(m, KW.over) && !includesAny(m, KW.under) ? 'over' : includesAny(m, KW.under) ? 'under' : 'over'
      return { kind: 'overUnder', side, line }
    }
  }

  // Handicap: "<team> -1.5" / "+1.5" / "handicap"
  const hc = m.match(/([+-]\s?\d+(?:[.,]\d+)?)/)
  if (hc && (includesAny(m, ['handicap', 'hcp']) || sideOf(m.replace(hc[0], ''), home, away))) {
    const line = parseFloat(hc[1].replace(/\s/g, '').replace(',', '.'))
    const side = sideOf(m.replace(hc[0], ''), home, away) || (m.trim().startsWith('1') ? 'home' : m.trim().startsWith('2') ? 'away' : null)
    if (side) return { kind: 'handicap', side, line }
  }

  // 1X2 — explicit 1/N/2
  if (/^\s*1\s*$/.test(m)) return { kind: '1x2', pick: 'home' }
  if (/^\s*2\s*$/.test(m)) return { kind: '1x2', pick: 'away' }
  if (/^\s*(n|x)\s*$/.test(m)) return { kind: '1x2', pick: 'draw' }

  // 1X2 — draw worded
  if (m === 'nul' || includesAny(m, ['match nul', 'draw', 'empate', 'unentschieden', 'pareggio'])) {
    return { kind: '1x2', pick: 'draw' }
  }

  // 1X2 — team win ("victoire PSG", "PSG wins", "PSG")
  const side = sideOf(market, home, away)
  if (side && (includesAny(m, KW.win) || sideOf(market, home, away))) {
    return { kind: '1x2', pick: side }
  }

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
    case 'overUnder':
      if (total === spec.line) return 'void' // integer line push
      return (total > spec.line) === (spec.side === 'over') ? 'won' : 'lost'
    case 'handicap': {
      const my = (spec.side === 'home' ? h : a) + spec.line
      const other = spec.side === 'home' ? a : h
      if (my > other) return 'won'
      if (my < other) return 'lost'
      return 'void'
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
