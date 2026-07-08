import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'

export function Privacy() {
  const { t } = useI18n()
  const sections = ['s1', 's2', 's3', 's4', 's5'] as const
  return (
    <div className="legal-page">
      <div className="legal-card">
        <Link to="/" className="legal-back">
          <Icon name="arrowLeft" size={16} /> {t('landing.backToSite')}
        </Link>
        <h1>{t('privacy.title')}</h1>
        <p className="legal-updated">{t('privacy.updated')}</p>
        <p className="legal-intro">{t('privacy.intro')}</p>
        {sections.map((s) => (
          <section key={s} className="legal-section">
            <h2>{t(`privacy.${s}t`)}</h2>
            <p>{t(`privacy.${s}b`)}</p>
          </section>
        ))}
        <p className="legal-contact">{t('privacy.contact')}</p>
      </div>
    </div>
  )
}
