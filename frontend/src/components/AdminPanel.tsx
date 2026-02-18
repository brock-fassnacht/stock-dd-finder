import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCompanies, useTickerSearch } from '../hooks'
import { addCompany, removeCompany, startSync, getSyncStatus } from '../api'
import type { TickerSearchResult, SyncStatus } from '../api/types'

interface Props {
  onClose: () => void
}

export function AdminPanel({ onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: companies, isLoading } = useCompanies()
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: searchResults } = useTickerSearch(searchQuery)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Poll sync status every 2s while running; stop when done
  const startPolling = () => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const status = await getSyncStatus()
      setSyncStatus(status)
      if (!status.running) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
      }
    }, 2000)
  }

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const handleSyncAll = async () => {
    await startSync()
    const status = await getSyncStatus()
    setSyncStatus(status)
    startPolling()
  }

  const flash = (text: string, error = false) => {
    setMessage({ text, error })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleAdd = async (result: TickerSearchResult) => {
    setSearchQuery('')
    setShowResults(false)
    setAdding(true)
    try {
      await addCompany(result.ticker)
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      flash(`Added ${result.ticker}`)
    } catch (err) {
      flash((err as Error).message, true)
    }
    setAdding(false)
  }

  const handleRemove = async (ticker: string) => {
    setRemoving(ticker)
    try {
      await removeCompany(ticker)
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    } catch (err) {
      flash((err as Error).message, true)
    }
    setRemoving(null)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Manage Tracked Securities</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Add ticker search */}
          <div ref={searchRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Security</label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowResults(true) }}
              onFocus={() => { if (searchQuery) setShowResults(true) }}
              placeholder="Search ticker or company name..."
              className="w-full px-3 py-2 border rounded text-sm"
              disabled={adding}
              autoFocus
            />
            {showResults && searchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                {searchResults.map(r => {
                  const alreadyTracked = companies?.some(c => c.ticker === r.ticker)
                  return (
                    <button
                      key={r.ticker}
                      onClick={() => !alreadyTracked && handleAdd(r)}
                      disabled={alreadyTracked}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 border-b last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="font-mono font-bold text-sm w-16">{r.ticker}</span>
                      <span className="text-sm text-gray-600 truncate flex-1">{r.name}</span>
                      {alreadyTracked && (
                        <span className="text-xs text-green-600 shrink-0">tracked</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.error ? 'text-red-600' : 'text-green-600'}`}>
              {message.text}
            </p>
          )}

          {/* Sync All */}
          <div className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Sync All Filings</p>
                <p className="text-xs text-gray-400">Fetches + summarizes new filings for all tracked stocks</p>
              </div>
              <button
                onClick={handleSyncAll}
                disabled={syncStatus?.running}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {syncStatus?.running ? 'Running...' : 'Sync All'}
              </button>
            </div>

            {syncStatus && (
              <div className="text-xs space-y-1 pt-1 border-t">
                <div className="flex items-center gap-2">
                  {syncStatus.running && (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                  <span className={syncStatus.running ? 'text-blue-700' : 'text-gray-600'}>
                    {syncStatus.message}
                  </span>
                </div>
                {(syncStatus.fetched > 0 || syncStatus.skipped > 0) && (
                  <p className="text-gray-500">
                    {syncStatus.fetched} new &middot; {syncStatus.skipped} already stored
                  </p>
                )}
                {syncStatus.errors.length > 0 && (
                  <p className="text-amber-600">{syncStatus.errors.length} error(s)</p>
                )}
              </div>
            )}
          </div>

          {/* Current tracked list */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tracked Securities{companies ? ` (${companies.length})` : ''}
            </label>
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : !companies?.length ? (
              <p className="text-sm text-gray-400 italic">No securities tracked yet.</p>
            ) : (
              <div className="border rounded divide-y max-h-64 overflow-y-auto">
                {companies.map(c => (
                  <div key={c.ticker} className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-sm">{c.ticker}</span>
                      <span className="text-sm text-gray-500 ml-2 truncate">{c.name}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(c.ticker)}
                      disabled={removing === c.ticker}
                      className="ml-3 text-sm text-red-500 hover:text-red-700 disabled:opacity-40 shrink-0"
                    >
                      {removing === c.ticker ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
