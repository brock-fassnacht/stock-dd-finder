import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useExecComp, useCompanies } from '../hooks'
import { Loading } from '../components'
import type { ExecCompEntry } from '../api/types'

const ROLE_FILTERS = ['CEO', 'CFO', 'COO', 'CLO', 'CTO', 'Other'] as const
type RoleFilter = typeof ROLE_FILTERS[number]

function formatDollars(value: number | null): string {
  if (value == null) return '—'
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function getTotalComp(entry: ExecCompEntry): number | null {
  const cash = (entry.salary ?? 0) + (entry.bonus ?? 0)
  const equity = (entry.stock_awards ?? 0) + (entry.option_awards ?? 0)
  const other = entry.other_compensation ?? 0
  const total = cash + equity + other
  return total > 0 ? total : entry.total_compensation
}

function matchesRole(position: string | null, role: RoleFilter): boolean {
  if (!position) return role === 'Other'
  const p = position.toLowerCase()
  switch (role) {
    case 'CEO': return p.includes('chief executive') || p.includes('ceo')
    case 'CFO': return p.includes('chief financial') || p.includes('cfo')
    case 'COO': return p.includes('chief operating') || p.includes('coo')
    case 'CLO': return p.includes('chief legal') || p.includes('clo') || p.includes('general counsel')
    case 'CTO': return p.includes('chief technology') || p.includes('cto')
    case 'Other': {
      const knownRoles = ['chief executive', 'ceo', 'chief financial', 'cfo', 'chief operating', 'coo', 'chief legal', 'clo', 'general counsel', 'chief technology', 'cto']
      return !knownRoles.some(r => p.includes(r))
    }
  }
}

export default function ExecCompPage() {
  const { data: entries, isLoading, error } = useExecComp()
  const { data: companies } = useCompanies()
  const [tickerFilter, setTickerFilter] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter | ''>('')

  const filtered = useMemo(() => {
    if (!entries) return []
    return entries
      .filter(e => !tickerFilter || e.ticker === tickerFilter)
      .filter(e => !roleFilter || matchesRole(e.position, roleFilter))
      .map(e => ({ ...e, computed_total: getTotalComp(e) }))
      .sort((a, b) => (b.computed_total ?? 0) - (a.computed_total ?? 0))
  }, [entries, tickerFilter, roleFilter])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              TickerClaw
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-base sm:text-xl font-bold text-gray-900">Executive Compensation</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Company filter */}
            <select
              value={tickerFilter}
              onChange={e => setTickerFilter(e.target.value)}
              className="px-2 py-1.5 border rounded text-sm bg-white"
            >
              <option value="">All Companies</option>
              {companies?.map(c => (
                <option key={c.ticker} value={c.ticker}>{c.ticker}</option>
              ))}
            </select>

            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as RoleFilter | '')}
              className="px-2 py-1.5 border rounded text-sm bg-white"
            >
              <option value="">All Roles</option>
              {ROLE_FILTERS.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
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
        ) : !filtered.length ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No compensation data available{tickerFilter || roleFilter ? ' for this filter' : ' yet'}.</p>
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
                {filtered.map((entry, idx) => (
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
                          {formatDollars(entry.computed_total)}
                        </a>
                      ) : (
                        formatDollars(entry.computed_total)
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
