// Supabase Edge Function: delete-account (RGPD "right to erasure").
//
// The signed-in browser calls this; we verify the caller, then use the
// service_role to hard-delete their auth user. Every user table
// (profiles, bankrolls, bets, transactions, scan_usage) references
// auth.users(id) ON DELETE CASCADE, so one call erases all their data.
// The service_role key lives ONLY here. Deploy:
//   supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

async function getUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !SUPABASE_URL || !ANON) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: ANON },
    })
    if (!res.ok) return null
    return (await res.json())?.id ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get('origin'))
  const json = (obj: unknown, status = 200): Response =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!SERVICE) return json({ error: 'not_configured' }, 500)

  const userId = await getUserId(req.headers.get('authorization'))
  if (!userId) return json({ error: 'unauthorized' }, 401)

  try {
    const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return json({ error: 'delete_failed', detail: error.message }, 500)
    return json({ ok: true })
  } catch (e) {
    return json({ error: 'delete_failed', detail: (e as Error).message }, 500)
  }
})
