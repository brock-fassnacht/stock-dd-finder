import type {
  AuthSessionResponse,
  BearVsBullArgument,
  BearVsBullResponse,
  Company,
  ExecCompEntry,
  Filing,
  PriceResponse,
  SyncStatus,
  TickerSearchResult,
  TimelineResponse,
  User,
} from './types'

const AUTH_TOKEN_KEY = 'tickerclaw_auth_token'
const ANONYMOUS_VOTER_KEY = 'tickerclaw_anonymous_voter_id'

function getApiBase(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL + '/api'
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'tickerclaw.com' || host === 'www.tickerclaw.com') {
      return 'https://api.tickerclaw.com/api'
    }
  }
  return 'https://stock-dd-finder-production.up.railway.app/api'
}

const API_BASE = getApiBase()

function createAnonymousVoterId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `anon-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStoredAuthToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

export function getAnonymousVoterId(): string | null {
  if (typeof window === 'undefined') return null

  const existing = window.localStorage.getItem(ANONYMOUS_VOTER_KEY)
  if (existing) {
    return existing
  }

  const created = createAnonymousVoterId()
  window.localStorage.setItem(ANONYMOUS_VOTER_KEY, created)
  return created
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredAuthToken()
  const anonymousVoterId = getAnonymousVoterId()
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type') && options?.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (anonymousVoterId && !headers.has('X-Anonymous-Voter-Id')) {
    headers.set('X-Anonymous-Voter-Id', anonymousVoterId)
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

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

export async function startSync(): Promise<{ message: string }> {
  return fetchJson('/filings/sync', { method: 'POST' })
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return fetchJson('/filings/sync-status')
}

export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  return fetchJson(`/companies/search?q=${encodeURIComponent(query)}`)
}

export async function getExecComp(params?: {
  ticker?: string
}): Promise<ExecCompEntry[]> {
  const searchParams = new URLSearchParams()
  if (params?.ticker) searchParams.set('ticker', params.ticker)
  const query = searchParams.toString()
  return fetchJson(`/exec-comp/${query ? `?${query}` : ''}`)
}

export async function getBearVsBull(params?: {
  ticker?: string
}): Promise<BearVsBullResponse> {
  const searchParams = new URLSearchParams()
  if (params?.ticker) searchParams.set('ticker', params.ticker)
  const query = searchParams.toString()
  return fetchJson(`/bear-vs-bull/${query ? `?${query}` : ''}`)
}

export async function createBearVsBullPost(payload: {
  ticker: string
  stance: 'bull' | 'bear'
  title: string
  summary: string
}): Promise<BearVsBullArgument> {
  return fetchJson('/bear-vs-bull/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteBearVsBullPost(postId: number): Promise<{ success: boolean }> {
  return fetchJson(`/bear-vs-bull/posts/${postId}`, {
    method: 'DELETE',
  })
}

export async function voteBearVsBull(
  targetType: 'argument' | 'post',
  targetId: number,
  direction: 'up' | 'down'
): Promise<{ success: boolean }> {
  return fetchJson(`/bear-vs-bull/${targetType}/${targetId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}

export async function registerUser(payload: { email: string; password: string }): Promise<AuthSessionResponse> {
  return fetchJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthSessionResponse> {
  return fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getCurrentUser(): Promise<User> {
  return fetchJson('/auth/me')
}

export async function logoutUser(): Promise<void> {
  return fetchJson('/auth/logout', { method: 'POST' })
}

export async function getPrices(
  ticker: string,
  period: string = '1y'
): Promise<PriceResponse> {
  return fetchJson(`/prices/${ticker}?period=${period}`)
}
