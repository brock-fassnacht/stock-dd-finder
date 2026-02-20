import { Link } from 'react-router-dom'
import { useExecComp } from '../hooks'
import { Loading } from '../components'

function formatDollars(value: number | null): string {
  if (value == null) return '—'
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function ExecCompPage() {
  const { data: entries, isLoading, error } = useExecComp()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            TickerClaw
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-base sm:text-xl font-bold text-gray-900">Executive Compensation</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6">
        {isLoading ? (
          <Loading />
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            Failed to load compensation data.
          </div>
        ) : !entries?.length ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No compensation data available yet.</p>
            <p className="text-sm">Data is extracted from DEF 14A proxy filings for tracked companies.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white border rounded-lg overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Company</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Position</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700">Compensation</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-700">Year Filed</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={`border-b last:border-b-0 hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-sm text-blue-700">{entry.ticker}</span>
                      <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{entry.company_name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{entry.executive_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.position || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {entry.document_url ? (
                        <a
                          href={entry.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:underline"
                          title="View source filing"
                        >
                          {formatDollars(entry.total_compensation)}
                        </a>
                      ) : (
                        formatDollars(entry.total_compensation)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {entry.fiscal_year || new Date(entry.filed_date).getFullYear()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t px-4 py-2 text-center text-xs text-gray-400">
        Data extracted by AI from SEC DEF 14A proxy filings. Verify with original documents.
      </footer>
    </div>
  )
}
