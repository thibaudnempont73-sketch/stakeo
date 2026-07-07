import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  ready: boolean
  init: () => void
  signOut: () => Promise<void>
}

let initialized = false

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  ready: false,
  init: () => {
    if (initialized) return
    initialized = true
    if (!supabase) {
      set({ ready: true })
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, ready: true })
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, ready: true })
    })
  },
  signOut: async () => {
    await supabase?.auth.signOut()
    set({ session: null, user: null })
  },
}))

export { isSupabaseConfigured }

// Accounts that bypass the subscription/paywall entirely (owner / staff).
export const ADMIN_EMAILS = ['thibaudnempont73@gmail.com']

export function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

export type AuthErrorKind = 'invalid' | 'notConfirmed' | 'exists' | 'weak' | 'emailInvalid' | 'rate' | 'network' | 'unknown'

export function classifyAuthError(error: { message: string; code?: string }): AuthErrorKind {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'exists'
    case 'email_not_confirmed':
      return 'notConfirmed'
    case 'invalid_credentials':
      return 'invalid'
    case 'weak_password':
      return 'weak'
    case 'email_address_invalid':
      return 'emailInvalid'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rate'
  }
  const m = error.message.toLowerCase()
  if (m.includes('already') || m.includes('registered')) return 'exists'
  if (m.includes('not confirmed') || m.includes('confirm')) return 'notConfirmed'
  if (m.includes('email') && m.includes('invalid')) return 'emailInvalid'
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalid'
  if (m.includes('rate') || m.includes('too many') || m.includes('seconds')) return 'rate'
  if (m.includes('password') && (m.includes('least') || m.includes('short') || m.includes('6'))) return 'weak'
  if (m.includes('network') || m.includes('fetch')) return 'network'
  return 'unknown'
}
