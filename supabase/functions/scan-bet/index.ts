// Supabase Edge Function: scan-bet
//
// The (authenticated) browser sends a bet-slip image; this function calls
// Gemini vision with the extraction prompt and returns the structured bet.
// The Gemini key lives ONLY here (function secret GEMINI_API_KEY) — never in
// the browser. Deploy: `supabase functions deploy scan-bet`.

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODEL = 'gemini-2.5-flash-lite'
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

Rules:
- Keep event names, markets and selections in their ORIGINAL language, exactly as written on the slip.
- Always output DECIMAL (European) odds. Convert fractional or american odds to decimal.
- For an accumulator (combiné/parlay/multiple), set type="combo" and list every selection in "legs" with its own decimal odds; "odds" is the total (product of legs); leave "market" empty.
- For a single bet, set type="single", fill "market" with the market+selection, and leave "legs" as [].
- "stake" is the amount wagered as a number (0 if not visible). "bookmaker" is the app/site name if identifiable, else "".
- "sport" must be one of: ${SPORTS.join(', ')}.
- "date" is the event start as "YYYY-MM-DDTHH:MM" if visible, else "".
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
