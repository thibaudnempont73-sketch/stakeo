// Settle a whole bet (single or combo) purely from a set of already-known
// match results — no network. Used by the app to settle instantly from the
// shared results cache. Returns 'unknown' when the data isn't enough yet
// (never guesses on money).
import type { Bet } from '../types'
import { settleMarket, type MatchResult, type Outcome } from './settle'
import { matchFixture } from './match'

export function settleBetFromResults(bet: Bet, results: MatchResult[]): Outcome {
  if (bet.type === 'combo') {
    const legs = bet.legs ?? []
    if (legs.length < 2 || legs.some((l) => !l.event)) return 'unknown'
    let sawWin = false
    for (const leg of legs) {
      const fixture = matchFixture(leg.event || '', results, bet.date)
      if (!fixture || fixture.status !== 'finished') return 'unknown'
      const o = settleMarket(leg.selection || '', fixture)
      if (o === 'lost') return 'lost' // one leg lost → whole combo lost
      if (o === 'unknown') return 'unknown'
      if (o === 'won') sawWin = true
      // 'void' legs drop out but don't decide the combo
    }
    return sawWin ? 'won' : 'unknown'
  }
  const fixture = matchFixture(bet.event || '', results, bet.date)
  if (!fixture || fixture.status !== 'finished') return 'unknown'
  return settleMarket(bet.market || '', fixture)
}
