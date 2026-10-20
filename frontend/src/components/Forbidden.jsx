import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Forbidden() {
  const { t } = useTranslation()
  return (
    <main className="min-h-[50vh] grid place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-[#4f7988]">403</p>
        <h1 className="mt-3 text-3xl font-extrabold text-[#15343f]">{t('forbidden.title')}</h1>
        <p className="mt-3 text-[#4b6b79]">{t('forbidden.description')}</p>
        <Link to="/dashboard" className="mt-6 inline-flex rounded-lg bg-[#173d4a] px-5 py-2.5 font-semibold text-white hover:bg-[#12303a]">
          {t('forbidden.home')}
        </Link>
      </div>
    </main>
  )
}
