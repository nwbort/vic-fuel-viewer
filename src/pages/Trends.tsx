import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceArea,
} from 'recharts'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import FuelSelector from '../components/FuelSelector'
import type { TrendsData } from '../types'

const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']
const ALL_FUELS = ['U91', 'P95', 'P98', 'DSL', 'PDSL', 'E10', 'E85', 'B20', 'LPG']

const FUEL_LABELS: Record<string, string> = {
  U91: 'ULP 91', P95: 'Premium 95', P98: 'Premium 98',
  DSL: 'Diesel', PDSL: 'Prem Diesel', E10: 'Ethanol 10',
  E85: 'Ethanol 85', B20: 'Biodiesel 20', LPG: 'LPG',
}

const COLORS: Record<string, string> = {
  U91: '#2563eb', P95: '#7c3aed', P98: '#db2777',
  DSL: '#d97706', PDSL: '#b45309', E10: '#16a34a',
  E85: '#15803d', B20: '#0d9488', LPG: '#ea580c',
}

const WINDOWS = [
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: 'All', days: 9999 },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

interface MultiProps {
  data: TrendsData
  fuels: string[]
  days: number
}

function MultiLineChart({ data, fuels, days }: MultiProps) {
  const activeFuels = fuels.filter(f => data[f]?.length)

  const combined = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {}
    for (const fuel of activeFuels) {
      const series = data[fuel] ?? []
      for (const pt of series) {
        if (!byDate[pt.date]) byDate[pt.date] = {}
        byDate[pt.date][fuel] = pt.avg
      }
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }))
  }, [data, activeFuels])

  const cutoff = days < 9999
    ? combined[combined.length - 1]?.date
      ? new Date(combined[combined.length - 1].date)
      : null
    : null

  const visible = useMemo(() => {
    if (!cutoff || days >= 9999) return combined
    const since = new Date(cutoff)
    since.setDate(since.getDate() - days)
    return combined.filter(r => new Date(r.date) >= since)
  }, [combined, cutoff, days])

  if (!visible.length) return <p className="text-gray-400 text-sm">No data for selected range.</p>

  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart data={visible} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={v => `${v}¢`}
          domain={['auto', 'auto']}
          width={50}
        />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}¢`, '']}
          labelFormatter={formatDate}
        />
        <Legend formatter={f => FUEL_LABELS[f] ?? f} />
        {activeFuels.map(f => (
          <Line
            key={f}
            type="monotone"
            dataKey={f}
            stroke={COLORS[f] ?? '#666'}
            dot={false}
            strokeWidth={2}
            connectNulls
            name={f}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

interface BandProps {
  data: TrendsData
  fuel: string
  days: number
}

function BandChart({ data, fuel, days }: BandProps) {
  const series = data[fuel] ?? []

  const visible = useMemo(() => {
    if (days >= 9999) return series
    const last = series[series.length - 1]?.date
    if (!last) return series
    const since = new Date(last)
    since.setDate(since.getDate() - days)
    return series.filter(r => new Date(r.date) >= since)
  }, [series, days])

  const chartData = visible.map(r => ({
    date: r.date,
    avg: r.avg,
    p5p95: [r.p5, r.p95] as [number, number],
    p25p75: [r.p25, r.p75] as [number, number],
  }))

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tickFormatter={v => `${v}¢`} domain={['auto', 'auto']} width={50} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: number | [number, number]) =>
            Array.isArray(v) ? [`${v[0]}¢ – ${v[1]}¢`, ''] : [`${v.toFixed(1)}¢`, '']}
          labelFormatter={formatDate}
        />
        <Legend />
        <ReferenceArea
          y1={chartData[chartData.length - 1]?.p5p95[0]}
          y2={chartData[chartData.length - 1]?.p5p95[1]}
          fill={COLORS[fuel] ?? '#2563eb'}
          fillOpacity={0.05}
        />
        <ReferenceArea
          y1={chartData[chartData.length - 1]?.p25p75[0]}
          y2={chartData[chartData.length - 1]?.p25p75[1]}
          fill={COLORS[fuel] ?? '#2563eb'}
          fillOpacity={0.1}
        />
        <Line
          type="monotone"
          dataKey="avg"
          stroke={COLORS[fuel] ?? '#2563eb'}
          dot={false}
          strokeWidth={2.5}
          name="Average"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function Trends() {
  const { data, status } = useData<TrendsData>('/data/trends.json')
  const [mode, setMode] = useState<'multi' | 'single'>('multi')
  const [selectedFuels, setSelectedFuels] = useState<string[]>(PRIMARY_FUELS)
  const [singleFuel, setSingleFuel] = useState('U91')
  const [window, setWindow] = useState(30)

  if (status === 'loading') return <LoadingSpinner />
  if (!data) return <p className="text-red-500">Failed to load data.</p>

  const availableFuels = ALL_FUELS.filter(f => data[f]?.length)

  function toggleFuel(f: string) {
    setSelectedFuels(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f],
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Price Trends</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('multi')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${mode === 'multi' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
          >
            Compare fuels
          </button>
          <button
            onClick={() => setMode('single')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border ${mode === 'single' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
          >
            Distribution
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-wrap gap-4 mb-4 items-center justify-between">
          {mode === 'multi' ? (
            <div className="flex flex-wrap gap-2">
              {availableFuels.map(f => (
                <button
                  key={f}
                  onClick={() => toggleFuel(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors`}
                  style={
                    selectedFuels.includes(f)
                      ? { background: COLORS[f] ?? '#666', color: '#fff', borderColor: COLORS[f] ?? '#666' }
                      : { background: '#fff', color: '#374151', borderColor: '#d1d5db' }
                  }
                >
                  {FUEL_LABELS[f] ?? f}
                </button>
              ))}
            </div>
          ) : (
            <FuelSelector fuels={availableFuels} selected={singleFuel} onChange={setSingleFuel} />
          )}

          <div className="flex gap-1">
            {WINDOWS.map(w => (
              <button
                key={w.days}
                onClick={() => setWindow(w.days)}
                className={`px-3 py-1 rounded text-xs font-medium border ${window === w.days ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'multi'
          ? <MultiLineChart data={data} fuels={selectedFuels} days={window} />
          : <BandChart data={data} fuel={singleFuel} days={window} />
        }
      </div>

      {mode === 'single' && (
        <p className="text-xs text-gray-400 mt-3">
          Shaded bands show the 5th–95th and 25th–75th percentile price range. The line shows the daily average.
        </p>
      )}
    </div>
  )
}
