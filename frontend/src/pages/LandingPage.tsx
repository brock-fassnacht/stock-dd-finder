import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="px-6 py-4">
        <h1 className="text-2xl font-bold text-white">TickerClaw</h1>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        <h2 className="text-4xl sm:text-5xl font-bold text-white text-center mb-4">
          SEC Filings, Simplified
        </h2>
        <p className="text-lg text-gray-400 text-center max-w-xl mb-12">
          Track SEC filings, insider trades, and executive compensation for the companies you follow — all in one place.
        </p>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          <Link
            to="/sec-timeline"
            className="group bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 hover:bg-gray-800/80 transition-all"
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
            className="group bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-green-500 hover:bg-gray-800/80 transition-all"
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
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-gray-600 text-xs">
        Data sourced from SEC EDGAR. Summaries are AI-generated.
      </footer>
    </div>
  )
}
