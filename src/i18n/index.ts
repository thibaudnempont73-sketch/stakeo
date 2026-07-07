import { createContext, useContext } from 'react'
import { en, type Dict } from './en'
import { fr } from './fr'
import { es } from './es'
import { de } from './de'
import { it } from './it'
import { pt } from './pt'

export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
]

const dicts: Record<string, Dict> = { en, fr, es, de, it, pt }

export type TFunc = (key: keyof typeof en, params?: Record<string, string | number>) => string

export function makeT(lang: string): TFunc {
  const dict = { ...en, ...(dicts[lang] || {}) }
  return (key, params) => {
    let s: string = dict[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
    }
    return s
  }
}

export function detectLanguage(): string {
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return dicts[nav] ? nav : 'en'
}

export const I18nContext = createContext<{ t: TFunc; lang: string }>({ t: makeT('en'), lang: 'en' })

export function useI18n() {
  return useContext(I18nContext)
}
