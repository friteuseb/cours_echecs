'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Interroge une URL JSON à intervalle régulier.
 * Léger et robuste : pas de WebSocket, fonctionne partout (y compris sur Vercel).
 */
export function usePoll<T>(url: string | null, intervalMs = 1500) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!url) return
    let cancelled = false

    async function tick() {
      if (inFlight.current) return
      inFlight.current = true
      try {
        const res = await fetch(url!, { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error ?? `Erreur ${res.status}`)
          return
        }
        setData(await res.json())
        setError(null)
      } catch {
        if (!cancelled) setError('Connexion perdue, nouvelle tentative…')
      } finally {
        inFlight.current = false
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [url, intervalMs])

  return { data, error }
}
