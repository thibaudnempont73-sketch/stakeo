// Supabase Edge Function: scan-bet
//
// The (authenticated) browser sends a bet-slip image; this function calls
// Gemini vision with the extraction prompt and returns the structured bet.
// The Gemini key lives ONLY here (function secret GEMINI_API_KEY) — never in
// the browser. Deploy: `supabase functions deploy scan-bet`.

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
// Flash (not Flash-Lite): far more reliable at reading multi-leg combos.
const MODEL = 'gemini-2.5-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const SPORTS = [
  'football', 'tennis', 'basketball', 'esports', 'rugby', 'handball', 'volleyball', 'hockey',
  'baseball', 'amfootball', 'mma', 'boxing', 'golf', 'horse', 'motorsport', 'darts', 'other',
]

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = `You extract structured data from a sports betting slip screenshot (Winamax, Betclic, Bet365, Unibet, Stake, PMU, etc.).

FIRST decide single vs combo by COUNTING the matches on the slip:
- If the slip shows 2 OR MORE distinct matches/events, it is a COMBO (combiné / parlay / accumulator / multiple). Set type="combo".
- If it shows exactly ONE match, it is a SINGLE. Set type="single".

For a COMBO — this is critical:
- You MUST include EVERY match as a separate entry in "legs". Never drop a match, never merge two matches into one. If there are 2 matches, "legs" has exactly 2 entries; if 3, then 3; etc.
- Each leg = one match: put the event + the picked selection in "selection", and that leg's OWN decimal odds in "odds".
- The top-level "odds" is the TOTAL = the product of all leg odds. "market" stays "".
- Scan the whole image top to bottom; combos often list matches in a vertical list — include all of them.

For a SINGLE:
- Fill "market" with the market + selection, and leave "legs" as [].

General rules:
- Keep event names, markets and selections in their ORIGINAL language, exactly as written.
- Always output DECIMAL (European) odds. Convert fractional/american odds to decimal.
- "stake" = amount wagered (0 if not visible). "bookmaker" = app/site name if identifiable, else "".
- "sport" must be one of: ${SPORTS.join(', ')}.
- "date" = event start "YYYY-MM-DDTHH:MM" if visible, else "".
- If the image is NOT a bet slip, set found=false and leave the rest empty/zero.

Respond with ONLY a JSON object of this exact shape, no markdown:
{"found":boolean,"event":string,"sport":string,"market":string,"type":"single"|"combo","legs":[{"selection":string,"odds":number}],"odds":number,"stake":number,"bookmaker":string,"isLive":boolean,"date":string}`

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!GEMINI_KEY) return json({ error: 'not_configured' }, 500)

  let body: { image?: string; mediaType?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!body.image) return json({ error: 'no_image' }, 400)

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
