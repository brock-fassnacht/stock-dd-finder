import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <svg className="w-8 h-8 text-red-500" viewBox="0 0 64 64" fill="currentColor">
              <path d="M12 48c0-4 2-12 6-18l-8-14c-1-2 0-4 2-4h4l6 10c4-4 9-7 14-8V6c0-2 2-4 4-2l2 4v8c5 1 10 4 14 8l6-10h4c2 0 3 2 2 4l-8 14c4 6 6 14 6 18" />
              <path d="M20 44c-2-8 2-16 12-20M44 44c2-8-2-16-12-20" strokeWidth="2" stroke="currentColor" fill="none" />
              <circle cx="26" cy="32" r="2" />
              <circle cx="38" cy="32" r="2" />
            </svg>
            TickerClaw
          </h1>
        </div>
      </header>

      <main className="flex-1 px-6 pb-12 pt-4 sm:pt-8">
        <div className="max-w-6xl mx-auto">
          <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.25fr] gap-6 items-stretch">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900 via-gray-900 to-red-950/40 p-8 sm:p-10 flex flex-col justify-between min-h-[520px]">
              <div>
                <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5 max-w-xl">
                  We are going to claw all the research together so you don't have to.
                </h2>
                <p className="text-lg text-gray-400 max-w-xl">
                  Jump from market narratives to filings and executive pay without bouncing between ten different tabs and tools.
                </p>
              </div>

              <div className="mt-8 space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-300">
                  Debate, filings, and compensation in one place.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-300">
                  Built to make stock research faster and easier to explain.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 min-h-[520px]">
              <Link
                to="/bear-vs-bull"
                className="group bg-gradient-to-br from-amber-950 via-gray-800 to-emerald-950 border border-gray-700 rounded-3xl p-8 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/10 transition-all min-h-[320px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="text-amber-300">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17l4-4 4 4 10-10" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h6v6" />
                      </svg>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-gray-400">Featured Tool</span>
                  </div>

                  <h3 className="text-3xl sm:text-4xl font-semibold text-white mb-4 group-hover:text-amber-200 transition-colors">
                    Bear vs Bull
                  </h3>
                  <blockquote className="border-l-2 border-amber-400/60 pl-4 text-sm sm:text-base italic text-amber-100/90 max-w-3xl mb-5">
                    "if you can't explain to a ten-year-old in two minutes or less why you own a stock, you shouldn't own it" - Peter Lynch
                  </blockquote>
                  <p className="text-base sm:text-lg text-gray-300 max-w-2xl">
                    Pick any tracked stock and compare the strongest bullish and bearish takes side by side from market conversations and research sources.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3 text-sm text-gray-300">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Ticker filter</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Bull case</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Bear case</span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Source tracking</span>
                </div>
              </Link>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Link
                  to="/sec-timeline"
                  className="group bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-blue-500 hover:bg-gray-800/80 transition-all sm:min-h-[170px]"
                >
                  <div className="text-blue-400 mb-3">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    SEC Filings Timeline
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Browse 10-K, 10-Q, 8-K, proxy statements, and insider trades with AI-generated summaries.
                  </p>
                </Link>

                <Link
                  to="/executive-comp"
                  className="group bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-green-500 hover:bg-gray-800/80 transition-all sm:min-h-[170px]"
                >
                  <div className="text-green-400 mb-3">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-green-400 transition-colors">
                    Executive Compensation
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Compare top executive pay across companies from their most recent DEF 14A proxy filings.
                  </p>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-gray-600 text-xs">
        Data sourced from SEC EDGAR. Summaries are AI-generated.
      </footer>
    </div>
  )
}
