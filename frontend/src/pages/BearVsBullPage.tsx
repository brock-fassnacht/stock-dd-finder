import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBearVsBull, useCompanies } from '../hooks'
import { Loading } from '../components'

function sourceToneClass(sourceType: string) {
  switch (sourceType) {
    case 'reddit':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'x':
      return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'seeking_alpha':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function prettySourceType(sourceType: string) {
  switch (sourceType) {
    case 'x':
      return 'X'
    case 'seeking_alpha':
      return 'Seeking Alpha'
    default:
      return sourceType.charAt(0).toUpperCase() + sourceType.slice(1)
  }
}

export default function BearVsBullPage() {
  const { data: companies } = useCompanies()
  const [tickerFilter, setTickerFilter] = useState('')

  useEffect(() => {
    if (!tickerFilter && companies?.length) {
      setTickerFilter(companies[0].ticker)
    }
  }, [companies, tickerFilter])

  const { data, isLoading, error } = useBearVsBull({
    ticker: tickerFilter || undefined,
  })

  const bullCount = data?.bull_arguments.length ?? 0
  const bearCount = data?.bear_arguments.length ?? 0

  const sourceList = useMemo(() => {
    const items = data ? [...data.bull_arguments, ...data.bear_arguments] : []
    return Array.from(new Set(items.map(item => prettySourceType(item.source_type))))
  }, [data])

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      <header className="border-b border-white/10 bg-stone-950/95 backdrop-blur px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            <h1 className="text-base sm:text-xl font-bold">Bear vs Bull</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-stone-300" htmlFor="ticker-filter">
              Stock
            </label>
            <select
              id="ticker-filter"
              value={tickerFilter}
              onChange={e => setTickerFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white min-w-[180px]"
            >
              {companies?.map(company => (
                <option key={company.ticker} value={company.ticker} className="text-gray-900">
                  {company.ticker} - {company.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-950/70 via-stone-900 to-rose-950/70 p-6 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400 mb-3">Argument Map</p>
              <h2 className="text-3xl sm:text-4xl font-semibold mb-3">
                {tickerFilter || 'Select a stock'} market debate
              </h2>
              <p className="text-stone-300 max-w-2xl">
                Compare bullish and bearish arguments side by side. The data model is set up to ingest structured takes from sources like X, Reddit, and Seeking Alpha.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                <div className="text-stone-400">Bull arguments</div>
                <div className="text-2xl font-semibold text-emerald-300">{bullCount}</div>
              </div>
              <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
                <div className="text-stone-400">Bear arguments</div>
                <div className="text-2xl font-semibold text-rose-300">{bearCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-stone-400">Sources tracked</div>
                <div className="text-lg font-semibold text-white">{sourceList.join(', ') || 'None yet'}</div>
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <Loading />
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-5 text-rose-200">
            Failed to load bear vs bull arguments.
          </div>
        ) : (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              <div className="border-b border-emerald-500/20 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70 mb-2">Bull</p>
                <h3 className="text-2xl font-semibold text-emerald-200">Why investors are optimistic</h3>
              </div>
              <div className="p-5 space-y-4">
                {data?.bull_arguments.length ? data.bull_arguments.map(argument => (
                  <article key={argument.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${sourceToneClass(argument.source_type)}`}>
                        {prettySourceType(argument.source_type)}
                      </span>
                      <span className="text-xs text-stone-400">
                        {new Date(argument.as_of_date).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">{argument.title}</h4>
                    <p className="text-sm text-stone-300 mb-4">{argument.summary}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-stone-400">
                        {argument.source_name}{argument.author_handle ? ` - ${argument.author_handle}` : ''}
                      </span>
                      {argument.url && (
                        <a
                          href={argument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-300 hover:text-emerald-200"
                        >
                          Open source
                        </a>
                      )}
                    </div>
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-stone-400">
                    No bullish arguments are stored for this ticker yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 overflow-hidden">
              <div className="border-b border-rose-500/20 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.3em] text-rose-300/70 mb-2">Bear</p>
                <h3 className="text-2xl font-semibold text-rose-200">What could go wrong</h3>
              </div>
              <div className="p-5 space-y-4">
                {data?.bear_arguments.length ? data.bear_arguments.map(argument => (
                  <article key={argument.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${sourceToneClass(argument.source_type)}`}>
                        {prettySourceType(argument.source_type)}
                      </span>
                      <span className="text-xs text-stone-400">
                        {new Date(argument.as_of_date).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">{argument.title}</h4>
                    <p className="text-sm text-stone-300 mb-4">{argument.summary}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-stone-400">
                        {argument.source_name}{argument.author_handle ? ` - ${argument.author_handle}` : ''}
                      </span>
                      {argument.url && (
                        <a
                          href={argument.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-300 hover:text-rose-200"
                        >
                          Open source
                        </a>
                      )}
                    </div>
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-stone-400">
                    No bearish arguments are stored for this ticker yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/10 px-4 py-3 text-center text-xs text-stone-500">
        Source ingestion is scaffolded for structured external takes. Verify every claim before making investment decisions.
      </footer>
    </div>
  )
}
