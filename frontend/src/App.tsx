import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTimeline, useCompanies } from './hooks'
import { Timeline, Loading, ErrorMessage } from './components'
import { addCompany, fetchFilings } from './api'
import type { TimelineEvent } from './api/types'

const AVAILABLE_TICKERS = ['ASTS', 'PLTR', 'TSLA', 'IREN']

function App() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<{
    ticker?: string
    form_type?: string
  }>({})
  const [fetching, setFetching] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)

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

            {/* Form type filter */}
            <select
              value={filters.form_type || ''}
              onChange={e => setFilters(f => ({ ...f, form_type: e.target.value || undefined }))}
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="">All Form Types</option>
              <option value="10-K">10-K (Annual)</option>
              <option value="10-Q">10-Q (Quarterly)</option>
              <option value="8-K">8-K (Current)</option>
              <option value="4">Form 4 (Insider)</option>
              <option value="DEF 14A">DEF 14A (Proxy)</option>
            </select>

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
      <main className="flex-1 overflow-hidden">
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
