import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import FuelSelector from '../components/FuelSelector'
import type { SuburbsData } from '../types'

const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']

export default function Areas() {
  const { data, status } = useData<SuburbsData>('/data/suburbs.json')
  const [fuel, setFuel] = useState('U91')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'avg' | 'name'>('avg')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [minStations, setMinStations] = useState(2)

  const rows = useMemo(() => {
    if (!data) return []
    return data.suburbs
      .filter(s => s.fuelType === fuel && s.count >= minStations)
      .filter(s => !search || s.suburb.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const mul = order === 'asc' ? 1 : -1
        if (sortBy === 'name') return mul * a.suburb.localeCompare(b.suburb)
        return mul * (a.avg - b.avg)
      })
  }, [data, fuel, search, sortBy, order, minStations])

  if (status === 'loading') return <LoadingSpinner />
  if (!data) return <p className="text-red-500">Failed to load data.</p>

  const chartData = [...rows]
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 30)

  const allAvgs = rows.map(r => r.avg)
  const globalMin = allAvgs.length ? Math.min(...allAvgs) : 0
  const globalMax = allAvgs.length ? Math.max(...allAvgs) : 0

  function barColor(avg: number) {
    if (!allAvgs.length || globalMax === globalMin) return '#3b82f6'
    const t = (avg - globalMin) / (globalMax - globalMin)
    const r = Math.round(34 + t * (239 - 34))
    const g = Math.round(197 - t * (197 - 68))
    return `rgb(${r},${g},68)`
  }

  function toggleSort(col: 'avg' | 'name') {
    if (sortBy === col) setOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setOrder('asc') }
  }

  const sortIcon = (col: 'avg' | 'name') =>
    sortBy === col ? (order === 'asc' ? ' ↑' : ' ↓') : ''

  const dateStr = new Date(data.date).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Area Comparison</h1>
        <p className="text-sm text-gray-500 mt-1">Average prices by suburb · {dateStr}</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-5 items-center">
        <FuelSelector fuels={PRIMARY_FUELS} selected={fuel} onChange={setFuel} />
        <input
          type="search"
          placeholder="Search suburb..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <label className="text-sm text-gray-600 flex items-center gap-2">
          Min stations:
          <input
            type="number"
            min={1}
            max={10}
            value={minStations}
            onChange={e => setMinStations(Number(e.target.value))}
            className="w-14 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">30 cheapest suburbs</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="suburb"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis tickFormatter={v => `${v}¢`} tick={{ fontSize: 11 }} width={50} domain={['auto', 'auto']} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}¢`, 'Avg price']} />
              <Bar dataKey="avg" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th
                className="py-3 pl-4 pr-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none"
                onClick={() => toggleSort('name')}
              >
                Suburb{sortIcon('name')}
              </th>
              <th
                className="py-3 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none"
                onClick={() => toggleSort('avg')}
              >
                Avg{sortIcon('avg')}
              </th>
              <th className="py-3 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Min</th>
              <th className="py-3 pr-4 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Max</th>
              <th className="py-3 pr-4 px-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Stations</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.suburb} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-3 pl-4 pr-2 text-sm font-medium text-gray-900">{r.suburb}</td>
                <td className="py-3 px-2 text-right text-sm font-bold text-blue-700">{r.avg.toFixed(1)}¢</td>
                <td className="py-3 px-2 text-right text-sm text-green-600">{r.min.toFixed(1)}¢</td>
                <td className="py-3 px-2 pr-4 text-right text-sm text-red-500">{r.max.toFixed(1)}¢</td>
                <td className="py-3 px-2 pr-4 text-right text-sm text-gray-400">{r.count}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No suburbs match your filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
