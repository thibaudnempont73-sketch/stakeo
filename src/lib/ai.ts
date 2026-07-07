import { supabase, isSupabaseConfigured } from './supabase'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ''

// The AI scan runs through the `scan-bet` Edge Function (key stays server-side),
// so it's available whenever the backend is configured.
export const hasAI = isSupabaseConfigured

export type AIErrorKind = 'badKey' | 'network' | 'parse' | 'notConfigured'

export class AIError extends Error {
  kind: AIErrorKind
  constructor(kind: AIErrorKind, message?: string) {
    super(message || kind)
    this.kind = kind
  }
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

/** Scan a bet-slip image via the server-side proxy (Gemini key never in the browser). */
export async function extractBetFromImage(imageBase64: string, mediaType: string): Promise<ExtractedBet> {
  if (!SUPABASE_URL || !supabase) throw new AIError('notConfigured')
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token || ANON

  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/scan-bet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: ANON,
      },
      body: JSON.stringify({ image: imageBase64, mediaType }),
    })
  } catch {
    throw new AIError('network')
  }

  if (!res.ok) {
    let kind: AIErrorKind = res.status === 404 || res.status === 500 ? 'notConfigured' : 'parse'
    if (res.status === 401 || res.status === 403) kind = 'badKey'
    try {
      const e = await res.json()
      if (e?.error === 'badKey') kind = 'badKey'
      else if (e?.error === 'not_configured') kind = 'notConfigured'
    } catch {
      /* ignore */
    }
    throw new AIError(kind)
  }

  let json: any
  try {
    json = await res.json()
  } catch {
    throw new AIError('parse')
  }
  if (json?.error) throw new AIError(json.error === 'badKey' ? 'badKey' : 'parse')
  return json as ExtractedBet
}
