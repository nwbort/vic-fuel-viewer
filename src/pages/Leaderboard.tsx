import { useState } from 'react'
import { Link } from 'react-router'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import FuelSelector from '../components/FuelSelector'
import type { RankedStation } from '../types'

const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']

type RankingData = Record<string, RankedStation[]>

function StationRow({ rank, station }: { rank: number; station: RankedStation }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 pl-4 pr-2 text-sm font-medium text-gray-400 w-10">{rank}</td>
      <td className="py-3 px-2">
        <Link to={`/station/${encodeURIComponent(station.stationId)}`} className="text-sm font-medium text-blue-700 hover:underline">{station.name}</Link>
        <p className="text-xs text-gray-400 mt-0.5">{station.address}</p>
      </td>
      <td className="py-3 px-2 text-sm text-gray-600">{station.brand}</td>
      <td className="py-3 pl-2 pr-4 text-right">
        <span className="text-base font-bold text-blue-700">{station.price.toFixed(1)}¢</span>
      </td>
    </tr>
  )
}

export default function Leaderboard() {
  const cheap = useData<RankingData>('/data/cheapest.json')
  const expensive = useData<RankingData>('/data/expensive.json')
  const [fuel, setFuel] = useState('U91')
  const [tab, setTab] = useState<'cheap' | 'expensive'>('cheap')

  const loading = cheap.status === 'loading' || expensive.status === 'loading'
  if (loading) return <LoadingSpinner />

  const data = tab === 'cheap' ? cheap.data : expensive.data
  const stations = data?.[fuel] ?? []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Station Rankings</h1>
        <p className="text-sm text-gray-500 mt-1">Top 20 cheapest and most expensive stations by fuel type</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 items-center justify-between">
        <FuelSelector fuels={PRIMARY_FUELS} selected={fuel} onChange={setFuel} />
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setTab('cheap')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'cheap' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Cheapest
          </button>
          <button
            onClick={() => setTab('expensive')}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${tab === 'expensive' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Most Expensive
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {stations.length === 0 ? (
          <p className="text-gray-400 p-6 text-center">No data available.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                <th className="py-3 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Station</th>
                <th className="py-3 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Brand</th>
                <th className="py-3 pl-2 pr-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Price</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s, i) => (
                <StationRow key={s.stationId} rank={i + 1} station={s} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
