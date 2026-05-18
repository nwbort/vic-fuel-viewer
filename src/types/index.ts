export interface Station {
  id: string
  name: string
  brand: string
  brandType: string
  address: string
  suburb: string
  lat: number | null
  lng: number | null
}

export interface StationWithPrices extends Station {
  prices: Record<string, number>
}

export interface Brand {
  id: string
  name: string
  type: 'major' | 'independent'
}

export interface FuelType {
  id: string
  name: string
}

export interface ReferenceData {
  stations: Station[]
  brands: Brand[]
  fuelTypes: FuelType[]
  primaryFuels: string[]
  fuelLabels: Record<string, string>
}

export interface TrendPoint {
  date: string
  avg: number
  median: number
  min: number
  max: number
  p5: number
  p25: number
  p75: number
  p95: number
  count: number
}

export type TrendsData = Record<string, TrendPoint[]>

export interface OverviewFuel {
  fuelType: string
  date: string
  avg_price: number
  median_price: number
  min_price: number
  max_price: number
  station_count: number
  prev_day_avg: number | null
  week_ago_avg: number | null
}

export interface OverviewData {
  date: string
  fuels: OverviewFuel[]
}

export interface RankedStation {
  stationId: string
  price: number
  name: string
  address: string
  brand: string
  lat: number | null
  lng: number | null
}

export interface SuburbStat {
  suburb: string
  fuelType: string
  avg: number
  min: number
  max: number
  count: number
}

export interface SuburbsData {
  date: string
  suburbs: SuburbStat[]
}

export interface BrandStat {
  brandId: string
  brand: string
  brandType: string
  fuelType: string
  avg: number
  min: number
  max: number
  count: number
}

export interface BrandsData {
  date: string
  brands: BrandStat[]
}

export interface StationsLatestData {
  date: string
  stations: StationWithPrices[]
}

export interface SuburbTrendsData {
  dates: string[]
  suburbs: Record<string, Record<string, (number | null)[]>>
}

export interface StationHistoryData {
  dates: string[]
  stations: Record<string, Record<string, (number | null)[]>>
}
