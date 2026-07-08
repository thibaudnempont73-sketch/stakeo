// "Your bet is settled" summary on app open. We compare each bet's settledAt
// against the last time this device saw the app, so the user gets a recap of
// everything the auto-settlement resolved while they were away. Per-device
// (localStorage), not synced — "since your last visit here".
import type { Bet } from '../types'
import { betProfit, isSettled } from './stats'

const KEY = 'stakeo-last-seen'

export function getLastSeen(): number {
  const v = localStorage.getItem(KEY)
  if (v) return Number(v)
  // First ever visit on this device → start now so we don't recap all history.
  const now = Date.now()
  localStorage.setItem(KEY, String(now))
  return now
}

export function markSeen(ts: number = Date.now()): void {
  localStorage.setItem(KEY, String(ts))
}

export interface UnseenSummary {
  bets: Bet[]
  count: number
  won: number
  lost: number
  net: number
}

/** Bets settled after `since` (ms epoch) — the recap to surface on open. */
export function settledSince(bets: Bet[], since: number): UnseenSummary {
  const fresh = bets.filter((b) => isSettled(b) && b.settledAt != null && Date.parse(b.settledAt) > since)
  const net = fresh.reduce((s, b) => s + betProfit(b), 0)
  const won = fresh.filter((b) => b.status === 'won' || b.status === 'halfwon' || b.status === 'cashout').length
  const lost = fresh.filter((b) => b.status === 'lost' || b.status === 'halflost').length
  return { bets: fresh, count: fresh.length, won, lost, net }
}
