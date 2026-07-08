// Shared, pure helpers for the results cache (fixtures + results tables).
// No Supabase import here so the worker can use it in plain Node.
import type { MatchResult } from './settle'
import { norm } from './match'

/** Date part of an ISO-ish string as YYYYMMDD (timezone-independent). */
export function ymdOf(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO || '')
  return m ? `${m[1]}${m[2]}${m[3]}` : '00000000'
}

/** Canonical fixture id — same for a match however each side phrases it. */
export function matchKey(sport: string, ymd: string, home: string, away: string): string {
  const pair = [norm(home), norm(away)].sort().join('__')
  return `${sport}|${ymd}|${pair}`
}

/** Exotic/extra fields stored in results.data (score/status live in columns). */
export function packResult(mr: MatchResult): Record<string, unknown> {
  return {
    bothTeamsScored: mr.bothTeamsScored,
    homeCorners: mr.homeCorners,
    awayCorners: mr.awayCorners,
    homeCards: mr.homeCards,
    awayCards: mr.awayCards,
    scorers: mr.scorers,
    players: mr.players,
    halfTime: mr.halfTime,
  }
}

/** Rebuild a MatchResult from a fixtures row + its results row. */
export function rowToResult(fx: any, rs: any): MatchResult {
  const d = rs?.data ?? {}
  return {
    home: fx.home ?? '',
    away: fx.away ?? '',
    homeScore: rs?.home_score ?? 0,
    awayScore: rs?.away_score ?? 0,
    status: (rs?.status ?? 'finished') as MatchResult['status'],
    bothTeamsScored: d.bothTeamsScored,
    homeCorners: d.homeCorners,
    awayCorners: d.awayCorners,
    homeCards: d.homeCards,
    awayCards: d.awayCards,
    scorers: d.scorers,
    players: d.players,
    halfTime: d.halfTime,
  }
}
