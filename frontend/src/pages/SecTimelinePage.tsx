import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTimeline, useCompanies, usePrices, useTickerSearch } from '../hooks'
import { Timeline, Loading, StockChart, AdminPanel } from '../components'
import { AuthButton } from '../components/AuthButton'
import { logInterest, verifyAdmin } from '../api'
import type { TimelineEvent, TickerSearchResult } from '../api/types'

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
  { value: 'PR', label: 'News' },
]

export default function SecTimelinePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [activeTicker, setActiveTicker] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedFormTypes, setSelectedFormTypes] = useState<string[]>(
    FORM_TYPES.filter(ft => ft.value !== 'PR' && ft.value !== '4').map(ft => ft.value)
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
  const searchHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFormTypesDropdown(false)
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
      setUnsupportedMsg(`${result.ticker} is not yet supported - we've noted your interest!`)
      unsupportedTimer.current = setTimeout(() => setUnsupportedMsg(null), 5000)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      <header className="bg-stone-950/95 backdrop-blur border-b border-white/10 px-4 py-3 relative z-20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1.5">
              <svg className="w-5 h-5 text-red-400" viewBox="0 0 64 64" fill="currentColor">
                <path d="M12 48c0-4 2-12 6-18l-8-14c-1-2 0-4 2-4h4l6 10c4-4 9-7 14-8V6c0-2 2-4 4-2l2 4v8c5 1 10 4 14 8l6-10h4c2 0 3 2 2 4l-8 14c4 6 6 14 6 18" />
                <path d="M20 44c-2-8 2-16 12-20M44 44c2-8-2-16-12-20" strokeWidth="2" stroke="currentColor" fill="none" />
                <circle cx="26" cy="32" r="2" />
                <circle cx="38" cy="32" r="2" />
              </svg>
              TickerClaw
            </Link>
            <span className="text-white/20">|</span>
            <h1 className="text-base sm:text-xl font-bold text-white">SEC Filings Timeline</h1>
            <Link to="/top-25" className="text-xs sm:text-sm font-medium text-amber-300 hover:text-amber-200">
              Top 25
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex rounded-lg overflow-hidden border border-white/10 bg-white/5">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium transition ${
                  viewMode === 'timeline'
                    ? 'bg-white text-stone-950'
                    : 'bg-transparent text-stone-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium transition ${
                  viewMode === 'chart'
                    ? 'bg-white text-stone-950'
                    : 'bg-transparent text-stone-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                Chart
              </button>
            </div>

            <div
              className="relative flex-1 sm:flex-none pb-1"
              ref={searchRef}
              onMouseEnter={() => {
                if (searchHideTimer.current) clearTimeout(searchHideTimer.current)
              }}
              onMouseLeave={() => {
                searchHideTimer.current = setTimeout(() => setShowSearchResults(false), 150)
              }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setShowSearchResults(true)
                }}
                onFocus={() => { if (searchQuery) setShowSearchResults(true) }}
                onBlur={() => {
                  searchHideTimer.current = setTimeout(() => setShowSearchResults(false), 200)
                }}
                placeholder="Search ticker..."
                className="px-2 py-1 sm:px-3 sm:py-1.5 border border-white/10 bg-white/5 rounded text-xs sm:text-sm text-white placeholder:text-stone-500 w-full sm:w-48"
              />
              {unsupportedMsg && (
                <div className="absolute top-full left-0 bg-amber-500/10 border border-amber-300/20 text-amber-100 text-xs rounded px-3 py-2 z-50 w-72 shadow-lg shadow-black/30">
                  {unsupportedMsg}
                </div>
              )}
              {!unsupportedMsg && showSearchResults && searchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 bg-stone-950 border border-white/10 rounded shadow-lg shadow-black/40 z-50 w-80 max-h-64 overflow-y-auto">
                  {searchResults.map(r => {
                    const supported = companies?.some(c => c.ticker === r.ticker)
                    return (
                      <button
                        key={r.ticker}
                        onClick={() => handleSelectTicker(r)}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 border-b border-white/10 last:border-b-0"
                      >
                        <span className="font-mono font-bold text-sm w-16 text-white">{r.ticker}</span>
                        <span className="text-sm text-stone-300 truncate flex-1">{r.name}</span>
                        {supported && (
                          <span className="text-xs text-emerald-300 font-medium shrink-0">supported</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {activeTicker && (
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-100 border border-amber-300/20 rounded text-sm font-medium">
                {activeTicker}
              </span>
            )}

            <div
              className="relative"
              ref={dropdownRef}
              onMouseEnter={() => {
                if (dropdownHideTimer.current) clearTimeout(dropdownHideTimer.current)
                setShowFormTypesDropdown(true)
              }}
              onMouseLeave={() => {
                setShowFormTypesDropdown(false)
              }}
            >
              <button
                className="px-2 py-1 sm:px-3 sm:py-1.5 border border-white/10 rounded text-xs sm:text-sm flex items-center justify-between bg-white/5 text-stone-200 w-full sm:w-[200px]"
              >
                <span className="sm:hidden">Forms</span>
                <span className="hidden sm:inline">Form Types</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showFormTypesDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-stone-950 border border-white/10 rounded shadow-lg shadow-black/40 z-50 min-w-[200px]">
                  <div className="p-2 border-b border-white/10 text-xs text-stone-400 font-medium">Show form types:</div>
                  {FORM_TYPES.map(ft => (
                    <label
                      key={ft.value}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 cursor-pointer"
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
                      <span className="text-sm text-stone-200">{ft.label}</span>
                    </label>
                  ))}
                  <div className="flex border-t border-white/10">
                    <button
                      onClick={() => setSelectedFormTypes(FORM_TYPES.map(ft => ft.value))}
                      className="flex-1 px-3 py-2 text-sm text-amber-200 hover:bg-white/5"
                    >
                      Select all
                    </button>
                    <button
                      onClick={() => setSelectedFormTypes([])}
                      className="flex-1 px-3 py-2 text-sm text-stone-300 hover:bg-white/5 border-l border-white/10"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              )}
            </div>

            <AuthButton variant="dark" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-stone-950">
        {viewMode === 'timeline' ? (
          !activeTicker ? (
            <div className="flex items-center justify-center h-full text-stone-400 py-12">
              Search for a ticker to get started
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 text-rose-200">
                <p className="font-medium">Error</p>
                <p className="text-sm">{(error as Error).message}</p>
              </div>
            </div>
          ) : loadingTimeline ? (
            <div className="bg-stone-950">
              <Loading />
            </div>
          ) : (
            <Timeline
              events={timeline?.events || []}
              onEventClick={setSelectedEvent}
            />
          )
        ) : (
          <div className="bg-stone-950 p-4">
            {!activeTicker ? (
              <div className="text-stone-400 text-center py-12">
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
                  <p className="text-xs text-stone-500">
                    These summaries are AI-generated. Please refer to the original filings at{' '}
                    <a href="https://www.sec.gov/edgar/searchedgar/companysearch" target="_blank" rel="noopener noreferrer" className="text-stone-300 underline hover:text-white">
                      SEC.gov
                    </a>{' '}
                    for complete information.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-stone-400 text-center py-12">
                No price data available for {activeTicker}
              </div>
            )}
          </div>
        )}
      </main>

      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-stone-950 border border-white/10 rounded-2xl shadow-xl max-w-lg w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-lg font-bold text-white">{selectedEvent.ticker}</span>
                <span className="text-stone-400 ml-2">{selectedEvent.company_name}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-stone-400 hover:text-stone-200"
              >
                Close
              </button>
            </div>

            <div className="text-sm text-stone-300 mb-2">
              {selectedEvent.form_type} - {selectedEvent.form_type_description}
            </div>
            <div className="text-sm text-stone-500 mb-4">
              Filed: {new Date(selectedEvent.filed_date).toLocaleDateString()}
            </div>

            <p className="text-stone-100 mb-4">
              {selectedEvent.headline || 'No summary available for this filing.'}
            </p>

            <a
              href={selectedEvent.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-white text-stone-950 rounded hover:bg-stone-200"
            >
              {selectedEvent.event_type === 'press_release' ? 'Read Article' : 'View Full Filing'}
            </a>
          </div>
        </div>
      )}

      <footer className="bg-stone-950 border-t border-white/10 px-4 py-2 flex items-center justify-between text-sm text-stone-500">
        <span>{timeline?.total || 0} filings loaded</span>
        <button
          onClick={() => setShowAdminLogin(true)}
          className="text-xs text-stone-600 hover:text-stone-400"
        >
          Admin
        </button>
      </footer>

      {showAdminLogin && !adminUnlocked && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={() => { setShowAdminLogin(false); setAdminPassword(''); setAdminError(false) }}
        >
          <form
            className="bg-stone-950 border border-white/10 rounded-2xl shadow-xl p-6 w-full max-w-xs space-y-4"
            onClick={e => e.stopPropagation()}
            onSubmit={handleAdminLogin}
          >
            <h2 className="text-base font-semibold text-white">Admin Access</h2>
            <input
              type="password"
              value={adminPassword}
              onChange={e => { setAdminPassword(e.target.value); setAdminError(false) }}
              placeholder="Password"
              className={`w-full px-3 py-2 border rounded text-sm bg-white/5 text-white ${adminError ? 'border-rose-400/70' : 'border-white/10'}`}
              autoFocus
            />
            {adminError && <p className="text-xs text-rose-300">Incorrect password</p>}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-white text-stone-950 rounded text-sm font-medium hover:bg-stone-200"
            >
              Unlock
            </button>
          </form>
        </div>
      )}

      {adminUnlocked && (
        <AdminPanel onClose={() => setAdminUnlocked(false)} />
      )}
    </div>
  )
}
