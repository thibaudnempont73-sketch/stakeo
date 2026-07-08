import { useState } from 'react'
import { useI18n, LANGUAGES } from '../i18n'
import { useStore } from '../store'
import { CURRENCIES } from '../hooks'
import { Field } from '../components/ui'
import { Icon } from '../components/Icon'

export function Onboarding() {
  const { t } = useI18n()
  const createBankroll = useStore((s) => s.createBankroll)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [capital, setCapital] = useState('')

  const start = () => {
    const cap = parseFloat(capital.replace(',', '.'))
    createBankroll(name.trim() || t('onboarding.bankrollNamePh'), currency, isFinite(cap) && cap > 0 ? cap : 0)
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="logo-row">
          <img src="/icon.svg" alt="" width={44} height={44} />
          <div>
            <h1>{t('app.name')}</h1>
            <p className="tagline">{t('app.tagline')}</p>
          </div>
        </div>

        <p className="onboarding-sub">{t('onboarding.subtitle')}</p>

        <ul className="feature-list">
          <li>
            <Icon name="camera" size={18} />
            <span>{t('onboarding.f1')}</span>
          </li>
          <li>
            <Icon name="sparkles" size={18} />
            <span>{t('onboarding.f2')}</span>
          </li>
          <li>
            <Icon name="chart" size={18} />
            <span>{t('onboarding.f3')}</span>
          </li>
        </ul>

        <Field label={t('onboarding.language')}>
          <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('onboarding.bankrollName')}>
          <input type="text" placeholder={t('onboarding.bankrollNamePh')} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="form-row">
          <Field label={t('onboarding.currency')}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('onboarding.startingCapital')}>
            <input type="text" inputMode="decimal" placeholder="200" value={capital} onChange={(e) => setCapital(e.target.value)} />
          </Field>
        </div>

        <button className="btn btn-primary btn-lg" onClick={start}>
          {t('onboarding.start')}
        </button>
      </div>
    </div>
  )
}
