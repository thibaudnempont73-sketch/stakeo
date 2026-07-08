// Supabase Edge Function: scan-bet
//
// The (authenticated) browser sends a bet-slip image; this function calls
// Gemini vision with the extraction prompt and returns the structured bet.
// The Gemini key lives ONLY here (function secret GEMINI_API_KEY) — never in
// the browser. Deploy: `supabase functions deploy scan-bet`.
//
// Hardening (the Gemini key spends real money, so guard the endpoint):
//   • Require a real signed-in user — the public anon key alone is rejected,
//     so random callers can't run up the bill.
//   • Cap the image size server-side (huge images = higher Gemini cost).
//   • Generous per-user daily cap (safety net vs a hijacked token; a normal
//     user entering 10-20 bets never gets near it).
//   • Lock CORS to our own origins.

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const MODEL = 'gemini-2.5-flash-lite'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const DAILY_CAP = 200 // scans/user/day — abuse guard, not a usage limit
const MAX_IMAGE_B64 = 8_000_000 // ~6 MB image; normal compressed scans are tiny

const SPORTS = [
  'football', 'tennis', 'basketball', 'esports', 'rugby', 'handball', 'volleyball', 'hockey',
  'baseball', 'amfootball', 'mma', 'boxing', 'golf', 'horse', 'motorsport', 'darts', 'other',
]

const ALLOWED_ORIGINS = new Set([
  'https://stakeo.app',
  'https://www.stakeo.app',
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsFor(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://stakeo.app'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

// Validate the caller's JWT is a real user (not the anon key). Returns the
// user id, or null when the token is missing/invalid/anon.
async function getUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !SUPABASE_URL || !ANON) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: ANON },
    })
    if (!res.ok) return null
    const user = await res.json()
    return user?.id ?? null
  } catch {
    return null
  }
}

// Increment today's scan count for the user via a SECURITY DEFINER RPC.
// Returns the new count, or 0 if the RPC isn't installed yet (fail-open so the
// scan keeps working before the SQL migration is applied).
async function bumpUsage(authHeader: string): Promise<number> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_scan_usage`, {
      method: 'POST',
      headers: { Authorization: authHeader, apikey: ANON, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return 0
    return Number(await res.json()) || 0
  } catch {
    return 0
  }
}

const PROMPT = `You extract structured data from a sports betting slip screenshot (Winamax, Betclic, Bet365, Unibet, Stake, PMU, etc.).

FIRST decide single vs combo by COUNTING the matches on the slip:
- If the slip shows 2 OR MORE distinct matches/events, it is a COMBO (combiné / parlay / accumulator / multiple). Set type="combo".
- If it shows exactly ONE match, it is a SINGLE. Set type="single".

For a COMBO — this is critical:
- Include EVERY match as a separate entry in "legs". Never drop a match, never merge two matches. 2 matches → exactly 2 legs; 3 → 3; etc.
- Each leg has: "event" (the match, e.g. "PSG – Marseille"), "selection" (the pick, e.g. "Victoire PSG"), and "odds" (that leg's decimal odds).
- The top-level "odds" is the TOTAL = product of all leg odds. Top-level "event" = "" and "market" = "".
- Scan the whole image top to bottom; combos list matches vertically — include all of them.

For a SINGLE:
- Fill top-level "event" (the match) and "market" (the pick), leave "legs" as [].

General rules:
- Keep event names, markets and selections in their ORIGINAL language, exactly as written.
- Always output DECIMAL (European) odds. Convert fractional/american odds to decimal.
- "stake" = amount wagered (0 if not visible). "bookmaker" = app/site name if identifiable, else "".
- "sport" must be one of: ${SPORTS.join(', ')}.
- "date" = event start "YYYY-MM-DDTHH:MM" if visible, else "".
- If the image is NOT a bet slip, set found=false and leave the rest empty/zero.

Respond with ONLY a JSON object of this exact shape, no markdown:
{"found":boolean,"event":string,"sport":string,"market":string,"type":"single"|"combo","legs":[{"event":string,"selection":string,"odds":number}],"odds":number,"stake":number,"bookmaker":string,"isLive":boolean,"date":string}`

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get('origin'))
  const json = (obj: unknown, status = 200): Response =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!GEMINI_KEY) return json({ error: 'not_configured' }, 500)

  // Require a real signed-in user (rejects the bare public anon key).
  const authHeader = req.headers.get('authorization')
  const userId = await getUserId(authHeader)
  if (!userId) return json({ error: 'unauthorized' }, 401)

  let body: { image?: string; mediaType?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!body.image) return json({ error: 'no_image' }, 400)
  if (body.image.length > MAX_IMAGE_B64) return json({ error: 'too_large' }, 413)

  // Generous per-user daily guard (fail-open if the RPC isn't installed yet).
  const used = await bumpUsage(authHeader!)
  if (used > DAILY_CAP) return json({ error: 'rate_limited' }, 429)

  try {
    const res = await fetch(`${BASE}/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: body.mediaType || 'image/jpeg', data: body.image } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    })
    if (!res.ok) {
      const kind = res.status === 400 || res.status === 403 ? 'badKey' : 'upstream'
      return json({ error: kind }, 502)
    }
    const data = await res.json()
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text || '')
      .join('')
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return json({ error: 'parse' }, 502)
    return json(JSON.parse(m[0]))
  } catch {
    return json({ error: 'upstream' }, 502)
  }
})
