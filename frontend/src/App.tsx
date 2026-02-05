import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTimeline, useCompanies } from './hooks'
import { Timeline, Loading, ErrorMessage } from './components'
import { addCompany, fetchFilings } from './api'
import type { TimelineEvent } from './api/types'

const AVAILABLE_TICKERS = ['ASTS', 'PLTR', 'TSLA', 'IREN']

const FORM_TYPES = [
  { value: '4', label: 'Form 4 (Insider)' },
  { value: '10-K', label: '10-K (Annual)' },
  { value: '10-Q', label: '10-Q (Quarterly)' },
  { value: '8-K', label: '8-K (Current)' },
  { value: 'DEF 14A', label: 'DEF 14A (Proxy)' },
  { value: 'S-1', label: 'S-1 (IPO)' },
  { value: 'SC 13G', label: 'SC 13G (Ownership)' },
  { value: 'SC 13D', label: 'SC 13D (Ownership)' },
]

function App() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<{
    ticker?: string
    exclude_form_types?: string[]
  }>({
    exclude_form_types: FORM_TYPES.map(ft => ft.value),
  })
  const [fetching, setFetching] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [showExcludeDropdown, setShowExcludeDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExcludeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: companies, isLoading: loadingCompanies } = useCompanies()
  const { data: timeline, isLoading: loadingTimeline, error } = useTimeline({
    ...filters,
    limit: 200,
  })

  const handleAddCompany = async (ticker: string) => {
    try {
      await addCompany(ticker)
      queryClient.invalidateQueries({ queryKey: ['companies'] })
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleFetch = async () => {
    setFetching(true)
    try {
      const result = await fetchFilings({ limit: 30, summarize: true })
      alert(`Fetched ${result.fetched} filings, skipped ${result.skipped} duplicates`)
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    } catch (err) {
      alert((err as Error).message)
    }
    setFetching(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Stock DD Finder</h1>

          <div className="flex items-center gap-4">
            {/* Ticker filter */}
            <select
              value={filters.ticker || ''}
              onChange={e => setFilters(f => ({ ...f, ticker: e.target.value || undefined }))}
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="">All Companies</option>
              {companies?.map(c => (
                <option key={c.ticker} value={c.ticker}>{c.ticker}</option>
              ))}
            </select>

            {/* Exclude form types multi-select */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowExcludeDropdown(!showExcludeDropdown)}
                className="px-3 py-1.5 border rounded text-sm flex items-center gap-2 bg-white"
              >
                <span>Form Types</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExcludeDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-10 min-w-[200px]">
                  <div className="p-2 border-b text-xs text-gray-500 font-medium">Hide form types:</div>
                  {FORM_TYPES.map(ft => (
                    <label
                      key={ft.value}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.exclude_form_types?.includes(ft.value) || false}
                        onChange={e => {
                          const current = filters.exclude_form_types || []
                          if (e.target.checked) {
                            setFilters(f => ({ ...f, exclude_form_types: [...current, ft.value] }))
                          } else {
                            setFilters(f => ({
                              ...f,
                              exclude_form_types: current.filter(t => t !== ft.value) || undefined,
                            }))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{ft.label}</span>
                    </label>
                  ))}
                  {filters.exclude_form_types?.length ? (
                    <button
                      onClick={() => setFilters(f => ({ ...f, exclude_form_types: undefined }))}
                      className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {/* Fetch button */}
            <button
              onClick={handleFetch}
              disabled={fetching || !companies?.length}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {fetching ? 'Fetching...' : 'Fetch Filings'}
            </button>
          </div>
        </div>

        {/* Company chips */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-sm text-gray-500">Tracking:</span>
          {loadingCompanies ? (
            <span className="text-sm text-gray-400">Loading...</span>
          ) : companies?.length ? (
            companies.map(c => (
              <span
                key={c.ticker}
                className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm"
              >
                {c.ticker}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-400">None</span>
          )}

          {/* Add company buttons */}
          {AVAILABLE_TICKERS.filter(t => !companies?.find(c => c.ticker === t)).map(ticker => (
            <button
              key={ticker}
              onClick={() => handleAddCompany(ticker)}
              className="px-2 py-0.5 border border-dashed border-gray-300 text-gray-500 rounded text-sm hover:border-blue-500 hover:text-blue-500"
            >
              + {ticker}
            </button>
          ))}
        </div>
      </header>

      {/* Timeline */}
      <main className="flex-1 overflow-hidden relative">
        {error ? (
          <div className="p-4">
            <ErrorMessage message={(error as Error).message} />
          </div>
        ) : loadingTimeline ? (
          <Loading />
        ) : (
          <Timeline
            events={timeline?.events || []}
            onEventClick={setSelectedEvent}
          />
        )}
        {/* Refresh button */}
        <button
          onClick={() => window.location.reload()}
          className="absolute top-2 right-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm text-gray-700"
        >
          Refresh
        </button>
      </main>

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-lg font-bold">{selectedEvent.ticker}</span>
                <span className="text-gray-500 ml-2">{selectedEvent.company_name}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>

            <div className="text-sm text-gray-600 mb-2">
              {selectedEvent.form_type} - {selectedEvent.form_type_description}
            </div>
            <div className="text-sm text-gray-500 mb-4">
              Filed: {new Date(selectedEvent.filed_date).toLocaleDateString()}
            </div>

            <p className="text-gray-800 mb-4">
              {selectedEvent.headline || 'No summary available for this filing.'}
            </p>

            <a
              href={selectedEvent.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View Full Filing
            </a>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t px-4 py-2 text-center text-sm text-gray-500">
        {timeline?.total || 0} filings loaded
      </footer>
    </div>
  )
}

export default App
