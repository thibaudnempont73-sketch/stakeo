// API-Football adapter (api-sports.io — key required, GitHub Secret
// API_FOOTBALL_KEY). Free plan = 100 requests/day, so we stay targeted:
//   • fetchApiFootball(date) — one call lists the day's fixtures (id + score).
//   • enrich(result) — only for the single fixture a bet actually matched,
//     pulls events (scorers/cards) + statistics (corners) → exotic markets.
// Best-effort: any error/quota just yields [] or the un-enriched result, and
// the worker falls back to the free score-only sources.
import type { MatchResult } from '../../src/lib/settle'
import { norm } from './match'

const KEY = process.env.API_FOOTBALL_KEY || ''
const BASE = 'https://v3.football.api-sports.io'

export function hasApiFootball(): boolean {
  return !!KEY
}

async function afGet(path: string): Promise<any[]> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': KEY } })
  if (!res.ok) throw new Error(`API-Football ${res.status} for ${path}`)
  const data: any = await res.json()
  return data?.response ?? []
}

// The Free plan only serves /fixtures?date= for a today±1 window (UTC). We
// settle matches within hours of kickoff, so this always covers real bets —
// and skipping older dates avoids burning the 100/day quota on plan errors.
const MS = 86400000
function withinFreeWindow(dateDash: string): boolean {
  const target = Date.parse(`${dateDash}T00:00:00Z`)
  if (isNaN(target)) return false
  const today0 = Math.floor(Date.now() / MS) * MS
  const diffDays = Math.round((target - today0) / MS)
  return diffDays >= -1 && diffDays <= 1
}

const FINISHED = new Set(['FT', 'AET', 'PEN'])

function normStatus(short: string | undefined): MatchResult['status'] {
  if (short && FINISHED.has(short)) return 'finished'
  if (short === 'PST') return 'postponed'
  if (short === 'CANC' || short === 'ABD' || short === 'AWD' || short === 'WO') return 'cancelled'
  return 'in_progress'
}

/** List a date's football fixtures (YYYY-MM-DD) with ids and final scores. */
export async function fetchApiFootball(dateDash: string): Promise<MatchResult[]> {
  if (!KEY || !withinFreeWindow(dateDash)) return []
  const rows = await afGet(`/fixtures?date=${dateDash}`)
  const out: MatchResult[] = []
  for (const r of rows) {
    const home = r?.teams?.home?.name
    const away = r?.teams?.away?.name
    if (!home || !away) continue
    const hg = r?.goals?.home
    const ag = r?.goals?.away
    out.push({
      home,
      away,
      homeScore: hg == null ? 0 : Number(hg),
      awayScore: ag == null ? 0 : Number(ag),
      status: normStatus(r?.fixture?.status?.short),
      startsAt: r?.fixture?.date ?? undefined,
      bothTeamsScored: Number(hg) > 0 && Number(ag) > 0,
      provider: 'apifootball',
      providerId: String(r?.fixture?.id ?? ''),
    })
  }
  return out
}

/** Enrich one matched fixture with exotic data (corners / cards / scorers). */
export async function enrich(result: MatchResult): Promise<MatchResult> {
  if (!KEY || result.provider !== 'apifootball' || !result.providerId) return result
  const fixture = result.providerId
  const [events, stats] = await Promise.all([
    afGet(`/fixtures/events?fixture=${fixture}`).catch(() => [] as any[]),
    afGet(`/fixtures/statistics?fixture=${fixture}`).catch(() => [] as any[]),
  ])

  const isHome = (teamName: string) => norm(teamName) === norm(result.home)

  // Events → scorers (in order), per-team card counts, per-player goals.
  const scorers: string[] = []
  const players: Record<string, { goals?: number }> = {}
  let homeCards = 0
  let awayCards = 0
  for (const e of events) {
    const type = e?.type
    const detail: string = e?.detail || ''
    const player: string = e?.player?.name || ''
    const teamName: string = e?.team?.name || ''
    if (type === 'Goal' && detail !== 'Own Goal' && detail !== 'Missed Penalty') {
      if (player) {
        scorers.push(player)
        players[player] = { goals: (players[player]?.goals ?? 0) + 1 }
      }
    } else if (type === 'Card' && (detail.includes('Yellow') || detail.includes('Red'))) {
      if (isHome(teamName)) homeCards++
      else awayCards++
    }
  }

  // Statistics → corners (and a card fallback if events carried none).
  let homeCorners: number | undefined
  let awayCorners: number | undefined
  for (const s of stats) {
    const home = isHome(s?.team?.name || '')
    for (const st of s?.statistics ?? []) {
      const v = st?.value
      if (st?.type === 'Corner Kicks' && v != null) {
        if (home) homeCorners = Number(v)
        else awayCorners = Number(v)
      }
    }
  }

  return {
    ...result,
    homeCorners,
    awayCorners,
    homeCards,
    awayCards,
    scorers,
    players,
  }
}
