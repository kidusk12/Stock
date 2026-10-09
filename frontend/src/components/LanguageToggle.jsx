import { useTranslation } from 'react-i18next'

const LANGS = ['en', 'am']

export default function LanguageToggle() {
  const { i18n, t } = useTranslation()

  return (
    <div className="flex rounded border overflow-hidden text-sm" role="group" aria-label={t('lang.label')}>
      {LANGS.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`px-3 py-1 ${
            i18n.language === lng ? 'bg-brand text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t(`lang.${lng}`)}
        </button>
      ))}
    </div>
  )
}