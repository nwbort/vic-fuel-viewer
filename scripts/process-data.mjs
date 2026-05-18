/**
 * Build-time data processing script.
 * Downloads the Parquet price archive and reference JSON from GitHub,
 * then generates pre-aggregated JSON files into public/data/.
 */

import { Database } from 'duckdb-async'
import { createWriteStream, mkdirSync } from 'fs'
import { writeFile, mkdir } from 'fs/promises'
import { pipeline } from 'stream/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'data')
const TMP = path.join(ROOT, '.tmp-data')

const REPO_RAW = 'https://raw.githubusercontent.com/nwbort/vic-fuel-archive/main'

const FUEL_LABELS = {
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

// Primary fuel types to feature prominently
const PRIMARY_FUELS = ['U91', 'P95', 'P98', 'DSL', 'E10']

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

async function downloadFile(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  const ws = createWriteStream(dest)
  await pipeline(res.body, ws)
}

function replacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value
}

async function save(name, data) {
  await writeFile(path.join(OUT, name), JSON.stringify(data, replacer))
  console.log(`  wrote ${name}`)
}

async function main() {
  console.log('Processing vic-fuel-archive data...')

  mkdirSync(OUT, { recursive: true })
  mkdirSync(TMP, { recursive: true })

  // --- Fetch reference data ---
  console.log('Fetching reference data...')
  const [stationsRaw, brandsRaw, typesRaw] = await Promise.all([
    fetchJson(`${REPO_RAW}/data/reference/stations.json`),
    fetchJson(`${REPO_RAW}/data/reference/brands.json`),
    fetchJson(`${REPO_RAW}/data/reference/types.json`),
  ])

  const stations = stationsRaw.fuelStations
  const brands = brandsRaw.brands
  const fuelTypes = typesRaw.fuelTypes

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]))
  const stationMap = Object.fromEntries(stations.map(s => [s.id, s]))

  // Enrich stations with brand name and extract suburb from address
  const enrichedStations = stations.map(s => {
    const brand = brandMap[s.brandId]
    const addressParts = s.address ? s.address.split(',') : []
    const suburb = addressParts.length >= 2
      ? addressParts[addressParts.length - 2].trim().replace(/\s+VIC.*$/, '').trim()
      : ''
    return {
      id: s.id,
      name: s.name,
      brand: brand?.name ?? '',
      brandType: brand?.type ?? '',
      address: s.address,
      suburb,
      lat: s.location?.latitude ?? null,
      lng: s.location?.longitude ?? null,
    }
  })

  await save('reference.json', {
    stations: enrichedStations,
    brands,
    fuelTypes,
    primaryFuels: PRIMARY_FUELS,
    fuelLabels: FUEL_LABELS,
  })

  // --- Download Parquet ---
  console.log('Downloading prices.parquet...')
  const parquetPath = path.join(TMP, 'prices.parquet')
  await downloadFile(`${REPO_RAW}/data/processed/prices.parquet`, parquetPath)

  // --- Query with DuckDB ---
  console.log('Running DuckDB queries...')
  const db = await Database.create(':memory:')
  const conn = await db.connect()

  // Load parquet into a view
  await conn.run(`CREATE VIEW prices AS SELECT * FROM parquet_scan('${parquetPath}')`)

  // --- Daily averages per fuel type (trend lines) ---
  console.log('  Computing trends...')
  const trendRows = await conn.all(`
    SELECT
      date,
      fuel_type,
      ROUND(AVG(price), 1)    AS avg_price,
      ROUND(MEDIAN(price), 1) AS median_price,
      ROUND(MIN(price), 1)    AS min_price,
      ROUND(MAX(price), 1)    AS max_price,
      ROUND(PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY price), 1) AS p5,
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price), 1) AS p25,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price), 1) AS p75,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY price), 1) AS p95,
      COUNT(*) AS station_count
    FROM prices
    WHERE price IS NOT NULL AND price > 0 AND is_available = true
    GROUP BY date, fuel_type
    ORDER BY date, fuel_type
  `)

  // Group trends by fuel type
  const trendsByFuel = {}
  for (const row of trendRows) {
    if (!trendsByFuel[row.fuel_type]) trendsByFuel[row.fuel_type] = []
    trendsByFuel[row.fuel_type].push({
      date: row.date,
      avg: row.avg_price,
      median: row.median_price,
      min: row.min_price,
      max: row.max_price,
      p5: row.p5,
      p25: row.p25,
      p75: row.p75,
      p95: row.p95,
      count: row.station_count,
    })
  }
  await save('trends.json', trendsByFuel)

  // --- Latest prices per station per fuel type ---
  console.log('  Computing latest station prices...')
  const latestDate = await conn.all(`SELECT MAX(date) AS d FROM prices`)
  const maxDate = latestDate[0].d
  console.log(`  Latest data date: ${maxDate}`)

  const latestRows = await conn.all(`
    SELECT
      station_id,
      fuel_type,
      price
    FROM prices
    WHERE date = '${maxDate}'
      AND price IS NOT NULL
      AND price > 0
      AND is_available = true
  `)

  // Build station-price map: { stationId -> { fuelType -> price } }
  const stationPrices = {}
  for (const row of latestRows) {
    if (!stationPrices[row.station_id]) stationPrices[row.station_id] = {}
    stationPrices[row.station_id][row.fuel_type] = row.price
  }

  // Merge into enriched stations, only keep stations that have any price data
  const stationsWithPrices = enrichedStations
    .filter(s => stationPrices[s.id])
    .map(s => ({ ...s, prices: stationPrices[s.id] }))

  await save('stations-latest.json', { date: maxDate, stations: stationsWithPrices })

  // --- Overview stats (latest day vs previous day vs 7 days ago) ---
  console.log('  Computing overview...')
  const overviewRows = await conn.all(`
    WITH dated AS (
      SELECT
        fuel_type,
        date,
        ROUND(AVG(price), 1) AS avg_price,
        ROUND(MEDIAN(price), 1) AS median_price,
        ROUND(MIN(price), 1) AS min_price,
        ROUND(MAX(price), 1) AS max_price,
        COUNT(*) AS station_count
      FROM prices
      WHERE price IS NOT NULL AND price > 0 AND is_available = true
      GROUP BY fuel_type, date
    ),
    latest AS (SELECT fuel_type, date, avg_price, median_price, min_price, max_price, station_count FROM dated WHERE date = '${maxDate}'),
    prev_day AS (
      SELECT fuel_type, avg_price AS prev_day_avg
      FROM dated
      WHERE date = (SELECT MAX(date) FROM dated WHERE date < '${maxDate}')
    ),
    week_ago AS (
      SELECT fuel_type, avg_price AS week_ago_avg
      FROM dated
      WHERE date = (
        SELECT MAX(date) FROM dated
        WHERE CAST(date AS DATE) <= (DATE '${maxDate}' - INTERVAL 7 DAY)
      )
    )
    SELECT
      l.fuel_type AS fuelType,
      l.date,
      l.avg_price,
      l.median_price,
      l.min_price,
      l.max_price,
      l.station_count,
      p.prev_day_avg,
      w.week_ago_avg
    FROM latest l
    LEFT JOIN prev_day p ON l.fuel_type = p.fuel_type
    LEFT JOIN week_ago w ON l.fuel_type = w.fuel_type
    ORDER BY l.fuel_type
  `)

  await save('overview.json', { date: maxDate, fuels: overviewRows })

  // --- Cheapest & most expensive stations per primary fuel type ---
  console.log('  Computing cheapest/most expensive...')
  // unused block — queries run per fuel type below

  // We can't easily get both top and bottom in one QUALIFY — run two queries
  const cheapest = {}
  const expensive = {}

  for (const fuel of PRIMARY_FUELS) {
    const cheap = await conn.all(`
      SELECT station_id, price
      FROM prices
      WHERE date = '${maxDate}' AND fuel_type = '${fuel}'
        AND price IS NOT NULL AND price > 0 AND is_available = true
      ORDER BY price ASC
      LIMIT 20
    `)
    cheapest[fuel] = cheap.map(r => ({
      stationId: r.station_id,
      price: r.price,
      ...(stationMap[r.station_id] ? {
        name: stationMap[r.station_id].name,
        address: stationMap[r.station_id].address,
        brand: brandMap[stationMap[r.station_id].brandId]?.name ?? '',
        lat: stationMap[r.station_id].location?.latitude ?? null,
        lng: stationMap[r.station_id].location?.longitude ?? null,
      } : {}),
    }))

    const exp = await conn.all(`
      SELECT station_id, price
      FROM prices
      WHERE date = '${maxDate}' AND fuel_type = '${fuel}'
        AND price IS NOT NULL AND price > 0 AND is_available = true
      ORDER BY price DESC
      LIMIT 20
    `)
    expensive[fuel] = exp.map(r => ({
      stationId: r.station_id,
      price: r.price,
      ...(stationMap[r.station_id] ? {
        name: stationMap[r.station_id].name,
        address: stationMap[r.station_id].address,
        brand: brandMap[stationMap[r.station_id].brandId]?.name ?? '',
        lat: stationMap[r.station_id].location?.latitude ?? null,
        lng: stationMap[r.station_id].location?.longitude ?? null,
      } : {}),
    }))
  }

  await save('cheapest.json', cheapest)
  await save('expensive.json', expensive)

  // --- Suburb averages for area comparison ---
  console.log('  Computing suburb averages...')

  // Build a station->suburb lookup from enrichedStations
  const suburbLookup = {}
  for (const s of enrichedStations) {
    if (s.suburb) suburbLookup[s.id] = s.suburb
  }

  // Get all latest prices and join suburb
  const allLatest = await conn.all(`
    SELECT station_id, fuel_type, price
    FROM prices
    WHERE date = '${maxDate}'
      AND price IS NOT NULL AND price > 0 AND is_available = true
  `)

  // Group by suburb + fuelType
  const suburbAccum = {}
  for (const row of allLatest) {
    const suburb = suburbLookup[row.station_id]
    if (!suburb) continue
    const key = `${suburb}|||${row.fuel_type}`
    if (!suburbAccum[key]) suburbAccum[key] = { prices: [], suburb, fuelType: row.fuel_type }
    suburbAccum[key].prices.push(row.price)
  }

  const suburbStats = Object.values(suburbAccum).map(({ suburb, fuelType, prices }) => {
    prices.sort((a, b) => a - b)
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length
    return {
      suburb,
      fuelType,
      avg: Math.round(avg * 10) / 10,
      min: prices[0],
      max: prices[prices.length - 1],
      count: prices.length,
    }
  })

  await save('suburbs.json', { date: maxDate, suburbs: suburbStats })

  // --- Brand averages ---
  console.log('  Computing brand averages...')
  const brandRows = await conn.all(`
    SELECT
      brand_id,
      fuel_type,
      ROUND(AVG(price), 1) AS avg_price,
      ROUND(MIN(price), 1) AS min_price,
      ROUND(MAX(price), 1) AS max_price,
      COUNT(*) AS station_count
    FROM prices
    WHERE date = '${maxDate}'
      AND price IS NOT NULL AND price > 0 AND is_available = true
      AND fuel_type IN ('${PRIMARY_FUELS.join("','")}')
    GROUP BY brand_id, fuel_type
    ORDER BY fuel_type, avg_price
  `)

  const brandStats = brandRows.map(r => ({
    brandId: r.brand_id,
    brand: brandMap[r.brand_id]?.name ?? r.brand_id,
    brandType: brandMap[r.brand_id]?.type ?? '',
    fuelType: r.fuel_type,
    avg: r.avg_price,
    min: r.min_price,
    max: r.max_price,
    count: r.station_count,
  }))

  await save('brands.json', { date: maxDate, brands: brandStats })

  await conn.close()
  await db.close()

  console.log('\nData processing complete.')
  console.log(`Latest date in data: ${maxDate}`)
}

main().catch(err => {
  console.error('Data processing failed:', err)
  process.exit(1)
})
