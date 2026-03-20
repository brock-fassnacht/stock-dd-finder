import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompanies, usePrices, useTickerSearch, useTimeline } from '../hooks'
import { AdminPanel, StockChart, Timeline } from '../components'
import { AuthButton } from '../components/AuthButton'
import { logInterest, verifyAdmin } from '../api'
import type { TickerSearchResult, TimelineEvent } from '../api/types'

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

function formatDate(value?: string | null) {
  if (!value) return 'No recent filing'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getLatestFiledDate(events: TimelineEvent[]) {
  if (!events.length) return null

  let latest = events[0].filed_date
  for (const event of events) {
    if (new Date(event.filed_date).getTime() > new Date(latest).getTime()) {
      latest = event.filed_date
    }
  }

  return latest
}

function PanelState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-6 sm:p-10">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-8 text-center shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)]">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-stone-300">{description}</p>
      </div>
    </div>
  )
}

export default function SecTimelinePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [activeTicker, setActiveTicker] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [selectedFormTypes, setSelectedFormTypes] = useState<string[]>(
    FORM_TYPES.filter(formType => formType.value !== 'PR' && formType.value !== '4').map(formType => formType.value)
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
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node

      if (searchRef.current && !searchRef.current.contains(target)) {
        setShowSearchResults(false)
      }

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowFormTypesDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (unsupportedTimer.current) {
        clearTimeout(unsupportedTimer.current)
      }
    }
  }, [])

  const excludeFormTypes = FORM_TYPES
    .map(formType => formType.value)
    .filter(value => !selectedFormTypes.includes(value))

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

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault()
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

    const isSupported = companies?.some(company => company.ticker === result.ticker)

    if (isSupported) {
      setUnsupportedMsg(null)
      setActiveTicker(result.ticker)
      return
    }

    logInterest(result.ticker, result.name).catch(() => {})
    if (unsupportedTimer.current) clearTimeout(unsupportedTimer.current)
    setUnsupportedMsg(`${result.ticker} is not supported yet, but we logged your interest.`)
    unsupportedTimer.current = setTimeout(() => setUnsupportedMsg(null), 5000)
  }

  const timelineEvents = timeline?.events || []
  const latestFiledDate = getLatestFiledDate(timelineEvents)
  const activeCompany = companies?.find(company => company.ticker === activeTicker)
  const selectedFormEntries = FORM_TYPES.filter(formType => selectedFormTypes.includes(formType.value))
  const pressReleaseCount = timelineEvents.filter(event => event.form_type === 'PR' || event.event_type === 'press_release').length
  const filingCount = timelineEvents.length - pressReleaseCount
  const featuredFormLabel = selectedFormEntries.length === FORM_TYPES.length
    ? 'All form types'
    : selectedFormEntries.length === 0
      ? 'No form types selected'
      : selectedFormEntries.length === 1
        ? selectedFormEntries[0].label
        : `${selectedFormEntries.length} form types selected`

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      <header className="border-b border-white/10 bg-stone-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
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
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-stone-500">Research Feed</p>
              <h1 className="text-base sm:text-xl font-bold text-white">SEC Filings Timeline</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AuthButton variant="dark" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-sky-950/70 via-stone-900 to-amber-950/60 shadow-[0_28px_90px_-45px_rgba(0,0,0,0.9)]">
            <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-sky-200/60">Filings Trail</p>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  Follow {activeTicker || 'tracked stocks'} through filings, ownership moves, and company updates.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                  This page now lives in the same darker research shell as the landing page and Bear vs Bull view, with a calmer timeline and cleaner filtering surface.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm text-stone-200">
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    {activeTicker || 'No stock selected'}
                    {activeCompany ? ` | ${activeCompany.name}` : ''}
                  </span>
                  <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sky-100">
                    {viewMode === 'timeline' ? 'Timeline view' : 'Chart view'}
                  </span>
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-amber-100">
                    {featuredFormLabel}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-stone-500">Loaded now</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{timeline?.total || 0}</div>
                  <div className="mt-2 text-sm text-stone-400">Timeline events in the current feed</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-stone-500">Latest item</div>
                  <div className="mt-3 text-xl font-semibold text-white">{formatDate(latestFiledDate)}</div>
                  <div className="mt-2 text-sm text-stone-400">Most recent filing or news item shown</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-stone-500">SEC filings</div>
                  <div className="mt-3 text-3xl font-semibold text-sky-200">{filingCount}</div>
                  <div className="mt-2 text-sm text-stone-400">Structured SEC documents in the feed</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-stone-500">News items</div>
                  <div className="mt-3 text-3xl font-semibold text-amber-200">{pressReleaseCount}</div>
                  <div className="mt-2 text-sm text-stone-400">Press releases and news mixed into the trail</div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)] sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Mode</div>
                <div className="mt-2 inline-flex rounded-full border border-white/10 bg-stone-950/70 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('timeline')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === 'timeline'
                        ? 'bg-white text-stone-950'
                        : 'text-stone-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('chart')}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === 'chart'
                        ? 'bg-white text-stone-950'
                        : 'text-stone-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    Chart
                  </button>
                </div>
              </div>

              <label className="block">
                <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Tracked stock</div>
                <select
                  value={activeTicker || ''}
                  onChange={event => {
                    setUnsupportedMsg(null)
                    setActiveTicker(event.target.value || undefined)
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400"
                >
                  {!companies?.length && <option value="">Loading tracked stocks...</option>}
                  {companies?.map(company => (
                    <option key={company.ticker} value={company.ticker} className="text-gray-900">
                      {company.ticker} - {company.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="relative" ref={searchRef}>
                <label className="block">
                  <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Search any ticker</div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={event => {
                      setSearchQuery(event.target.value)
                      setShowSearchResults(event.target.value.trim().length > 0)
                    }}
                    onFocus={() => {
                      if (searchQuery.trim()) {
                        setShowSearchResults(true)
                      }
                    }}
                    placeholder="AAPL, NVDA, TSLA..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-sky-400"
                  />
                </label>

                {showSearchResults && searchResults && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-stone-950 shadow-2xl shadow-black/50">
                    {searchResults.map(result => {
                      const supported = companies?.some(company => company.ticker === result.ticker)
                      return (
                        <button
                          type="button"
                          key={result.ticker}
                          onClick={() => void handleSelectTicker(result)}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.06]"
                        >
                          <span className="min-w-[56px] text-sm font-semibold text-white">{result.ticker}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-stone-300">{result.name}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${supported ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>
                            {supported ? 'tracked' : 'request'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="relative" ref={dropdownRef}>
                <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Forms</div>
                <button
                  type="button"
                  onClick={() => setShowFormTypesDropdown(open => !open)}
                  className="mt-2 flex w-full min-w-[220px] items-center justify-between rounded-2xl border border-white/10 bg-stone-950/70 px-4 py-3 text-sm text-white transition hover:border-white/20"
                >
                  <span>{featuredFormLabel}</span>
                  <svg className={`w-4 h-4 transition ${showFormTypesDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showFormTypesDropdown && (
                  <div className="absolute right-0 top-full z-30 mt-2 min-w-[280px] overflow-hidden rounded-3xl border border-white/10 bg-stone-950 shadow-2xl shadow-black/50">
                    <div className="border-b border-white/10 px-4 py-3">
                      <div className="text-sm font-medium text-white">Show form types</div>
                      <div className="mt-1 text-xs text-stone-400">Mix annual, quarterly, insider, and news items however you want.</div>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {FORM_TYPES.map(formType => (
                        <label
                          key={formType.value}
                          className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-white/[0.04]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFormTypes.includes(formType.value)}
                            onChange={event => {
                              if (event.target.checked) {
                                setSelectedFormTypes(previous => [...previous, formType.value])
                              } else {
                                setSelectedFormTypes(previous => previous.filter(value => value !== formType.value))
                              }
                            }}
                            className="rounded border-white/20 bg-stone-900 text-sky-400"
                          />
                          <span className="text-sm text-stone-200">{formType.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setSelectedFormTypes(FORM_TYPES.map(formType => formType.value))}
                        className="px-4 py-3 text-sm font-medium text-sky-200 transition hover:bg-sky-500/10"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFormTypes([])}
                        className="border-l border-white/10 px-4 py-3 text-sm font-medium text-stone-300 transition hover:bg-white/[0.04]"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selectedFormEntries.slice(0, 5).map(formType => (
                <span key={formType.value} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-stone-300">
                  {formType.value === 'PR' ? 'News' : formType.value}
                </span>
              ))}
              {selectedFormEntries.length > 5 && (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-stone-400">
                  +{selectedFormEntries.length - 5} more
                </span>
              )}
            </div>

            {unsupportedMsg && (
              <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {unsupportedMsg}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_28px_90px_-45px_rgba(0,0,0,0.95)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                  {viewMode === 'timeline' ? 'Chronology' : 'Price overlay'}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {viewMode === 'timeline'
                    ? `${activeTicker || 'Selected stock'} filing timeline`
                    : `${activeTicker || 'Selected stock'} price chart`}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-400">
                  {viewMode === 'timeline'
                    ? 'Scroll the latest disclosures in a calmer serpentine layout and open any card for the underlying filing or article.'
                    : 'Overlay filings on price action to see how disclosures line up with the trading tape.'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">
                <div className="text-xs uppercase tracking-[0.25em] text-stone-500">Active stock</div>
                <div className="mt-2 font-medium text-white">
                  {activeTicker || 'None selected'}
                </div>
              </div>
            </div>

            {viewMode === 'timeline' ? (
              !activeTicker ? (
                <PanelState
                  title="Pick a stock to begin"
                  description="Select one of your tracked companies or search for a new ticker to pull that timeline into focus."
                />
              ) : error ? (
                <PanelState
                  title="Timeline unavailable"
                  description={(error as Error).message}
                />
              ) : loadingTimeline ? (
                <PanelState
                  title="Loading the filing trail"
                  description="Pulling the latest mix of filings and news for the selected ticker."
                />
              ) : (
                <div className="min-h-[540px]">
                  <Timeline
                    events={timelineEvents}
                    onEventClick={setSelectedEvent}
                  />
                </div>
              )
            ) : (
              <div className="bg-stone-950/40">
                {!activeTicker ? (
                  <PanelState
                    title="Pick a stock to chart"
                    description="Once a ticker is active we can layer its filings over the last year of price action."
                  />
                ) : loadingPrices ? (
                  <PanelState
                    title="Loading chart data"
                    description={`Fetching one year of price history for ${activeTicker}.`}
                  />
                ) : priceData?.candles?.length ? (
                  <div className="p-4 sm:p-6">
                    <StockChart
                      key={activeTicker}
                      ticker={activeTicker}
                      candles={priceData.candles}
                      filings={timelineEvents}
                      onFilingClick={setSelectedEvent}
                    />
                  </div>
                ) : (
                  <PanelState
                    title="No chart data available"
                    description={`We could not find price history for ${activeTicker}.`}
                  />
                )}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-xs leading-6 text-stone-400">
            These summaries are AI-generated. Please refer to{' '}
            <a
              href="https://www.sec.gov/edgar/searchedgar/companysearch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-200 underline decoration-stone-500 underline-offset-4 hover:text-white"
            >
              SEC.gov
            </a>{' '}
            for complete filing text and verify the source material before making decisions.
          </section>
        </div>
      </main>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-stone-950 p-6 shadow-[0_30px_120px_-40px_rgba(0,0,0,1)] sm:p-7"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-sky-200">
                    {selectedEvent.ticker}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-stone-200">
                    {selectedEvent.form_type === 'PR' ? 'News' : selectedEvent.form_type}
                  </span>
                </div>
                <h3 className="mt-4 text-2xl font-semibold text-white">{selectedEvent.company_name}</h3>
                <p className="mt-2 text-sm text-stone-400">
                  Filed {formatDate(selectedEvent.filed_date)} | {selectedEvent.form_type_description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-stone-300 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm leading-7 text-stone-200">
                {selectedEvent.headline || 'No summary is available for this filing yet.'}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.25em] text-stone-500">
                {selectedEvent.event_type === 'press_release' ? 'Press release' : 'SEC filing'}
              </div>
              <a
                href={selectedEvent.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-stone-950 transition hover:bg-stone-200"
              >
                {selectedEvent.event_type === 'press_release' ? 'Read article' : 'Open filing'}
              </a>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-white/10 px-4 py-3 text-center text-xs text-stone-500">
        {timeline?.total || 0} items loaded across the current SEC timeline view.
      </footer>

      {showAdminLogin && !adminUnlocked && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => {
            setShowAdminLogin(false)
            setAdminPassword('')
            setAdminError(false)
          }}
        >
          <form
            className="w-full max-w-sm rounded-[28px] border border-white/10 bg-stone-950 p-6 shadow-[0_30px_120px_-40px_rgba(0,0,0,1)]"
            onClick={event => event.stopPropagation()}
            onSubmit={handleAdminLogin}
          >
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Admin</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Unlock timeline controls</h2>
            <input
              type="password"
              value={adminPassword}
              onChange={event => {
                setAdminPassword(event.target.value)
                setAdminError(false)
              }}
              placeholder="Password"
              className={`mt-5 w-full rounded-2xl border bg-stone-900 px-4 py-3 text-sm text-white outline-none ${
                adminError ? 'border-rose-400/60' : 'border-white/10 focus:border-sky-400'
              }`}
              autoFocus
            />
            {adminError && <p className="mt-2 text-xs text-rose-300">Incorrect password</p>}
            <button
              type="submit"
              className="mt-5 w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-stone-950 transition hover:bg-stone-200"
            >
              Unlock
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAdminLogin(true)}
        className="fixed bottom-4 right-4 rounded-full border border-white/10 bg-stone-950/90 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-stone-500 transition hover:border-white/20 hover:text-stone-300"
      >
        Admin
      </button>

      {adminUnlocked && (
        <AdminPanel onClose={() => setAdminUnlocked(false)} />
      )}
    </div>
  )
}
