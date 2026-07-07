// Automatic settlement worker — runs server-side on a schedule (GitHub Actions).
// Reads pending bets from Supabase (service_role, bypasses RLS), fetches results
// via the sport adapters, settles them with the engine, and writes back.
//
// Run: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx worker/settle.ts
import { createClient } from '@supabase/supabase-js'
import { fetchEspn, matchFixture, ESPN_SPORT } from './adapters/espn'
import { settleMarket, type MatchResult } from '../src/lib/settle'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const SETTLE_AFTER_MS = 3.5 * 3600 * 1000 // wait ~3.5h after kickoff (match is over)
const MAX_AGE_MS = 14 * 24 * 3600 * 1000 // stop chasing bets older than 14 days

function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// One ESPN fetch per (sportPath, date), reused across all bets in this run.
const cache = new Map<string, Promise<MatchResult[]>>()
function getResults(sportPath: string, date: string): Promise<MatchResult[]> {
  const k = `${sportPath}:${date}`
  if (!cache.has(k)) cache.set(k, fetchEspn(sportPath, date).catch(() => [] as MatchResult[]))
  return cache.get(k)!
}

// Fetch the match day plus ±1 day (kickoff timezone can shift the date).
async function resultsForBet(sport: string, dateISO: string): Promise<MatchResult[]> {
  const sportPath = ESPN_SPORT[sport]
  if (!sportPath) return []
  const base = new Date(dateISO)
  if (isNaN(base.getTime())) return []
  const dates = [-1, 0, 1].map((off) => {
    const d = new Date(base)
    d.setDate(d.getDate() + off)
    return ymd(d)
  })
  const all = await Promise.all(dates.map((d) => getResults(sportPath, d)))
  return all.flat()
}

async function main() {
  const now = Date.now()
  const { data: bets, error } = await sb.from('bets').select('*').eq('status', 'pending')
  if (error) throw error

  const pending = bets ?? []
  console.log(`${pending.length} pending bets total`)

  let settled = 0
  let skipped = 0
  for (const bet of pending) {
    const kickoff = new Date(bet.date).getTime()
    if (isNaN(kickoff) || now - kickoff < SETTLE_AFTER_MS || now - kickoff > MAX_AGE_MS) {
      skipped++
      continue
    }
    if (bet.type === 'combo') {
      // Combos need a per-leg event/market model — handled in a later version.
      skipped++
      continue
    }
    if (!ESPN_SPORT[bet.sport]) {
      skipped++
      continue
    }

    try {
      const results = await resultsForBet(bet.sport, bet.date)
      const fixture = matchFixture(bet.event || '', results)
      if (!fixture || fixture.status !== 'finished') {
        skipped++
        continue
      }
      const outcome = settleMarket(bet.market || '', fixture)
      if (outcome === 'unknown') {
        skipped++
        continue
      }
      const { error: upErr } = await sb
        .from('bets')
        .update({ status: outcome, settled_at: new Date().toISOString() })
        .eq('id', bet.id)
      if (upErr) {
        console.warn(`update failed for ${bet.id}: ${upErr.message}`)
        continue
      }
      settled++
      console.log(`settled ${bet.id}: ${bet.event} / "${bet.market}" (${fixture.awayScore}-${fixture.homeScore}) → ${outcome}`)
    } catch (e) {
      console.warn(`error on bet ${bet.id}: ${(e as Error).message}`)
    }
  }

  console.log(`done — settled ${settled}, still pending ${skipped}`)
}

main().catch((e) => {
  console.error('fatal:', e.message)
  process.exit(1)
})
