const FUEL_LABELS: Record<string, string> = {
  U91: 'ULP 91',
  P95: 'Premium 95',
  P98: 'Premium 98',
  DSL: 'Diesel',
  PDSL: 'Prem Diesel',
  E10: 'Ethanol 10',
  E85: 'Ethanol 85',
  B20: 'Biodiesel 20',
  LPG: 'LPG',
  LNG: 'LNG',
  CNG: 'CNG',
}

interface Props {
  fuels: string[]
  selected: string
  onChange: (fuel: string) => void
}

export default function FuelSelector({ fuels, selected, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {fuels.map(f => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            selected === f
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
          }`}
        >
          {FUEL_LABELS[f] ?? f}
        </button>
      ))}
    </div>
  )
}
