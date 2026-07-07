import { useI18n, LANGUAGES } from '../i18n'
import { useStore } from '../store'
import { Icon } from '../components/Icon'

export function Landing({ onEnter }: { onEnter: () => void }) {
  const { t } = useI18n()
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  const features = [
    { icon: 'bolt', key: 'scan' },
    { icon: 'check', key: 'settle' },
    { icon: 'chart', key: 'analytics' },
    { icon: 'shield', key: 'discipline' },
  ] as const

  const steps = [
    { icon: 'camera', key: 's1' },
    { icon: 'refresh', key: 's2' },
    { icon: 'trendUp', key: 's3' },
  ] as const

  return (
    <div className="landing">
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
          <button className="btn btn-sm" onClick={onEnter}>
            {t('landing.openApp')}
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-logo-badge">
          <img src="/icon.svg" width="72" height="72" alt="" />
        </div>
        <h1>{t('landing.hero.title')}</h1>
        <p className="lp-sub">{t('landing.hero.subtitle')}</p>
        <button className="btn btn-primary btn-lg lp-cta" onClick={onEnter}>
          {t('landing.hero.cta')} <Icon name="chevronRight" size={18} />
        </button>
        <p className="lp-note">{t('landing.hero.note')}</p>
      </section>

      <section className="lp-features">
        <h2>{t('landing.features.title')}</h2>
        <div className="lp-feature-grid">
          {features.map((f) => (
            <div key={f.key} className="lp-feature">
              <div className="lp-feature-icon">
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
        <h2>{t('landing.cta.title')}</h2>
        <button className="btn btn-primary btn-lg lp-cta" onClick={onEnter}>
          {t('landing.hero.cta')} <Icon name="chevronRight" size={18} />
        </button>
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
