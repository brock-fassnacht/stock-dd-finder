import { Link } from 'react-router-dom'
import { useCompanies } from '../hooks'
import { Loading } from '../components'

export default function Top25Page() {
  const { data: companies, isLoading, error } = useCompanies()
  const topCompanies = companies?.slice(0, 25) ?? []

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col">
      <header className="border-b border-white/10 bg-stone-950/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1.5">
              <svg className="w-5 h-5 text-red-400" viewBox="0 0 64 64" fill="currentColor">
                <path d="M12 48c0-4 2-12 6-18l-8-14c-1-2 0-4 2-4h4l6 10c4-4 9-7 14-8V6c0-2 2-4 4-2l2 4v8c5 1 10 4 14 8l6-10h4c2 0 3 2 2 4l-8 14c4 6 6 14 6 18" />
                <path d="M20 44c-2-8 2-16 12-20M44 44c2-8-2-16-12-20" strokeWidth="2" stroke="currentColor" fill="none" />
                <circle cx="26" cy="32" r="2" />
                <circle cx="38" cy="32" r="2" />
              </svg>
              Back to TickerClaw
            </Link>
            <span className="text-white/20">|</span>
            <h1 className="text-base sm:text-xl font-bold">Top 25</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-stone-900 via-stone-900 to-red-950/40 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.32em] text-stone-400">Tracked List</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold">TickerClaw Top 25</h2>
            <p className="mt-4 max-w-3xl text-sm sm:text-base leading-7 text-stone-300">
              This page currently pulls from the securities managed in the admin panel on the SEC Filings Timeline page.
              Update that tracked list there, and this page updates automatically.
            </p>
          </section>

          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
            {isLoading ? (
              <Loading />
            ) : error ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-5 text-rose-200">
                Failed to load the Top 25 list.
              </div>
            ) : !topCompanies.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-stone-400">
                No tracked companies yet. Add securities from the admin panel on the SEC Filings Timeline page to build this list.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10">
                <div className="grid grid-cols-[72px_minmax(0,1fr)] border-b border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.24em] text-stone-400 sm:grid-cols-[88px_160px_minmax(0,1fr)]">
                  <div>Rank</div>
                  <div className="hidden sm:block">Ticker</div>
                  <div>Company</div>
                </div>

                {topCompanies.map((company, index) => (
                  <div
                    key={company.ticker}
                    className="grid grid-cols-[72px_minmax(0,1fr)] items-center border-b border-white/10 px-4 py-4 last:border-b-0 sm:grid-cols-[88px_160px_minmax(0,1fr)]"
                  >
                    <div className="text-lg font-semibold text-amber-200">#{index + 1}</div>
                    <div className="hidden sm:block">
                      <span className="inline-flex rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 font-mono text-sm font-semibold text-amber-100">
                        {company.ticker}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="sm:hidden">
                        <span className="inline-flex rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-amber-100">
                          {company.ticker}
                        </span>
                      </div>
                      <div className="mt-2 text-sm sm:mt-0 sm:text-base text-white">{company.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
