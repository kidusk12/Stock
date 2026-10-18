import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '../../components/LanguageToggle'
import {
  Boxes,
  ArrowRight,
  Building2,
  ShoppingCart,
  FileText,
  Truck,
  Bell,
  ShieldCheck,
  Barcode,
  Languages,
  PackageCheck,
  Package,
  ArrowLeftRight,
  BarChart3,
  CheckCircle2
} from 'lucide-react'

export default function LandingPage() {
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const features = [
    {
      icon: Building2,
      title: isAm ? 'የበርካታ ቅርንጫፎች ክምችት' : 'Multi-branch stock',
      desc: isAm ? 'በእያንዳንዱ ቅርንጫፍ ያለውን የዕቃ ብዛት በቅጽበት ይከታተሉ።' : 'See quantities per branch in real time.',
    },
    {
      icon: ShoppingCart,
      title: isAm ? 'የግዢ አስተዳደር' : 'Purchasing',
      desc: isAm ? 'የግዢ ትዕዛዞች፣ የሥራ አስኪያጅ ማጽደቂያ እና ዕቃ መቀበያ።' : 'Purchase orders with approval and partial receiving.',
    },
    {
      icon: FileText,
      title: isAm ? 'ሽያጭ እና ደረሰኝ' : 'Sales & invoices',
      desc: isAm ? 'ፈጣን ሽያጭ፣ የቫት/ቶት ስሌት እና የሚታተም ንጹሕ ደረሰኝ።' : 'Fast checkout with printable invoices. Prices include tax.',
    },
    {
      icon: Truck,
      title: isAm ? 'የቅርንጫፍ ዝውውር' : 'Branch transfers',
      desc: isAm ? 'በቅርንጫፎች መካከል መጠየቅ፣ መላክና በደህና መቀበል።' : 'Request, ship and receive between branches with transit tracking.',
    },
    {
      icon: Bell,
      title: isAm ? 'ዝቅተኛ ክምችት ማስጠንቀቂያ' : 'Low-stock alerts',
      desc: isAm ? 'ዕቃዎች ከዝቅተኛው ገደብ ሲያልቁ ፈጣን የማስጠንቀቂያ ደወል።' : 'Minimum levels and real-time notifications for managers.',
    },
    {
      icon: ShieldCheck,
      title: isAm ? 'የማይለወጥ የኦዲት መዝገብ' : 'Audit trail',
      desc: isAm ? 'ማን፣ መቼ፣ ምን እንደቀየረ በግልጽ የሚያሳይ ቋሚ መዝገብ።' : 'Permanent immutable record of who changed what, and when.',
    },
    {
      icon: Barcode,
      title: isAm ? 'የባርኮድ ስካነር' : 'Barcode scanning',
      desc: isAm ? 'ምርቶችን በፍጥነት ፈልጎ ለመሸጥ የዩኤስቢ ስካነር ድጋፍ።' : 'Scan to find products and sell faster with USB scanners.',
    },
    {
      icon: Languages,
      title: isAm ? 'አማርኛ እና እንግሊዝኛ' : 'Amharic & English',
      desc: isAm ? 'የኢትዮጵያ ዘመን አቆጣጠር እና የብር ክፍያ ድጋፍ።' : 'Bilingual interface with Ethiopian calendar and Birr formatting.',
    },
  ]

  const workflowSteps = [
    { num: '01', title: isAm ? 'ግዛ' : 'Buy', icon: ShoppingCart },
    { num: '02', title: isAm ? 'ተቀበል' : 'Receive', icon: PackageCheck },
    { num: '03', title: isAm ? 'ሽጥ' : 'Sell', icon: Package },
    { num: '04', title: isAm ? 'አዘዋውር' : 'Transfer', icon: ArrowLeftRight },
    { num: '05', title: isAm ? 'ሪፖርት እይ' : 'Report', icon: BarChart3 },
  ]

  const roles = [
    {
      role: isAm ? 'አድሚን (Admin)' : 'Admin',
      desc: isAm
        ? 'የድርጅት ቅንብሮችን፣ ተጠቃሚዎችን፣ ቅርንጫፎችን እና ምርቶችን ሙሉ በሙሉ ያስተዳድራል።'
        : 'Manages company settings, users, branches, products and oversee all operations.',
    },
    {
      role: isAm ? 'የቅርንጫፍ ሥራ አስኪያጅ' : 'Branch Manager',
      desc: isAm
        ? 'የአንድ ቅርንጫፍ ስራ ያካሂዳል፤ የግዢና የዝውውር ጥያቄዎችን ያጸድቃል፣ አቅራቢዎችን ያክላል።'
        : 'Runs one branch: approvals, stock thresholds, transfer requests and local staff.',
    },
    {
      role: isAm ? 'ሠራተኛ (Staff)' : 'Staff',
      desc: isAm
        ? 'ዕቃ ይሸጣል፣ ደረሰኝ ያትማል፣ የመጡ ዕቃዎችን ይቀበላል፣ የዕቃ ዝውውር ይጠይቃል።'
        : 'Daily operations: sales, receipts, customer returns and transfer handling.',
    },
    {
      role: isAm ? 'ኦዲተር (Auditor)' : 'Auditor',
      desc: isAm
        ? 'የክምችት ሚዛንን፣ እንቅስቃሴዎችን፣ ሪፖርቶችን እና የኦዲት መዝገብን በንባብ ብቻ ይመለከታል።'
        : 'Reviews stock, movements, adjustments, reports and the immutable audit log (read-only).',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top sticky navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5 font-bold text-slate-900">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Boxes className="h-6 w-6" />
            </span>
            <div>
              <span className="text-xl tracking-tight text-blue-900 font-extrabold">{t('app.name')}</span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-500 font-normal">
                {t('app.subtitle')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-hero border-b border-slate-200">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
              {t('landing.badge')}
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.15]">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              {t('landing.heroDesc')}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-soft hover:bg-blue-700 transition"
              >
                {t('landing.loginCta')}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="relative">
            {/* Visual preview card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-medium text-slate-400">berhan-stock.system</span>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  {isAm ? '3 ቅርንጫፎች ንቁ' : '3 Branches Active'}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{t('landing.stockValueLabel')}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">ETB 1,284,560.00</p>
                  </div>
                  <span className="rounded-lg bg-blue-50 p-3 text-blue-600">
                    <Boxes className="h-6 w-6" />
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-100 p-3 bg-white">
                    <p className="text-xs text-slate-500">{isAm ? 'የዛሬ ሽያጭ' : "Today's Sales"}</p>
                    <p className="font-bold text-emerald-600 mt-1">ETB 41,800.00</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 p-3 bg-white">
                    <p className="text-xs text-slate-500">{isAm ? 'ዝቅተኛ ክምችት' : 'Low Stock Items'}</p>
                    <p className="font-bold text-amber-600 mt-1">3 {isAm ? 'ምርቶች' : 'Products'}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs space-y-2">
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>{isAm ? 'የቅርንጫፍ ስም' : 'Branch'}</span>
                    <span>{isAm ? 'ያለ ክምችት መጠን' : 'Stock Units'}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Bole Branch (ቦሌ)</span>
                    <span className="text-blue-600">470 units</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Merkato Branch (መርካቶ)</span>
                    <span className="text-blue-600">315 units</span>
                  </div>
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Hawassa Warehouse (ሐዋሳ)</span>
                    <span className="text-blue-600">830 units</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-slate-900 sm:text-4xl">
          {t('landing.featuresTitle')}
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feat, idx) => {
            const Icon = feat.icon
            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-soft transition hover:-translate-y-0.5"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{feat.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{feat.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-deep text-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white">
            {t('landing.howItWorksTitle')}
          </h2>
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-5 text-center">
            {workflowSteps.map((step, idx) => {
              const Icon = step.icon
              return (
                <div key={idx} className="flex flex-col items-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white backdrop-blur border border-white/10">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="mt-3 text-xs font-semibold text-blue-300">{step.num}</span>
                  <span className="mt-1 text-base font-bold">{step.title}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Built for every role */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold text-slate-900">
          {t('landing.rolesTitle')}
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="inline-block rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                {r.role}
              </span>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 text-sm text-slate-500">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white">
              <Boxes className="h-5 w-5" />
            </span>
            <span>{t('app.name')}</span>
          </div>
          <p>© 2026 {t('app.name')}. {t('landing.footerText')}</p>
        </div>
      </footer>
    </div>
  )
}
