import { useState, useMemo } from 'react'
import { Link } from 'react-router'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import FuelSelector from '../components/FuelSelector'
import type { StationsLatestData, StationWithPrices } from '../types'

const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']

const FUEL_LABELS: Record<string, string> = {
  U91: 'ULP 91', P95: 'Premium 95', P98: 'Premium 98',
  DSL: 'Diesel', E10: 'Ethanol 10',
}

function priceColor(price: number, min: number, max: number): string {
  if (max === min) return '#3b82f6'
  const t = (price - min) / (max - min)
  const r = Math.round(34 + t * (239 - 34))
  const g = Math.round(197 - t * (197 - 68))
  const b = Math.round(94 - t * (94 - 68))
  return `rgb(${r},${g},${b})`
}

export default function Map() {
  const { data, status } = useData<StationsLatestData>('/data/stations-latest.json')
  const [fuel, setFuel] = useState('U91')

  const { stations, min, max } = useMemo(() => {
    if (!data) return { stations: [] as StationWithPrices[], min: 0, max: 0 }
    const withPrice = data.stations.filter(
      s => s.lat !== null && s.lng !== null && s.prices[fuel] !== undefined,
    )
    const prices = withPrice.map(s => s.prices[fuel])
    return {
      stations: withPrice,
      min: Math.min(...prices),
      max: Math.max(...prices),
    }
  }, [data, fuel])

  if (status === 'loading') return <LoadingSpinner />
  if (!data) return <p className="text-red-500">Failed to load data.</p>

  const dateStr = new Date(data.date).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Station Map</h1>
          <p className="text-sm text-gray-500 mt-1">Latest data: {dateStr} · {stations.length} stations shown</p>
        </div>
        <FuelSelector fuels={PRIMARY_FUELS} selected={fuel} onChange={setFuel} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <MapContainer
          center={[-37.8136, 144.9631]}
          zoom={9}
          style={{ height: '600px', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stations.map(s => {
            const price = s.prices[fuel]
            const color = priceColor(price, min, max)
            return (
              <CircleMarker
                key={`${s.id}-${fuel}`}
                center={[s.lat!, s.lng!]}
                radius={6}
                pathOptions={{ color: '#fff', weight: 1, fillColor: color, fillOpacity: 0.85 }}
              >
                <Popup>
                  <div className="text-sm">
                    <Link to={`/station/${s.id}`} className="font-semibold text-blue-700 hover:underline">{s.name}</Link>
                    <p className="text-gray-500 text-xs">{s.address}</p>
                    <p className="font-bold text-gray-900 mt-1">{price.toFixed(1)}¢ / L</p>
                    <p className="text-xs text-gray-400">{FUEL_LABELS[fuel] ?? fuel}</p>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        <span>Price scale:</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
          <span>Cheapest ({min.toFixed(0)}¢)</span>
        </div>
        <span>→</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
          <span>Most expensive ({max.toFixed(0)}¢)</span>
        </div>
      </div>
    </div>
  )
}
