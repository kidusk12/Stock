import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { api } from '../../lib/api'
import { formatETB } from '../../lib/ethiopianDate'
import {
  Boxes,
  Layers,
  TrendingUp,
  PackageOpen,
  Info,
  Users,
  MoreVertical,
  ArrowRight
} from 'lucide-react'

export default function Dashboard() {
  const { user, selectedBranchId } = useAuth()
  const { t, i18n } = useTranslation()
  const isAm = i18n.language === 'am'

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/dashboard/stats', { branchId: selectedBranchId })
      .then((res) => setStats(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [selectedBranchId])

  // Top 10 Stores matching the reference screenshot exactly
  const storesData = [
    { name: 'Gateway str', val: '874k', width: '92%' },
    { name: 'The Rustic Fox', val: '721k', width: '78%' },
    { name: 'Velvet Vine', val: '598k', width: '64%' },
    { name: 'Blue Harbor', val: '586k', width: '62%' },
    { name: 'Nebula Novelties', val: '395k', width: '44%' },
    { name: 'Crimson Crafters', val: '344k', width: '38%' },
    { name: 'Tidal Treasures', val: '274k', width: '30%' },
    { name: 'Whimsy Wid', val: '213k', width: '24%' },
    { name: 'Mercantile', val: '183k', width: '20%' },
    { name: 'Emporium', val: '176k', width: '18%' },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-8">
      {/* ---------------- 1. Over View Section ---------------- */}
      <div>
        <h2 className="text-sm font-bold text-[#15343f] mb-3">
          {isAm ? 'አጠቃላይ እይታ' : 'Over View'}
        </h2>

        {/* 4 Cards Grid matching reference image */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Products */}
          <div className="bg-white rounded-2xl border border-[#cfdde3] p-4 flex items-center gap-4 shadow-clean hover:shadow-md transition">
            <div className="h-11 w-11 rounded-xl bg-[#e3f2ec] text-[#28846c] flex items-center justify-center shrink-0">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-[#15343f]">5483</div>
              <div className="text-xs text-[#728994] font-medium mt-0.5">
                {isAm ? 'ጠቅላላ ምርቶች' : 'Total Products'}
              </div>
            </div>
          </div>

          {/* Card 2: Orders */}
          <div className="bg-white rounded-2xl border border-[#cfdde3] p-4 flex items-center gap-4 shadow-clean hover:shadow-md transition">
            <div className="h-11 w-11 rounded-xl bg-[#e3ecf5] text-[#3e76a6] flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-[#15343f]">2859</div>
              <div className="text-xs text-[#728994] font-medium mt-0.5">
                {isAm ? 'ትዕዛዞች' : 'Orders'}
              </div>
            </div>
          </div>

          {/* Card 3: Total Stock */}
          <div className="bg-white rounded-2xl border border-[#cfdde3] p-4 flex items-center gap-4 shadow-clean hover:shadow-md transition">
            <div className="h-11 w-11 rounded-xl bg-[#e6f4ef] text-[#2e8a71] flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-[#15343f]">5483</div>
              <div className="text-xs text-[#728994] font-medium mt-0.5">
                {isAm ? 'ያለ ክምችት መጠን' : 'Total Stock'}
              </div>
            </div>
          </div>

          {/* Card 4: Out of Stock (Peach Theme matching screenshot) */}
          <div className="bg-[#fbece5] rounded-2xl border border-[#f5d5c6] p-4 flex items-center justify-between shadow-clean relative hover:shadow-md transition">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-[#f7ded4] text-[#c66749] flex items-center justify-center shrink-0">
                <PackageOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[#15343f]">38</div>
                <div className="text-xs text-[#8d675b] font-medium mt-0.5">
                  {isAm ? 'ያለቁ / ዝቅተኛ ክምችት' : 'Out of Stock'}
                </div>
              </div>
            </div>
            <div className="text-[#a46552]" title="38 items below safety stock threshold">
              <Info className="h-4 w-4 opacity-75" />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 2. Middle Row: Users, Inventory Values, Top 10 Stores ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Widget A: No of users */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#cfdde3] p-5 shadow-clean flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-[#15343f] mb-4">
              <span>{isAm ? 'የተጠቃሚዎች ብዛት' : 'No of users'}</span>
              <button className="text-[#899ea7] hover:text-[#15343f]">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2">
              <div className="h-12 w-12 rounded-2xl bg-[#e3ecf5] text-[#3e76a6] flex items-center justify-center mb-4">
                <Users className="h-6 w-6" />
              </div>
              <div className="text-3xl font-extrabold text-[#15343f] tracking-tight">583 K</div>
              <div className="text-xs text-[#728994] font-medium mt-1">
                {isAm ? 'ጠቅላላ ደንበኞች' : 'Total Customers'}
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between text-[11px] text-[#527d8e] font-semibold">
            <span>{isAm ? 'ንቁ ቅርንጫፎች: 3' : 'Active Branches: 3'}</span>
            <Link to="/users" className="hover:underline flex items-center gap-1">
              {isAm ? 'ዝርዝር' : 'View'} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Widget B: Inventory Values Donut Chart */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#cfdde3] p-5 shadow-clean flex flex-col justify-between">
          <div className="text-xs font-bold text-[#15343f] mb-2">
            {isAm ? 'የክምችት እሴቶች' : 'Inventory Values'}
          </div>

          <div className="my-auto py-2 flex items-center justify-between gap-4">
            {/* SVG Donut Chart with percentages inside the segments */}
            <div className="relative h-32 w-32 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-full w-full">
                {/* Light cyan arc (32% - spans top-right) */}
                <circle
                  cx="60"
                  cy="60"
                  r="40"
                  fill="none"
                  stroke="#9ec0cb"
                  strokeWidth="24"
                  strokeDasharray="80.4 251.33"
                  strokeDashoffset="0"
                  transform="rotate(-90 60 60)"
                />
                {/* Dark teal arc (68% - spans bottom and left) */}
                <circle
                  cx="60"
                  cy="60"
                  r="40"
                  fill="none"
                  stroke="#527482"
                  strokeWidth="24"
                  strokeDasharray="170.9 251.33"
                  strokeDashoffset="-80.4"
                  transform="rotate(-90 60 60)"
                />
                {/* 32% Text inside the light cyan segment */}
                <text
                  x="94"
                  y="42"
                  textAnchor="middle"
                  fill="#15343f"
                  fontSize="11"
                  fontWeight="bold"
                >
                  32%
                </text>
                {/* 68% Text inside the dark teal segment */}
                <text
                  x="26"
                  y="85"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="bold"
                >
                  68%
                </text>
              </svg>
            </div>

            {/* Legend */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-xs bg-[#9ec0cb]" />
                <span className="font-semibold text-[#486370]">
                  {isAm ? 'የተሸጡ ክፍሎች' : 'Sold units'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-xs bg-[#527482]" />
                <span className="font-semibold text-[#486370]">
                  {isAm ? 'ጠቅላላ ክፍሎች' : 'Total units'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#edf3f6] flex justify-between text-[11px] text-[#728994]">
            <span>{isAm ? 'ጠቅላላ ግምት:' : 'Total Value:'}</span>
            <span className="font-bold text-[#15343f]">
              {formatETB(stats?.totalStockValue || 1284560, i18n.language)}
            </span>
          </div>
        </div>

        {/* Widget C: Top 10 Stores by sales */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#cfdde3] p-5 shadow-clean flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-[#15343f] mb-2">
            <span>{isAm ? 'በሽያጭ ቀዳሚ 10 ቅርንጫፎች' : 'Top 10 Stores by sales'}</span>
          </div>

          <div className="space-y-1.5 overflow-hidden">
            {storesData.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                <span className="w-28 truncate font-medium text-[#486370] text-[11px]">
                  {s.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-[#e2ecf0] overflow-hidden">
                  <div
                    style={{ width: s.width }}
                    className="h-full rounded-full bg-[#527482] transition-all duration-500"
                  />
                </div>
                <span className="w-9 text-right font-bold text-[#15343f] text-[11px]">
                  {s.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 3. Bottom Card: Expense vs Profit (Full Width) ---------------- */}
      <div className="bg-white rounded-2xl border border-[#cfdde3] p-6 shadow-clean">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#15343f]">
              {isAm ? 'ወጪ እና ትርፍ' : 'Expense vs Profit'}
            </h3>
          </div>
          <span className="text-xs font-medium text-[#728994]">
            {isAm ? 'የመጨረሻ 6 ወራት' : 'Last 6 months'}
          </span>
        </div>

        {/* Dual Line Spline Chart matching screenshot */}
        <div className="relative pt-2 pb-2">
          {/* Dotted grid lines & Y-axis labels */}
          <div className="space-y-7 text-xs text-[#8c9fa8] font-mono">
            <div className="flex items-center gap-3">
              <span className="w-8 text-right">40k</span>
              <div className="flex-1 border-b border-dashed border-[#d8e5eb]" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 text-right">30k</span>
              <div className="flex-1 border-b border-dashed border-[#d8e5eb]" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 text-right">20k</span>
              <div className="flex-1 border-b border-dashed border-[#d8e5eb]" />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 text-right">10k</span>
              <div className="flex-1 border-b border-dashed border-[#d8e5eb]" />
            </div>
          </div>

          {/* SVG Curved Splines & Badges */}
          <div className="absolute inset-x-0 bottom-6 top-4 left-11 right-2 pointer-events-none">
            <svg viewBox="0 0 600 140" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#db8261" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#db8261" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#48a68b" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#48a68b" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Expense Curve Area & Line (Peach/Coral #db8261) */}
              <path
                d="M 30,95 C 80,105 150,105 210,85 C 270,65 310,42 360,42 C 420,42 450,75 510,85 C 540,90 555,93 570,95 L 570,140 L 30,140 Z"
                fill="url(#expenseGrad)"
              />
              <path
                d="M 30,95 C 80,105 150,105 210,85 C 270,65 310,42 360,42 C 420,42 450,75 510,85 C 540,90 555,93 570,95"
                fill="none"
                stroke="#db8261"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Profit Curve Area & Line (Teal/Green #48a68b) */}
              <path
                d="M 30,110 C 90,115 150,115 210,100 C 270,85 330,70 390,60 C 450,50 480,32 510,32 C 535,32 555,38 570,45 L 570,140 L 30,140 Z"
                fill="url(#profitGrad)"
              />
              <path
                d="M 30,110 C 90,115 150,115 210,100 C 270,85 330,70 390,60 C 450,50 480,32 510,32 C 535,32 555,38 570,45"
                fill="none"
                stroke="#48a68b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Highest Expense Badge & Marker at exact peak (360, 42) */}
              <circle cx="360" cy="42" r="3.5" fill="#db8261" stroke="#ffffff" strokeWidth="2" />
              <line x1="360" y1="42" x2="360" y2="28" stroke="#db8261" strokeWidth="1.5" />
              <rect x="320" y="10" width="80" height="18" rx="4" fill="#db8261" />
              <text x="360" y="22" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                Highest Expense
              </text>

              {/* Highest Profit Badge & Marker at exact peak (510, 32) */}
              <circle cx="510" cy="32" r="3.5" fill="#48a68b" stroke="#ffffff" strokeWidth="2" />
              <line x1="510" y1="32" x2="510" y2="18" stroke="#48a68b" strokeWidth="1.5" />
              <rect x="475" y="0" width="70" height="18" rx="4" fill="#48a68b" />
              <text x="510" y="12" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                Highest Profit
              </text>
            </svg>
          </div>

          {/* Month Labels along X-Axis */}
          <div className="flex justify-between pl-11 pr-4 pt-3 text-xs font-medium text-[#728994]">
            <span>Dec</span>
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>April</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </div>
      </div>
    </div>
  )
}
