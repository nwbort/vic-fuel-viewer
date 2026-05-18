import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import FuelSelector from '../components/FuelSelector'
import type { BrandsData } from '../types'

const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']

export default function Brands() {
  const { data, status } = useData<BrandsData>('/data/brands.json')
  const [fuel, setFuel] = useState('U91')
  const [typeFilter, setTypeFilter] = useState<'all' | 'major' | 'independent'>('all')
  const [minStations, setMinStations] = useState(3)

  const rows = useMemo(() => {
    if (!data) return []
    return data.brands
      .filter(b => b.fuelType === fuel)
      .filter(b => typeFilter === 'all' || b.brandType === typeFilter)
      .filter(b => b.count >= minStations)
      .sort((a, b) => a.avg - b.avg)
  }, [data, fuel, typeFilter, minStations])

  if (status === 'loading') return <LoadingSpinner />
  if (!data) return <p className="text-red-500">Failed to load data.</p>

  const dateStr = new Date(data.date).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Brand Comparison</h1>
        <p className="text-sm text-gray-500 mt-1">Average price by fuel brand · {dateStr}</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-5 items-center">
        <FuelSelector fuels={PRIMARY_FUELS} selected={fuel} onChange={setFuel} />

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['all', 'major', 'independent'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 capitalize border-r last:border-r-0 border-gray-200 transition-colors ${typeFilter === t ? 'bg-gray-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="text-sm text-gray-600 flex items-center gap-2">
          Min stations:
          <input
            type="number"
            min={1}
            max={20}
            value={minStations}
            onChange={e => setMinStations(Number(e.target.value))}
            className="w-14 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <ResponsiveContainer width="100%" height={Math.max(300, rows.length * 28 + 40)}>
            <BarChart
              layout="vertical"
              data={rows}
              margin={{ top: 0, right: 60, left: 100, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={v => `${v}¢`}
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <YAxis
                type="category"
                dataKey="brand"
                tick={{ fontSize: 11 }}
                width={95}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(1)}¢`, 'Avg price']}
              />
              <Bar
                dataKey="avg"
                fill="#3b82f6"
                radius={[0, 3, 3, 0]}
                label={{ position: 'right', formatter: (v: number) => `${v.toFixed(1)}¢`, fontSize: 11 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Brand</th>
              <th className="py-3 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
              <th className="py-3 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Avg</th>
              <th className="py-3 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Min</th>
              <th className="py-3 pr-4 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Max</th>
              <th className="py-3 pr-4 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Stations</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.brandId} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pl-4 pr-2 text-sm font-medium text-gray-900">{r.brand}</td>
                <td className="py-3 px-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.brandType === 'major' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {r.brandType}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-sm font-bold text-blue-700">{r.avg.toFixed(1)}¢</td>
                <td className="py-3 px-2 text-right text-sm text-green-600">{r.min.toFixed(1)}¢</td>
                <td className="py-3 px-2 pr-4 text-right text-sm text-red-500">{r.max.toFixed(1)}¢</td>
                <td className="py-3 px-2 pr-4 text-right text-sm text-gray-400">{r.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No brands match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
