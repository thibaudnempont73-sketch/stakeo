// Instant settlement on app open. Reads the shared results cache and settles
// any pending bet whose match is already finished — free (no API) and
// immediate, without waiting for the next cron run. Changes flow back to the
// cloud through the normal store→sync push.
import { useStore } from '../store'
import { supabase } from './supabase'
import { fetchCachedResults } from './resultsCache'
import { settleBetFromResults } from './settleBet'
import type { Bet, BetStatus } from '../types'

const DAY = 86400000

export async function settleFromCache(): Promise<void> {
  if (!supabase) return
  const now = Date.now()
  const pending = useStore
    .getState()
    .bets.filter((b) => b.status === 'pending' && b.sport && !isNaN(Date.parse(b.date)) && Date.parse(b.date) < now)
  if (!pending.length) return

  const bySport = new Map<string, Bet[]>()
  for (const b of pending) {
    const list = bySport.get(b.sport) ?? []
    list.push(b)
    bySport.set(b.sport, list)
  }

  for (const [sport, bets] of bySport) {
    const times = bets.map((b) => Date.parse(b.date))
    const fromISO = new Date(Math.min(...times) - 2 * DAY).toISOString()
    const toISO = new Date(Math.max(...times) + 2 * DAY).toISOString()

    let results
    try {
      results = await fetchCachedResults(sport, fromISO, toISO)
    } catch {
      continue // cache unavailable → leave for the cron
    }
    if (!results.length) continue

    for (const bet of bets) {
      const outcome = settleBetFromResults(bet, results)
      if (outcome !== 'unknown') useStore.getState().settleBet(bet.id, outcome as BetStatus)
    }
  }
}
