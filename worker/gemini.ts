// Gemini fallback for the settlement worker — resolves bets the engine/adapters
// can't (unrecognized markets, uncovered sports, combos) via Google Search.
// Server-side only (GitHub Actions); key comes from the GEMINI_API_KEY secret.
import type { Outcome } from '../src/lib/settle'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL = 'gemini-2.5-flash'

export interface GeminiVerdict {
  status: Extract<Outcome, 'won' | 'lost' | 'void'> | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  explanation?: string
}

interface BetLike {
  sport: string
  event: string
  market: string
  date: string
  type: string
  legs?: Array<{ event?: string; selection: string }>
}

const UNKNOWN: GeminiVerdict = { status: 'unknown', confidence: 'low' }

export async function resolveViaGemini(key: string, bet: BetLike): Promise<GeminiVerdict> {
  const desc =
    bet.type === 'combo'
      ? `Accumulator/combo bet — it wins only if EVERY selection wins:\n${(bet.legs ?? [])
          .map((l) => (l.event ? `- ${l.event}: ${l.selection}` : `- ${l.selection}`))
          .join('\n')}`
      : `Event: ${bet.event}\nSelection: ${bet.market}`

  const prompt = `You verify the outcome of a sports bet using Google Search. Today is ${new Date()
    .toISOString()
    .slice(0, 10)}.
Sport: ${bet.sport}. Approx. start: ${bet.date}.
${desc}

Search for the final result, then decide the outcome:
- "won": the selection was correct (combo: all legs won)
- "lost": the selection was wrong (combo: at least one leg lost)
- "void": event cancelled/postponed
- "unknown": not finished yet, OR you cannot confirm the result with confidence. NEVER guess.

Reply with ONLY a JSON object: {"status":"won|lost|void|unknown","confidence":"high|medium|low","explanation":"one short sentence"}`

  let res: Response
  try {
    res = await fetch(`${BASE}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
    })
  } catch {
    return UNKNOWN
  }
  if (!res.ok) return UNKNOWN
  let data: any
  try {
    data = await res.json()
  } catch {
    return UNKNOWN
  }
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return UNKNOWN
  try {
    const v = JSON.parse(m[0]) as GeminiVerdict
    if (!['won', 'lost', 'void', 'unknown'].includes(v.status)) return UNKNOWN
    return v
  } catch {
    return UNKNOWN
  }
}
