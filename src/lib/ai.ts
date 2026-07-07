import type { Bet } from '../types'
import { SPORTS } from '../hooks'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const VISION_MODEL = 'gemini-2.5-flash-lite'
const SEARCH_MODEL = 'gemini-2.5-flash'

// The Gemini key belongs to the app, not the user. Local/dev: read from .env
// (VITE_GEMINI_API_KEY). Production: this moves behind a server-side proxy so
// the key is never shipped to the browser (Phase 2).
export const GEMINI_KEY = ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '').trim()
export const hasAI = GEMINI_KEY.length > 0

export type AIErrorKind = 'badKey' | 'network' | 'parse'

export class AIError extends Error {
  kind: AIErrorKind
  constructor(kind: AIErrorKind, message?: string) {
    super(message || kind)
    this.kind = kind
  }
}

interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

interface GeminiBody {
  contents: { role?: string; parts: GeminiPart[] }[]
  systemInstruction?: { parts: { text: string }[] }
  generationConfig?: Record<string, unknown>
  tools?: Record<string, unknown>[]
}

async function callGemini(apiKey: string, model: string, body: GeminiBody): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AIError('network')
  }
  if (!res.ok) {
    if (res.status === 400 || res.status === 403) throw new AIError('badKey')
    throw new AIError('network')
  }
  let json: any
  try {
    json = await res.json()
  } catch {
    throw new AIError('parse')
  }
  const text = json?.candidates?.[0]?.content?.parts?.map((p: GeminiPart) => p.text || '').join('') ?? ''
  if (!text) throw new AIError('parse')
  return text
}

export async function compressImage(blob: Blob): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const maxDim = 1400
  let w: number
  let h: number
  let draw: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void

  try {
    const bitmap = await createImageBitmap(blob)
    w = bitmap.width
    h = bitmap.height
    draw = (ctx, cw, ch) => {
      ctx.drawImage(bitmap, 0, 0, cw, ch)
      bitmap.close()
    }
  } catch {
    const url = URL.createObjectURL(blob)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new AIError('parse'))
      el.src = url
    })
    w = img.naturalWidth
    h = img.naturalHeight
    draw = (ctx, cw, ch) => {
      ctx.drawImage(img, 0, 0, cw, ch)
      URL.revokeObjectURL(url)
    }
  }

  const scale = Math.min(1, maxDim / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  draw(ctx, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' }
}

export interface ExtractedBet {
  found: boolean
  event: string
  sport: string
  market: string
  type: 'single' | 'combo'
  legs: { selection: string; odds: number }[]
  odds: number
  stake: number
  bookmaker: string
  isLive: boolean
  date: string
}

const EXTRACT_PROMPT = `You extract structured data from a sports betting slip screenshot (Winamax, Betclic, Bet365, Unibet, Stake, PMU, etc.).

Rules:
- Keep event names, markets and selections in their ORIGINAL language, exactly as written on the slip.
- Always output DECIMAL (European) odds. Convert fractional (e.g. 5/2) or american (e.g. +150 / -120) odds to decimal.
- For an accumulator (combiné / parlay / multiple), set type="combo" and list every selection in "legs" with its own decimal odds; "odds" is the total (product of legs); leave "market" empty.
- For a single bet, set type="single", fill "market" with the market+selection, and leave "legs" as [].
- "stake" is the amount wagered as a number (0 if not visible). "bookmaker" is the app/site name if identifiable, else "".
- "sport" must be one of: ${SPORTS.join(', ')}.
- "date" is the event start as "YYYY-MM-DDTHH:MM" if visible, else "".
- If the image is NOT a bet slip, set found=false and leave the rest empty/zero.

Respond with ONLY a JSON object of this exact shape, no markdown, no comments:
{"found":boolean,"event":string,"sport":string,"market":string,"type":"single"|"combo","legs":[{"selection":string,"odds":number}],"odds":number,"stake":number,"bookmaker":string,"isLive":boolean,"date":string}`

function parseJSON<T>(text: string, wrapper: 'object' | 'array'): T {
  const open = wrapper === 'array' ? '[' : '{'
  const close = wrapper === 'array' ? ']' : '}'
  const start = text.indexOf(open)
  const end = text.lastIndexOf(close)
  if (start < 0 || end < 0) throw new AIError('parse')
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    throw new AIError('parse')
  }
}

export async function extractBetFromImage(apiKey: string, imageBase64: string, mediaType: string): Promise<ExtractedBet> {
  const text = await callGemini(apiKey, VISION_MODEL, {
    contents: [
      {
        parts: [{ inline_data: { mime_type: mediaType, data: imageBase64 } }, { text: EXTRACT_PROMPT }],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  })
  return parseJSON<ExtractedBet>(text, 'object')
}

export interface SettleVerdict {
  id: string
  status: 'won' | 'lost' | 'void' | 'halfwon' | 'halflost' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  explanation: string
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
}

export async function checkResults(apiKey: string, bets: Bet[], lang: string): Promise<SettleVerdict[]> {
  const list = bets.map((b) => ({
    id: b.id,
    sport: b.sport,
    event: b.event,
    kickoff: b.date,
    bet: b.type === 'combo' ? undefined : b.market,
    legs: b.type === 'combo' ? b.legs.map((l) => l.selection) : undefined,
  }))

  const prompt = `You verify the outcome of sports bets. The current date-time is ${new Date().toISOString().slice(0, 16)} (user local time).

For each bet, use Google Search to find the FINAL result of the event, then decide the bet outcome:
- "won": the selection was correct (for a combo, ALL legs won)
- "lost": the selection was wrong (for a combo, at least one leg lost)
- "void": event cancelled or postponed
- "halfwon"/"halflost": only for half-won/half-lost asian handicaps
- "unknown": event not finished yet, OR you cannot confirm the result with confidence. NEVER guess — when unsure, use "unknown".

Bets:
${JSON.stringify(list, null, 1)}

Reply with ONLY a JSON array, no markdown:
[{"id":"...","status":"won|lost|void|halfwon|halflost|unknown","confidence":"high|medium|low","explanation":"one short sentence in ${LANG_NAMES[lang] || 'English'}, include the final score when found"}]`

  const text = await callGemini(apiKey, SEARCH_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  })
  const verdicts = parseJSON<SettleVerdict[]>(text, 'array')
  return verdicts.filter((v) => bets.some((b) => b.id === v.id))
}
