import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n, LANGUAGES } from '../i18n'
import { useStore } from '../store'
import { supabase } from '../lib/supabase'
import { classifyAuthError } from '../auth'
import { Icon } from '../components/Icon'
import { Field } from '../components/ui'

type Mode = 'signin' | 'signup' | 'reset'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Auth({ mode: initialMode }: { mode: 'signin' | 'signup' }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [resent, setResent] = useState(false)

  const err = (k: string) => setError(t(`auth.err.${k}` as 'auth.err.unknown'))

  const validate = (needPassword: boolean) => {
    if (!email.trim()) return err('emailRequired'), false
    if (!EMAIL_RE.test(email.trim())) return err('emailInvalid'), false
    if (needPassword && !password) return err('passwordRequired'), false
    if (needPassword && mode === 'signup' && password.length < 6) return err('weak'), false
    return true
  }

  const submit = async () => {
    if (!supabase || loading) return
    setError(null)
    const needPw = mode !== 'reset'
    if (!validate(needPw)) return
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) err(classifyAuthError(error))
        else setSentTo(email.trim())
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) err(classifyAuthError(error))
        // success → onAuthStateChange swaps the view automatically
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) err(classifyAuthError(error))
        else setResetSent(true)
      }
    } catch {
      err('network')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (!supabase || !sentTo) return
    await supabase.auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: window.location.origin } })
    setResent(true)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setResetSent(false)
  }

  return (
    <div className="auth-page">
      <header className="auth-top">
        <button className="link-btn" onClick={() => navigate('/')}>
          <Icon name="arrowLeft" size={16} /> {t('auth.back')}
        </button>
        <select
          className="lp-lang"
          value={settings.language}
          onChange={(e) => updateSettings({ language: e.target.value })}
          aria-label="Language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </header>

      <div className="auth-card">
        <div className="auth-logo">
          <img src="/icon.svg" width="44" height="44" alt="" />
        </div>

        {sentTo ? (
          <div className="auth-confirm">
            <div className="auth-confirm-icon">
              <Icon name="mail" size={26} />
            </div>
            <h1>{t('auth.check.title')}</h1>
            <p>{t('auth.check.body', { email: sentTo })}</p>
            <button className="btn btn-primary btn-lg" onClick={() => switchMode('signin')}>
              {t('auth.signIn')}
            </button>
            {resent ? (
              <p className="auth-resent">{t('auth.check.resent')}</p>
            ) : (
              <button className="link-btn auth-resend" onClick={resend}>
                {t('auth.check.resend')}
              </button>
            )}
          </div>
        ) : mode === 'reset' ? (
          <>
            <h1>{t('auth.reset.title')}</h1>
            <p className="auth-sub">{t('auth.reset.sub')}</p>
            {resetSent ? (
              <p className="auth-info">{t('auth.reset.sent', { email: email.trim() })}</p>
            ) : (
              <div className="auth-form">
                <Field label={t('auth.email')}>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                {error && <p className="field-error">{error}</p>}
                <button className="btn btn-primary btn-lg" onClick={submit} disabled={loading}>
                  {loading ? <span className="spinner spinner-sm" /> : t('auth.reset.send')}
                </button>
              </div>
            )}
            <button className="link-btn auth-alt" onClick={() => switchMode('signin')}>
              {t('auth.back')}
            </button>
          </>
        ) : (
          <>
            {mode === 'signup' && <span className="auth-badge">{t('auth.trial.badge')}</span>}
            <h1>{mode === 'signup' ? t('auth.signUpTitle') : t('auth.signInTitle')}</h1>
            <p className="auth-sub">{mode === 'signup' ? t('auth.signUpSub') : t('auth.signInSub')}</p>
            <div className="auth-form">
              <Field label={t('auth.email')}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="nom@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label={t('auth.password')}>
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </Field>
              {error && <p className="field-error">{error}</p>}
              <button className="btn btn-primary btn-lg" onClick={submit} disabled={loading}>
                {loading ? <span className="spinner spinner-sm" /> : mode === 'signup' ? t('auth.signUp') : t('auth.signIn')}
              </button>
            </div>
            {mode === 'signin' && (
              <button className="link-btn auth-forgot" onClick={() => switchMode('reset')}>
                {t('auth.forgot')}
              </button>
            )}
            <button className="link-btn auth-alt" onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}>
              {mode === 'signup' ? t('auth.toSignIn') : t('auth.toSignUp')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
