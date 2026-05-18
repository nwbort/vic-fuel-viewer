import { useState, useEffect } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    fetch(path)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<T>
      })
      .then(d => {
        if (!cancelled) { setData(d); setStatus('success') }
      })
      .catch(e => {
        if (!cancelled) { setError(String(e)); setStatus('error') }
      })
    return () => { cancelled = true }
  }, [path])

  return { data, status, error }
}
