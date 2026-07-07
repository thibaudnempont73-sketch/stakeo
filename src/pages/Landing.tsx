import { Link, useNavigate } from 'react-router-dom'
import { useI18n, LANGUAGES } from '../i18n'
import { useStore } from '../store'
import { useAuth } from '../auth'
import { Icon } from '../components/Icon'

export function Landing() {
  const { t } = useI18n()
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const session = useAuth((s) => s.session)
  const signOut = useAuth((s) => s.signOut)
  const navigate = useNavigate()
  const loggedIn = !!session

  const features = [
    { icon: 'bolt', key: 'scan', tone: 'accent' },
    { icon: 'check', key: 'settle', tone: 'pos' },
    { icon: 'chart', key: 'analytics', tone: 'blue' },
    { icon: 'shield', key: 'discipline', tone: 'purple' },
  ] as const

  const steps = [
    { icon: 'camera', key: 's1' },
    { icon: 'refresh', key: 's2' },
    { icon: 'trendUp', key: 's3' },
  ] as const

  const primaryCta = () => navigate(loggedIn ? '/app' : '/signup')

  return (
    <div className="landing">
      <div className="lp-glow" aria-hidden="true" />

      <header className="lp-nav">
        <div className="lp-logo">
          <img src="/icon.svg" width="30" height="30" alt="" />
          <span>{t('app.name')}</span>
        </div>
        <div className="lp-nav-right">
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
          {loggedIn ? (
            <>
              <button className="btn btn-sm lp-ghost" onClick={() => signOut()}>
                {t('auth.signOut')}
              </button>
              <Link className="btn btn-sm btn-primary" to="/app">
                {t('landing.openApp')}
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-sm lp-ghost" to="/login">
                {t('landing.login')}
              </Link>
              <Link className="btn btn-sm btn-primary" to="/signup">
                {t('landing.signup')}
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="lp-hero">
        <span className="lp-pill">
          <Icon name="sparkles" size={14} /> {t('landing.hero.pill')}
        </span>
        <h1>{t('landing.hero.title')}</h1>
        <p className="lp-sub">{t('landing.hero.subtitle')}</p>
        <div className="lp-hero-cta">
          <button className="btn btn-primary btn-lg lp-cta" onClick={primaryCta}>
            {loggedIn ? t('landing.openApp') : t('landing.hero.cta')} <Icon name="chevronRight" size={18} />
          </button>
        </div>
        <p className="lp-note">{t('landing.hero.note')}</p>

        <LandingPreview />
      </section>

      <section className="lp-features">
        <h2>{t('landing.features.title')}</h2>
        <div className="lp-feature-grid">
          {features.map((f) => (
            <div key={f.key} className="lp-feature">
              <div className={`lp-feature-icon tone-${f.tone}`}>
                <Icon name={f.icon} size={22} />
              </div>
              <h3>{t(`landing.f.${f.key}.title` as 'landing.f.scan.title')}</h3>
              <p>{t(`landing.f.${f.key}.desc` as 'landing.f.scan.desc')}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-how">
        <h2>{t('landing.how.title')}</h2>
        <div className="lp-steps">
          {steps.map((s, i) => (
            <div key={s.key} className="lp-step">
              <div className="lp-step-num">{i + 1}</div>
              <Icon name={s.icon} size={24} />
              <h3>{t(`landing.how.${s.key}.title` as 'landing.how.s1.title')}</h3>
              <p>{t(`landing.how.${s.key}.desc` as 'landing.how.s1.desc')}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <div className="lp-final-card">
          <h2>{t('landing.cta.title')}</h2>
          <button className="btn btn-primary btn-lg lp-cta" onClick={primaryCta}>
            {loggedIn ? t('landing.openApp') : t('landing.hero.cta')} <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-logo">
          <img src="/icon.svg" width="24" height="24" alt="" />
          <span>{t('app.name')}</span>
        </div>
        <p>{t('landing.footer.disclaimer')}</p>
      </footer>
    </div>
  )
}

// A small stylized preview of the dashboard — pure CSS/markup, no data.
function LandingPreview() {
  const { t } = useI18n()
  return (
    <div className="lp-preview" aria-hidden="true">
      <div className="lp-preview-top">
        <div>
          <span className="lp-preview-label">{t('dash.balance')}</span>
          <span className="lp-preview-balance">1 247,50 €</span>
        </div>
        <span className="lp-preview-badge">
          <Icon name="trendUp" size={13} /> +12,4 %
        </span>
      </div>
      <svg className="lp-preview-chart" viewBox="0 0 300 70" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lpg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,55 L40,50 L80,58 L120,42 L160,46 L200,30 L240,34 L300,10 L300,70 L0,70 Z" fill="url(#lpg)" />
        <path
          d="M0,55 L40,50 L80,58 L120,42 L160,46 L200,30 L240,34 L300,10"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="lp-preview-stats">
        <div>
          <span>{t('dash.profit')}</span>
          <strong className="pos">+247,50 €</strong>
        </div>
        <div>
          <span>{t('dash.yield')}</span>
          <strong className="pos">+8,2 %</strong>
        </div>
        <div>
          <span>{t('dash.winRate')}</span>
          <strong>58 %</strong>
        </div>
      </div>
    </div>
  )
}
