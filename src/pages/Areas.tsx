import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMapEvents } from 'react-leaflet'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import FuelSelector from '../components/FuelSelector'
import type { StationsLatestData, StationWithPrices, TrendsData, SuburbTrendsData } from '../types'

const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']
const RADIUS_KM = 5

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function priceColor(price: number, min: number, max: number) {
  if (max === min) return '#3b82f6'
  const t = (price - min) / (max - min)
  const r = Math.round(34 + t * (239 - 34))
  const g = Math.round(197 - t * (197 - 68))
  return `rgb(${r},${g},68)`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

interface ClickHandlerProps {
  onClick: (lat: number, lng: number) => void
}

function ClickHandler({ onClick }: ClickHandlerProps) {
  useMapEvents({ click: e => onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

interface AreaPanelProps {
  stations: (StationWithPrices & { distanceKm: number })[]
  fuel: string
  trendsData: TrendsData | null
  suburbTrendsData: SuburbTrendsData | null
}

function AreaPanel({ stations, fuel, trendsData, suburbTrendsData }: AreaPanelProps) {
  const sorted = [...stations]
    .filter(s => s.prices[fuel] !== undefined)
    .sort((a, b) => a.prices[fuel] - b.prices[fuel])

  const allPrices = sorted.map(s => s.prices[fuel])
  const min = allPrices[0] ?? 0
  const max = allPrices[allPrices.length - 1] ?? 0
  const areaAvgToday = allPrices.length
    ? Math.round((allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 10) / 10
    : null

  // Build combined trend chart data: statewide avg + area avg per date
  const chartData = useMemo(() => {
    if (!trendsData?.[fuel]) return []

    const stateSeries = trendsData[fuel]

    // Get unique suburbs of stations in the area
    const areaSuburbs = [...new Set(stations.map(s => s.suburb).filter(Boolean))]

    // For each date in the state series, compute area avg from suburb trends
    return stateSeries.map(pt => {
      let areaAvg: number | null = null

      if (suburbTrendsData && areaSuburbs.length) {
        const dateIdx = suburbTrendsData.dates.indexOf(pt.date)
        if (dateIdx !== -1) {
          let sum = 0
          let count = 0
          for (const suburb of areaSuburbs) {
            const val = suburbTrendsData.suburbs[suburb]?.[fuel]?.[dateIdx]
            if (val !== null && val !== undefined) {
              sum += val
              count++
            }
          }
          if (count > 0) areaAvg = Math.round((sum / count) * 10) / 10
        }
      }

      return { date: pt.date, state: pt.avg, area: areaAvg }
    })
  }, [trendsData, suburbTrendsData, fuel, stations])

  if (sorted.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center text-gray-400 text-sm">
        No stations with {fuel} data within {RADIUS_KM} km of the selected point.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Stations', value: sorted.length.toString() },
          { label: 'Cheapest', value: `${min.toFixed(1)}¢` },
          { label: 'Area avg today', value: `${areaAvgToday?.toFixed(1) ?? '–'}¢` },
          { label: 'Most exp.', value: `${max.toFixed(1)}¢` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-center">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-lg font-bold text-blue-700">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Station list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Stations by price</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {sorted.map((s, i) => {
              const price = s.prices[fuel]
              const color = priceColor(price, min, max)
              return (
                <Link key={s.id} to={`/station/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-blue-700 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {s.suburb} · {s.distanceKm.toFixed(1)} km · {s.brand}
                    </p>
                  </div>
                  <span
                    className="text-sm font-bold shrink-0"
                    style={{ color: i === 0 ? '#16a34a' : '#374151' }}
                  >
                    {price.toFixed(1)}¢
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Trend chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Area trend vs statewide average
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={v => `${v}¢`}
                  domain={['auto', 'auto']}
                  width={46}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(1)}¢`, '']}
                  labelFormatter={formatDate}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="state"
                  stroke="#94a3b8"
                  dot={false}
                  strokeWidth={1.5}
                  name="State avg"
                  strokeDasharray="4 2"
                />
                <Line
                  type="monotone"
                  dataKey="area"
                  stroke="#2563eb"
                  dot={false}
                  strokeWidth={2.5}
                  name="Area avg"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Areas() {
  const stationsData = useData<StationsLatestData>('/data/stations-latest.json')
  const trendsData = useData<TrendsData>('/data/trends.json')
  const suburbTrendsData = useData<SuburbTrendsData>('/data/suburb-trends.json')
  const [fuel, setFuel] = useState('U91')
  const [centre, setCentre] = useState<{ lat: number; lng: number } | null>(null)

  const handleClick = useCallback((lat: number, lng: number) => {
    setCentre({ lat, lng })
  }, [])

  const nearbyStations = useMemo(() => {
    if (!centre || !stationsData.data) return []
    return stationsData.data.stations
      .filter(s => s.lat !== null && s.lng !== null && s.prices[fuel] !== undefined)
      .map(s => ({
        ...s,
        distanceKm: haversineKm(centre.lat, centre.lng, s.lat!, s.lng!),
      }))
      .filter(s => s.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [centre, stationsData.data, fuel])

  const allStations = stationsData.data?.stations ?? []
  const allPrices = allStations
    .map(s => s.prices[fuel])
    .filter(Boolean)
  const globalMin = allPrices.length ? Math.min(...allPrices) : 0
  const globalMax = allPrices.length ? Math.max(...allPrices) : 0

  const loading = stationsData.status === 'loading'
  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Area Explorer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Click anywhere on the map to explore fuel prices within {RADIUS_KM} km.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <FuelSelector fuels={PRIMARY_FUELS} selected={fuel} onChange={setFuel} />
        {centre && (
          <button
            onClick={() => setCentre(null)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-5">
        <MapContainer
          center={[-37.8136, 144.9631]}
          zoom={9}
          style={{ height: 420, width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <ClickHandler onClick={handleClick} />

          {/* All stations as faint background dots */}
          {allStations
            .filter(s => s.lat !== null && s.lng !== null && s.prices[fuel] !== undefined)
            .map(s => {
              const isNearby = centre
                ? haversineKm(centre.lat, centre.lng, s.lat!, s.lng!) <= RADIUS_KM
                : false
              const price = s.prices[fuel]
              return (
                <CircleMarker
                  key={s.id}
                  center={[s.lat!, s.lng!]}
                  radius={centre ? (isNearby ? 7 : 4) : 5}
                  pathOptions={{
                    color: '#fff',
                    weight: 1,
                    fillColor: centre
                      ? isNearby
                        ? priceColor(price, globalMin, globalMax)
                        : '#d1d5db'
                      : priceColor(price, globalMin, globalMax),
                    fillOpacity: centre ? (isNearby ? 0.9 : 0.3) : 0.75,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-gray-500 text-xs">{s.address}</p>
                      <p className="font-bold text-blue-700 mt-1">{price.toFixed(1)}¢ / L</p>
                      {centre && (
                        <p className="text-xs text-gray-400">
                          {haversineKm(centre.lat, centre.lng, s.lat!, s.lng!).toFixed(1)} km away
                        </p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}

          {/* Radius circle */}
          {centre && (
            <Circle
              center={[centre.lat, centre.lng]}
              radius={RADIUS_KM * 1000}
              pathOptions={{ color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.05 }}
            />
          )}
        </MapContainer>
      </div>

      {!centre ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-sm font-medium">Click anywhere on the map to explore that area</p>
          <p className="text-xs mt-1">Shows all stations within {RADIUS_KM} km of the clicked point</p>
        </div>
      ) : (
        <AreaPanel
          stations={nearbyStations}
          fuel={fuel}
          trendsData={trendsData.data}
          suburbTrendsData={suburbTrendsData.data}
        />
      )}
    </div>
  )
}
