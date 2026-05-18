import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import type { OverviewData } from '../types'

const FUEL_ORDER = ['U91', 'P95', 'P98', 'DSL', 'E10', 'E85', 'PDSL', 'B20', 'LPG', 'LNG', 'CNG']

const FUEL_LABELS: Record<string, string> = {
  U91: 'Unleaded 91',
  P95: 'Premium 95',
  P98: 'Premium 98',
  DSL: 'Diesel',
  PDSL: 'Premium Diesel',
  E10: 'Ethanol 10',
  E85: 'Ethanol 85',
  B20: 'Biodiesel 20',
  LPG: 'LPG',
  LNG: 'LNG',
  CNG: 'CNG',
}

function priceDiff(current: number, previous: number | null) {
  if (previous === null || previous === 0) return null
  return Math.round((current - previous) * 10) / 10
}

function TrendBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-gray-400 text-xs">–</span>
  if (Math.abs(diff) < 0.1) return <span className="text-gray-500 text-xs">→ no change</span>
  const up = diff > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-red-600' : 'text-green-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}¢
    </span>
  )
}

function FuelCard({ fuel }: { fuel: OverviewData['fuels'][number] }) {
  const dayDiff = priceDiff(fuel.avg_price, fuel.prev_day_avg)
  const weekDiff = priceDiff(fuel.avg_price, fuel.week_ago_avg)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{FUEL_LABELS[fuel.fuelType] ?? fuel.fuelType}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{fuel.station_count} stations</p>
        </div>
        <span className="text-2xl font-bold text-blue-700">{fuel.avg_price.toFixed(1)}¢</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <span>Median {fuel.median_price.toFixed(1)}¢</span>
        <span>·</span>
        <span>Range {fuel.min_price.toFixed(0)}–{fuel.max_price.toFixed(0)}¢</span>
      </div>

      <div className="border-t border-gray-100 pt-3 flex gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">vs yesterday</p>
          <TrendBadge diff={dayDiff} />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">vs last week</p>
          <TrendBadge diff={weekDiff} />
        </div>
      </div>
    </div>
  )
}

export default function Overview() {
  const { data, status } = useData<OverviewData>('/data/overview.json')

  if (status === 'loading') return <LoadingSpinner />
  if (!data) return <p className="text-red-500">Failed to load data.</p>

  const sorted = [...data.fuels].sort(
    (a, b) => FUEL_ORDER.indexOf(a.fuelType) - FUEL_ORDER.indexOf(b.fuelType),
  )

  const dateStr = new Date(data.date).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Victorian Fuel Price Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Latest data: {dateStr}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.map(f => <FuelCard key={f.fuelType} fuel={f} />)}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        Prices sourced from Service Victoria Fair Fuel Open Data. Average price shown (cents per litre). Data updated daily.
      </p>
    </div>
  )
}
