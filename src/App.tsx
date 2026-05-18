import { lazy, Suspense } from 'react'
import { Routes, Route, NavLink } from 'react-router'
import LoadingSpinner from './components/LoadingSpinner'

const Overview = lazy(() => import('./pages/Overview'))
const Trends = lazy(() => import('./pages/Trends'))
const Map = lazy(() => import('./pages/Map'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Areas = lazy(() => import('./pages/Areas'))
const Brands = lazy(() => import('./pages/Brands'))
const Stations = lazy(() => import('./pages/Stations'))
const StationDetail = lazy(() => import('./pages/StationDetail'))

function Nav() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-700/50 hover:text-white'
    }`
  return (
    <nav className="bg-blue-800 text-white">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-bold text-lg mr-4 text-white">⛽ Vic Fuel</span>
        <NavLink to="/" end className={cls}>Overview</NavLink>
        <NavLink to="/trends" className={cls}>Trends</NavLink>
        <NavLink to="/map" className={cls}>Map</NavLink>
        <NavLink to="/leaderboard" className={cls}>Cheapest</NavLink>
        <NavLink to="/areas" className={cls}>Areas</NavLink>
        <NavLink to="/brands" className={cls}>Brands</NavLink>
        <NavLink to="/stations" className={cls}>Stations</NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/map" element={<Map />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/areas" element={<Areas />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/stations" element={<Stations />} />
            <Route path="/station/:id" element={<StationDetail />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
