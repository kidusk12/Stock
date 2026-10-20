import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../../components/LanguageToggle'
import { useAuth } from '../auth/AuthContext'
import {
  Boxes, ArrowRight, Building2, ShoppingCart, FileText, Truck, Bell,
  ShieldCheck, Barcode, Languages, PackageCheck, Package, ArrowLeftRight,
  BarChart3, CheckCircle2,
} from 'lucide-react'

export default function LandingPage() {
  const { t } = useTranslation()
  const { loading } = useAuth()

  if (loading) return <main role="status" className="min-h-screen grid place-items-center">{t('common.loading')}</main>

  const features = [
    [Building2, 'branches'], [ShoppingCart, 'purchasing'], [FileText, 'sales'],
    [Truck, 'transfers'], [Bell, 'alerts'], [ShieldCheck, 'audit'],
    [Barcode, 'barcode'], [Languages, 'language'],
  ]
  const steps = [
    [ShoppingCart, 'buy'], [PackageCheck, 'receive'], [Package, 'sell'],
    [ArrowLeftRight, 'transfer'], [BarChart3, 'report'],
  ]
  const roles = ['admin', 'manager', 'staff', 'auditor']

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-slate-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Boxes className="h-6 w-6" aria-hidden="true" />
            </span>
            <span>
              <span className="text-xl tracking-tight text-blue-900 font-extrabold">{t('app.name')}</span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-500 font-normal">{t('app.subtitle')}</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Link to="/login" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition">
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-hero border-b border-slate-200">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                {t('landing.badge')}
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.15]">{t('landing.heroTitle')}</h1>
              <p className="mt-5 text-lg leading-relaxed text-slate-600">{t('landing.heroDesc')}</p>
              <div className="mt-8">
                <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-soft hover:bg-blue-700 transition">
                  {t('landing.loginCta')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Boxes className="h-6 w-6" aria-hidden="true" /></span>
                <div>
                  <h2 className="font-bold text-slate-900">{t('landing.previewTitle')}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t('landing.previewDescription')}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-slate-700">
                {['stock', 'purchasing', 'sales', 'movements'].map((item) => (
                  <li key={item} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    {t(`landing.previewItems.${item}`)}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">{t('landing.previewNote')}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold text-slate-900 sm:text-4xl">{t('landing.featuresTitle')}</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([Icon, key]) => (
              <article key={key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-soft transition hover:-translate-y-0.5">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-6 w-6" aria-hidden="true" /></div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{t(`landing.features.${key}.title`)}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t(`landing.features.${key}.description`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-deep text-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">{t('landing.howItWorksTitle')}</h2>
            <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-5 text-center">
              {steps.map(([Icon, key], index) => (
                <div key={key} className="flex flex-col items-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 border border-white/10"><Icon className="h-7 w-7" aria-hidden="true" /></div>
                  <span className="mt-3 text-xs font-semibold text-blue-300">{String(index + 1).padStart(2, '0')}</span>
                  <span className="mt-1 text-base font-bold">{t(`landing.steps.${key}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold text-slate-900">{t('landing.rolesTitle')}</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((role) => (
              <article key={role} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="inline-block rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">{t(`auth.${role}`)}</span>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{t(`landing.roles.${role}`)}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 text-sm text-slate-500">
          <div className="flex items-center gap-2 font-bold text-slate-800"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white"><Boxes className="h-5 w-5" aria-hidden="true" /></span><span>{t('app.name')}</span></div>
          <p>© 2026 {t('app.name')}. {t('landing.footerText')}</p>
        </div>
      </footer>
    </div>
  )
}
