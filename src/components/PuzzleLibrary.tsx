'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StaticBoard from './StaticBoard'
import { sideToMove } from '@/lib/chess-utils'
import { FILTER_THEMES, primaryThemes, themeLabel } from '@/lib/themes'
import type { PuzzleSummary } from '@/lib/types'

const PAGE_SIZE = 24

const BANDS: { value: string; label: string }[] = [
  { value: '', label: 'Toutes difficultés' },
  { value: '0-1000', label: 'Facile (< 1000)' },
  { value: '1000-1400', label: 'Moyen (1000–1400)' },
  { value: '1400-1800', label: 'Difficile (1400–1800)' },
]

function filterQuery(theme: string, band: string): string {
  const params = new URLSearchParams()
  if (theme) params.set('theme', theme)
  if (band) {
    const [min, max] = band.split('-')
    params.set('min', min)
    params.set('max', max)
  }
  return params.toString()
}

/** Bibliothèque de problèmes + création de session (page d'accueil du prof). */
export default function PuzzleLibrary() {
  const router = useRouter()
  const [puzzles, setPuzzles] = useState<PuzzleSummary[] | null>(null)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sessionName, setSessionName] = useState('')
  const [timeLimit, setTimeLimit] = useState(60)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  // Filtres et pagination
  const [theme, setTheme] = useState('')
  const [band, setBand] = useState('')
  const [page, setPage] = useState(1)
  const [randomCount, setRandomCount] = useState(10)

  useEffect(() => {
    let cancelled = false
    const qs = filterQuery(theme, band)
    fetch(`/api/puzzles?page=${page}&pageSize=${PAGE_SIZE}${qs ? `&${qs}` : ''}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return
        setPuzzles(body.puzzles ?? [])
        setTotal(body.total ?? 0)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la bibliothèque')
      })
    return () => {
      cancelled = true
    }
  }, [theme, band, page, refresh])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function changeFilter(nextTheme: string, nextBand: string) {
    setTheme(nextTheme)
    setBand(nextBand)
    setPage(1)
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Tire au sort N puzzles parmi le filtre courant */
  async function selectRandom() {
    setError(null)
    const qs = filterQuery(theme, band)
    const res = await fetch(`/api/puzzles?idsOnly=1${qs ? `&${qs}` : ''}`, { cache: 'no-store' })
    const { ids } = (await res.json()) as { ids: string[] }
    // Mélange de Fisher-Yates
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    setSelected(new Set(ids.slice(0, randomCount)))
  }

  async function removePuzzle(id: string) {
    await fetch(`/api/puzzles/${id}`, { method: 'DELETE' })
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setRefresh((r) => r + 1)
  }

  async function createSession() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleIds: [...selected],
          name: sessionName || undefined,
          timeLimit,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Erreur lors de la création')
        return
      }
      router.push(`/ecran/${body.code}`)
    } catch {
      setError('Erreur réseau')
    } finally {
      setCreating(false)
    }
  }

  if (!puzzles) {
    return <p className="animate-pulse p-8 text-zinc-400">Chargement de la bibliothèque…</p>
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">♟️ Tempête sur l&apos;échiquier</h1>
          <p className="text-zinc-400">
            {total} problème{total > 1 ? 's' : ''}
            {theme || band ? ' pour ce filtre' : ' dans la bibliothèque'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tableau"
            className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            ♟️ Échiquier libre
          </Link>
          <Link
            href="/import"
            className="rounded-lg border border-amber-500 px-4 py-2 font-semibold text-amber-400 hover:bg-amber-500/10"
          >
            ＋ Importer des problèmes
          </Link>
        </div>
      </header>

      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-400" htmlFor="theme-filter">Thème</label>
          <select
            id="theme-filter"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            value={theme}
            onChange={(e) => changeFilter(e.target.value, band)}
          >
            <option value="">Tous les thèmes</option>
            {FILTER_THEMES.map((t) => (
              <option key={t} value={t}>
                {themeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-400" htmlFor="band-filter">Difficulté</label>
          <select
            id="band-filter"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            value={band}
            onChange={(e) => changeFilter(theme, e.target.value)}
          >
            {BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={randomCount}
            onChange={(e) => setRandomCount(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
            className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-center"
            aria-label="Nombre de problèmes à tirer au sort"
          />
          <button
            onClick={selectRandom}
            className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
            title="Tire au sort parmi les problèmes du filtre courant"
          >
            🎲 Tirage aléatoire
          </button>
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
          >
            Vider la sélection ({selected.size})
          </button>
        )}
      </section>

      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-400" htmlFor="session-name">Nom de la séance (optionnel)</label>
          <input
            id="session-name"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 outline-none focus:border-amber-400"
            value={sessionName}
            maxLength={100}
            placeholder="Cours du mercredi"
            onChange={(e) => setSessionName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-400" htmlFor="time-limit">Temps par problème</label>
          <select
            id="time-limit"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
          >
            {[30, 60, 90, 120, 180, 300].map((s) => (
              <option key={s} value={s}>
                {s < 60 ? `${s} s` : `${s / 60} min`}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={createSession}
          disabled={selected.size === 0 || creating}
          className="rounded-lg bg-amber-500 px-6 py-2 font-bold text-zinc-950 disabled:opacity-40"
        >
          {creating ? 'Création…' : `🚀 Lancer une session (${selected.size} problème${selected.size > 1 ? 's' : ''})`}
        </button>
        {error && <p className="w-full text-red-400">{error}</p>}
      </section>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-700 p-16 text-center">
          <p className="text-xl text-zinc-300">Aucun problème pour ce filtre.</p>
          <Link href="/import" className="rounded-lg bg-amber-500 px-6 py-3 font-bold text-zinc-950">
            Importer des problèmes
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {puzzles.map((p) => {
              const isSelected = selected.has(p.id)
              const labels = primaryThemes(p.themes)
              return (
                <li
                  key={p.id}
                  className={`relative cursor-pointer rounded-xl border p-2 transition ${
                    isSelected ? 'border-amber-400 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                  onClick={() => toggle(p.id)}
                >
                  <div className="pointer-events-none">
                    <StaticBoard fen={p.fen} orientation={sideToMove(p.fen)} />
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {labels.length > 0
                          ? labels.join(' · ')
                          : p.title ?? (sideToMove(p.fen) === 'white' ? 'Trait aux Blancs' : 'Trait aux Noirs')}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {Math.ceil(p.solution.split(' ').length / 2)} coup
                        {Math.ceil(p.solution.split(' ').length / 2) > 1 ? 's' : ''}
                        {p.difficulty ? ` · ${p.difficulty}` : ''}
                        {sideToMove(p.fen) === 'white' ? ' · ⬜' : ' · ⬛'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removePuzzle(p.id)
                      }}
                      title="Supprimer"
                      className="shrink-0 rounded px-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                  {isSelected && (
                    <span className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-zinc-950">
                      ✓
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-zinc-700 px-4 py-2 disabled:opacity-30"
              >
                ◀ Précédent
              </button>
              <span className="text-zinc-400">
                Page {page}/{totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-zinc-700 px-4 py-2 disabled:opacity-30"
              >
                Suivant ▶
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
