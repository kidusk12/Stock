import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-700">404</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900">{t('notFound.title')}</h1>
        <p className="mt-3 text-slate-600">{t('notFound.description')}</p>
        <Link to="/" className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">
          {t('notFound.home')}
        </Link>
      </div>
    </main>
  )
}
