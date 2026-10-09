import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import am from './am.json'

const STORAGE_KEY = 'sms_lang'

let saved = null
try {
  saved = localStorage.getItem(STORAGE_KEY)
} catch {
  // storage unavailable: fall back to English
}
const initial = saved === 'am' || saved === 'en' ? saved : 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    am: { translation: am },
  },
  lng: initial,
  fallbackLng: 'en', // a key missing in am.json shows the English text
  interpolation: { escapeValue: false }, // React already escapes
})

document.documentElement.lang = initial

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // ignore
  }
})

export default i18n