import type { Company, TimelineResponse, Filing, PriceResponse, TickerSearchResult, SyncStatus, ExecCompEntry } from './types'

function getApiBase(): string {
  // Explicit env var takes priority
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL + '/api'
  }
  // Auto-detect based on hostname
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'tickerclaw.com' || host === 'www.tickerclaw.com') {
      return 'https://api.tickerclaw.com/api'
    }
  }
  // Fallback: production Railway URL (for Vercel previews)
  return 'https://stock-dd-finder-production.up.railway.app/api'
}

const API_BASE = getApiBase()

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }

  return response.json()
}

// Companies
export async function getCompanies(): Promise<Company[]> {
  return fetchJson('/companies')
}

export async function addCompany(ticker: string): Promise<Company> {
  return fetchJson('/companies', {
    method: 'POST',
    body: JSON.stringify({ ticker }),
  })
}

export async function removeCompany(ticker: string): Promise<void> {
  return fetchJson(`/companies/${ticker}`, { method: 'DELETE' })
}

// Filings
export async function getTimeline(params?: {
  ticker?: string
  form_type?: string
  exclude_form_types?: string[]
  start_date?: string
  end_date?: string
  limit?: number
}): Promise<TimelineResponse> {
  const searchParams = new URLSearchParams()
  if (params?.ticker) searchParams.set('ticker', params.ticker)
  if (params?.form_type) searchParams.set('form_type', params.form_type)
  if (params?.exclude_form_types?.length) {
    params.exclude_form_types.forEach(ft => searchParams.append('exclude_form_types', ft))
  }
  if (params?.start_date) searchParams.set('start_date', params.start_date)
  if (params?.end_date) searchParams.set('end_date', params.end_date)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const query = searchParams.toString()
  return fetchJson(`/filings/timeline${query ? `?${query}` : ''}`)
}

export async function getFiling(id: number): Promise<Filing> {
  return fetchJson(`/filings/${id}`)
}

export async function fetchFilings(params?: {
  ticker?: string
  limit?: number
  summarize?: boolean
}): Promise<{ fetched: number; skipped: number; errors: string[] }> {
  const searchParams = new URLSearchParams()
  if (params?.ticker) searchParams.set('ticker', params.ticker)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.summarize !== undefined) searchParams.set('summarize', String(params.summarize))

  const query = searchParams.toString()
  return fetchJson(`/filings/fetch${query ? `?${query}` : ''}`, { method: 'POST' })
}

export async function verifyAdmin(key: string): Promise<boolean> {
  try {
    await fetchJson(`/companies/admin/verify?key=${encodeURIComponent(key)}`, { method: 'POST' })
    return true
  } catch {
    return false
  }
}

export async function logInterest(ticker: string, name: string): Promise<void> {
  return fetchJson(`/companies/interest?ticker=${encodeURIComponent(ticker)}&name=${encodeURIComponent(name)}`, {
    method: 'POST',
  })
}

// Sync
export async function startSync(): Promise<{ message: string }> {
  return fetchJson('/filings/sync', { method: 'POST' })
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return fetchJson('/filings/sync-status')
}

// Ticker search
export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  return fetchJson(`/companies/search?q=${encodeURIComponent(query)}`)
}

// Executive compensation
export async function getExecComp(params?: {
  ticker?: string
}): Promise<ExecCompEntry[]> {
  const searchParams = new URLSearchParams()
  if (params?.ticker) searchParams.set('ticker', params.ticker)
  const query = searchParams.toString()
  return fetchJson(`/exec-comp${query ? `?${query}` : ''}`)
}

// Prices
export async function getPrices(
  ticker: string,
  period: string = '1y'
): Promise<PriceResponse> {
  return fetchJson(`/prices/${ticker}?period=${period}`)
}
