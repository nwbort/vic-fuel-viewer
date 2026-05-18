import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import { MapContainer, TileLayer, CircleMarker, Popup, Circle } from 'react-leaflet'
import {
  ResponsiveContainer, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useData } from '../hooks/useData'
import LoadingSpinner from '../components/LoadingSpinner'
import FuelSelector from '../components/FuelSelector'
import type {
  StationsLatestData, TrendsData, StationHistoryData, StationWithPrices,
} from '../types'

const FUEL_LABELS: Record<string, string> = {
  U91: 'Unleaded 91', P95: 'Premium 95', P98: 'Premium 98',
  DSL: 'Diesel', PDSL: 'Premium Diesel', E10: 'Ethanol 10',
  E85: 'Ethanol 85', B20: 'Biodiesel 20', LPG: 'LPG',
}

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function priceColor(price: number, min: number, max: number) {
  if (max === min) return '#3b82f6'
  const t = (price - min) / (max - min)
  const r = Math.round(34 + t * (239 - 34))
  const g = Math.round(197 - t * (197 - 68))
  return `rgb(${r},${g},68)`
}

function PriceCompareGrid({
  station,
  stateAvgs,
}: {
  station: StationWithPrices
  stateAvgs: Record<string, number>
}) {
  const fuels = Object.keys(station.prices).sort(
    (a, b) =>
      ['U91', 'P95', 'P98', 'DSL', 'PDSL', 'E10', 'E85', 'B20', 'LPG', 'LNG', 'CNG']
        .indexOf(a) -
      ['U91', 'P95', 'P98', 'DSL', 'PDSL', 'E10', 'E85', 'B20', 'LPG', 'LNG', 'CNG']
        .indexOf(b),
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {fuels.map(f => {
        const price = station.prices[f]
        const stateAvg = stateAvgs[f]
        const diff = stateAvg ? Math.round((price - stateAvg) * 10) / 10 : null
        return (
          <div key={f} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{FUEL_LABELS[f] ?? f}</p>
            <p className="text-xl font-bold text-gray-900">{price.toFixed(1)}¢</p>
            {diff !== null && (
              <p className={`text-xs font-medium mt-1 ${diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {diff === 0 ? '= state avg' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}¢ vs state`}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function HistoryChart({
  stationId,
  fuel,
  historyData,
  trendsData,
  nearbyIds,
}: {
  stationId: string
  fuel: string
  historyData: StationHistoryData | null
  trendsData: TrendsData | null
  nearbyIds: string[]
}) {
  const chartData = useMemo(() => {
    if (!historyData || !trendsData?.[fuel]) return []
    const stateSeries = trendsData[fuel]
    const stationPrices = historyData.stations[stationId]?.[fuel]

    return stateSeries.map((pt) => {
      const di = historyData.dates.indexOf(pt.date)
      const stationPrice = di !== -1 ? stationPrices?.[di] ?? null : null

      let nearbyAvg: number | null = null
      if (di !== -1 && nearbyIds.length > 0) {
        const nearbyPrices = nearbyIds
          .map(nid => historyData.stations[nid]?.[fuel]?.[di] ?? null)
          .filter((v): v is number => v !== null)
        if (nearbyPrices.length > 0)
          nearbyAvg = Math.round((nearbyPrices.reduce((a, b) => a + b, 0) / nearbyPrices.length) * 10) / 10
      }

      return { date: pt.date, state: pt.avg, station: stationPrice, nearby: nearbyAvg }
    })
  }, [historyData, trendsData, fuel, stationId, nearbyIds])

  const stationPrices = chartData.map(d => d.station).filter((v): v is number => v !== null)
  const nearbyPrices = chartData.map(d => d.nearby).filter((v): v is number => v !== null)
  const statePrices = chartData.map(d => d.state).filter(v => v > 0)
  const allPrices = [...stationPrices, ...nearbyPrices, ...statePrices]
  const domainMin = allPrices.length ? Math.floor(Math.min(...allPrices) - 2) : 0
  const domainMax = allPrices.length ? Math.ceil(Math.max(...allPrices) + 2) : 300
  const adjustedMax = domainMax - domainMin

  if (!chartData.length) return null

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis
          tickFormatter={v => `${Math.round(v + domainMin)}¢`}
          domain={[0, adjustedMax]}
          width={46}
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          content={({ active, label }) => {
            if (!active || !label) return null
            const pt = chartData.find(d => d.date === label)
            if (!pt) return null
            return (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs space-y-0.5">
                <p className="font-medium text-gray-600 mb-1">{formatDate(label as string)}</p>
                {pt.station !== null && <p className="text-blue-700 font-bold">This station: {pt.station.toFixed(1)}¢</p>}
                {pt.nearby !== null && <p className="text-orange-500 font-medium">5 km avg: {pt.nearby.toFixed(1)}¢</p>}
                {pt.state > 0 && <p className="text-gray-400">State avg: {pt.state.toFixed(1)}¢</p>}
              </div>
            )
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey={d => d.state > 0 ? d.state - domainMin : null}
          stroke="#94a3b8"
          dot={false}
          strokeWidth={1.5}
          strokeDasharray="4 2"
          name="State avg"
          connectNulls
        />
        <Line
          type="monotone"
          dataKey={d => d.nearby !== null ? d.nearby - domainMin : null}
          stroke="#f97316"
          dot={false}
          strokeWidth={1.5}
          strokeDasharray="3 2"
          name="5 km avg"
          connectNulls
        />
        <Line
          type="monotone"
          dataKey={d => d.station !== null ? d.station - domainMin : null}
          stroke="#2563eb"
          dot={false}
          strokeWidth={2.5}
          name="This station"
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export default function StationDetail() {
  const { id } = useParams<{ id: string }>()
  const stationsData = useData<StationsLatestData>('/data/stations-latest.json')
  const trendsData = useData<TrendsData>('/data/trends.json')
  const historyData = useData<StationHistoryData>('/data/station-history.json')

  const [fuel, setFuel] = useState('U91')

  const station = useMemo(
    () => stationsData.data?.stations.find(s => s.id === id) ?? null,
    [stationsData.data, id],
  )

  const availableFuels = useMemo(
    () => station ? Object.keys(station.prices).filter(f =>
      ['U91', 'P95', 'P98', 'DSL', 'PDSL', 'E10', 'E85', 'B20', 'LPG'].includes(f),
    ) : [],
    [station],
  )

  const stateAvgs = useMemo(() => {
    if (!trendsData.data) return {} as Record<string, number>
    return Object.fromEntries(
      Object.entries(trendsData.data).map(([f, series]) => {
        const last = series[series.length - 1]
        return [f, last?.avg ?? 0]
      }),
    )
  }, [trendsData.data])

  const nearby = useMemo(() => {
    if (!station?.lat || !station?.lng || !stationsData.data) return []
    return stationsData.data.stations
      .filter(s => s.id !== station.id && s.lat !== null && s.lng !== null && s.prices[fuel] !== undefined)
      .map(s => ({ ...s, distanceKm: haversineKm(station.lat!, station.lng!, s.lat!, s.lng!) }))
      .filter(s => s.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.prices[fuel] - b.prices[fuel])
  }, [station, stationsData.data, fuel])

  const nearbyPrices = nearby.map(s => s.prices[fuel])
  const nearbyMin = nearbyPrices.length ? Math.min(...nearbyPrices) : 0
  const nearbyMax = nearbyPrices.length ? Math.max(...nearbyPrices) : 0

  const loading = stationsData.status === 'loading'
  if (loading) return <LoadingSpinner />
  if (!station) return (
    <div className="text-center py-16">
      <p className="text-gray-500 mb-3">Station not found.</p>
      <Link to="/stations" className="text-blue-600 text-sm underline">Back to search</Link>
    </div>
  )

  const selectedFuel = availableFuels.includes(fuel) ? fuel : (availableFuels[0] ?? 'U91')

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-400">
        <Link to="/stations" className="hover:text-blue-600">Stations</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700">{station.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{station.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{station.address}</p>
        </div>
        <span className={`shrink-0 mt-1 px-3 py-1 rounded-full text-xs font-medium ${
          station.brandType === 'major' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {station.brand} · {station.brandType}
        </span>
      </div>

      {/* Current prices */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Current prices</h2>
        <PriceCompareGrid station={station} stateAvgs={stateAvgs} />
      </section>

      {/* Fuel selector for map + chart */}
      <div className="mb-4">
        <FuelSelector fuels={availableFuels} selected={selectedFuel} onChange={setFuel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Price history chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Price history — {FUEL_LABELS[selectedFuel] ?? selectedFuel}
          </h2>
          {historyData.status === 'loading'
            ? <LoadingSpinner label="Loading history…" />
            : <HistoryChart
                stationId={station.id}
                fuel={selectedFuel}
                historyData={historyData.data}
                trendsData={trendsData.data}
                nearbyIds={nearby.map(s => s.id)}
              />
          }
        </div>

        {/* Nearby stations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Nearby stations within {RADIUS_KM} km — {FUEL_LABELS[selectedFuel] ?? selectedFuel}
            </h2>
          </div>
          {nearby.length === 0 ? (
            <p className="text-gray-400 text-sm p-6 text-center">No other stations with this fuel within {RADIUS_KM} km.</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {nearby.map(s => {
                const price = s.prices[selectedFuel]
                const isCheaper = price < (station.prices[selectedFuel] ?? Infinity)
                return (
                  <Link
                    key={s.id}
                    to={`/station/${s.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: priceColor(price, nearbyMin, nearbyMax) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.suburb} · {s.distanceKm.toFixed(1)} km · {s.brand}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isCheaper ? 'text-green-600' : 'text-gray-700'}`}>
                      {price.toFixed(1)}¢
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      {station.lat && station.lng && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Location</h2>
          </div>
          <MapContainer
            center={[station.lat, station.lng]}
            zoom={13}
            style={{ height: 320, width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <Circle
              center={[station.lat, station.lng]}
              radius={RADIUS_KM * 1000}
              pathOptions={{ color: '#2563eb', weight: 1.5, fillColor: '#2563eb', fillOpacity: 0.04 }}
            />
            {/* This station */}
            <CircleMarker
              center={[station.lat, station.lng]}
              radius={10}
              pathOptions={{ color: '#1d4ed8', weight: 2, fillColor: '#3b82f6', fillOpacity: 1 }}
            >
              <Popup>
                <p className="font-semibold text-sm">{station.name}</p>
                <p className="text-xs text-gray-500">{station.address}</p>
              </Popup>
            </CircleMarker>
            {/* Nearby */}
            {nearby.map(s => {
              const price = s.prices[selectedFuel]
              return (
                <CircleMarker
                  key={s.id}
                  center={[s.lat!, s.lng!]}
                  radius={6}
                  pathOptions={{
                    color: '#fff',
                    weight: 1,
                    fillColor: priceColor(price, nearbyMin, nearbyMax),
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <Link to={`/station/${s.id}`} className="font-semibold text-blue-700 hover:underline">
                        {s.name}
                      </Link>
                      <p className="text-xs text-gray-500">{s.address}</p>
                      <p className="font-bold mt-1">{price.toFixed(1)}¢</p>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>
      )}
    </div>
  )
}
