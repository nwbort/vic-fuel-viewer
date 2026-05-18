import { useState, useMemo } from 'react'
import { Link } from 'react-router'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import type { StationsLatestData } from '../types'

const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']
const FUEL_LABELS: Record<string, string> = {
  U91: 'ULP 91', P95: 'Prem 95', P98: 'Prem 98', DSL: 'Diesel', E10: 'E10',
}

export default function Stations() {
  const { data, status } = useData<StationsLatestData>('/data/stations-latest.json')
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const all = data.stations
    if (!q) return all.slice(0, 60)
    return all
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.suburb.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q),
      )
      .slice(0, 60)
  }, [data, query])

  if (status === 'loading') return <LoadingSpinner />
  if (!data) return <p className="text-red-500">Failed to load data.</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Station Search</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search by name, suburb, or brand — then click through for full stats and history.
        </p>
      </div>

      <div className="mb-4">
        <input
          type="search"
          autoFocus
          placeholder="Search stations, suburbs, brands…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full max-w-lg border border-gray-300 rounded-lg px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {query && (
          <p className="text-xs text-gray-400 mt-1.5">
            {results.length === 60 ? '60+ results — narrow your search' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {results.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">No stations match your search.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map(s => (
              <Link
                key={s.id}
                to={`/station/${s.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.address}</p>
                </div>
                <div className="shrink-0 flex gap-2 items-center">
                  {PRIMARY_FUELS.filter(f => s.prices[f] !== undefined).map(f => (
                    <span key={f} className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{s.prices[f].toFixed(1)}¢</span>
                      {' '}{FUEL_LABELS[f]}
                    </span>
                  ))}
                  <svg className="w-4 h-4 text-gray-300 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
