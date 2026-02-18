import { useState, useEffect, useRef } from 'react'
import { useTimeline, useCompanies, usePrices, useTickerSearch } from './hooks'
import { Timeline, Loading, ErrorMessage, StockChart, AdminPanel } from './components'
import { logInterest, verifyAdmin } from './api'
import type { TimelineEvent, TickerSearchResult } from './api/types'

type ViewMode = 'timeline' | 'chart'

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
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [activeTicker, setActiveTicker] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedFormTypes, setSelectedFormTypes] = useState<string[]>(
    FORM_TYPES.map(ft => ft.value)
  )
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [unsupportedMsg, setUnsupportedMsg] = useState<string | null>(null)
  const unsupportedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState(false)
  const [showFormTypesDropdown, setShowFormTypesDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const excludeFormTypes = FORM_TYPES
    .map(ft => ft.value)
    .filter(v => !selectedFormTypes.includes(v))

  const { data: companies } = useCompanies()
  const { data: searchResults } = useTickerSearch(searchQuery)
  const { data: timeline, isLoading: loadingTimeline, error } = useTimeline({
    ticker: activeTicker,
    exclude_form_types: excludeFormTypes.length > 0 ? excludeFormTypes : undefined,
    limit: 200,
  })
  const { data: priceData, isLoading: loadingPrices } = usePrices(
    viewMode === 'chart' ? activeTicker : undefined,
    '1y'
  )

  // Set default active ticker when companies load
  useEffect(() => {
    if (companies?.length && !activeTicker) {
      setActiveTicker(companies[0].ticker)
    }
  }, [companies, activeTicker])

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await verifyAdmin(adminPassword)
    if (ok) {
      setAdminUnlocked(true)
      setShowAdminLogin(false)
      setAdminPassword('')
      setAdminError(false)
    } else {
      setAdminError(true)
    }
  }

  const handleSelectTicker = async (result: TickerSearchResult) => {
    setSearchQuery('')
    setShowSearchResults(false)

    const isSupported = companies?.some(c => c.ticker === result.ticker)

    if (isSupported) {
      setUnsupportedMsg(null)
      setActiveTicker(result.ticker)
    } else {
      logInterest(result.ticker, result.name).catch(() => {})
      if (unsupportedTimer.current) clearTimeout(unsupportedTimer.current)
      setUnsupportedMsg(`${result.ticker} is not yet supported — we've noted your interest!`)
      unsupportedTimer.current = setTimeout(() => setUnsupportedMsg(null), 5000)
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3 relative z-20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900">SEC Filings Timeline</h1>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 text-sm font-medium ${
                  viewMode === 'timeline'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1.5 text-sm font-medium ${
                  viewMode === 'chart'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Chart
              </button>
            </div>

            {/* Ticker search */}
            <div className="relative flex-1 sm:flex-none" ref={searchRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setShowSearchResults(true)
                }}
                onFocus={() => { if (searchQuery) setShowSearchResults(true) }}
                placeholder="Search ticker..."
                className="px-3 py-1.5 border rounded text-sm w-full sm:w-48"
              />
              {unsupportedMsg && (
                <div className="absolute top-full left-0 mt-1 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded px-3 py-2 z-50 w-72 shadow">
                  {unsupportedMsg}
                </div>
              )}
              {!unsupportedMsg && showSearchResults && searchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 w-80 max-h-64 overflow-y-auto">
                  {searchResults.map(r => {
                    const supported = companies?.some(c => c.ticker === r.ticker)
                    return (
                      <button
                        key={r.ticker}
                        onClick={() => handleSelectTicker(r)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 border-b last:border-b-0"
                      >
                        <span className="font-mono font-bold text-sm w-16">{r.ticker}</span>
                        <span className="text-sm text-gray-600 truncate flex-1">{r.name}</span>
                        {supported && (
                          <span className="text-xs text-green-600 font-medium shrink-0">supported</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Active ticker indicator */}
            {activeTicker && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                {activeTicker}
              </span>
            )}

            {/* Form types multi-select */}
            <div
              className="relative"
              ref={dropdownRef}
              onMouseEnter={() => {
                if (dropdownHideTimer.current) clearTimeout(dropdownHideTimer.current)
                setShowFormTypesDropdown(true)
              }}
              onMouseLeave={() => {
                dropdownHideTimer.current = setTimeout(() => setShowFormTypesDropdown(false), 150)
              }}
            >
              <button
                className="px-3 py-1.5 border rounded text-sm flex items-center justify-between bg-white w-full sm:w-[200px]"
              >
                <span>Form Types</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showFormTypesDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 min-w-[200px]">
                  <div className="p-2 border-b text-xs text-gray-500 font-medium">Show form types:</div>
                  {FORM_TYPES.map(ft => (
                    <label
                      key={ft.value}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFormTypes.includes(ft.value)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedFormTypes(prev => [...prev, ft.value])
                          } else {
                            setSelectedFormTypes(prev => prev.filter(t => t !== ft.value))
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{ft.label}</span>
                    </label>
                  ))}
                  <div className="flex border-t">
                    <button
                      onClick={() => setSelectedFormTypes(FORM_TYPES.map(ft => ft.value))}
                      className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setSelectedFormTypes([])}
                      className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 border-l"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">
        {viewMode === 'timeline' ? (
          // Timeline view
          !activeTicker ? (
            <div className="flex items-center justify-center h-full text-gray-500 py-12">
              Search for a ticker to get started
            </div>
          ) : error ? (
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
          )
        ) : (
          // Chart view
          <div className="bg-gray-900 p-4">
            {!activeTicker ? (
              <div className="text-gray-400 text-center py-12">
                Search for a ticker to view the chart
              </div>
            ) : loadingPrices ? (
              <div className="flex items-center justify-center py-12">
                <Loading />
              </div>
            ) : priceData?.candles?.length ? (
              <>
                <StockChart
                  key={activeTicker}
                  ticker={activeTicker}
                  candles={priceData.candles}
                  filings={timeline?.events || []}
                  onFilingClick={setSelectedEvent}
                />
                <div className="pt-12 pb-6 text-center">
                  <p className="text-xs text-gray-500">
                    These summaries are AI-generated. Please refer to the original filings at{' '}
                    <a href="https://www.sec.gov/edgar/searchedgar/companysearch" target="_blank" rel="noopener noreferrer" className="text-gray-400 underline hover:text-gray-300">
                      SEC.gov
                    </a>{' '}
                    for complete information.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-center py-12">
                No price data available for {activeTicker}
              </div>
            )}
          </div>
        )}
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
      <footer className="bg-white border-t px-4 py-2 flex items-center justify-between text-sm text-gray-500">
        <span>{timeline?.total || 0} filings loaded</span>
        <button
          onClick={() => setShowAdminLogin(true)}
          className="text-xs text-gray-300 hover:text-gray-400"
        >
          Admin
        </button>
      </footer>

      {/* Admin login modal */}
      {showAdminLogin && !adminUnlocked && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => { setShowAdminLogin(false); setAdminPassword(''); setAdminError(false) }}
        >
          <form
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-xs space-y-4"
            onClick={e => e.stopPropagation()}
            onSubmit={handleAdminLogin}
          >
            <h2 className="text-base font-semibold text-gray-900">Admin Access</h2>
            <input
              type="password"
              value={adminPassword}
              onChange={e => { setAdminPassword(e.target.value); setAdminError(false) }}
              placeholder="Password"
              className={`w-full px-3 py-2 border rounded text-sm ${adminError ? 'border-red-400' : ''}`}
              autoFocus
            />
            {adminError && <p className="text-xs text-red-500">Incorrect password</p>}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              Unlock
            </button>
          </form>
        </div>
      )}

      {/* Admin panel */}
      {adminUnlocked && (
        <AdminPanel onClose={() => setAdminUnlocked(false)} />
      )}
    </div>
  )
}

export default App
