import type { Author, AuthorDetail, PostDetail, Subreddit, Stats } from './types'

const API_BASE = '/api'

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

// Authors
export async function getAuthors(params?: {
  limit?: number
  offset?: number
  min_posts?: number
}): Promise<{ authors: Author[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.min_posts) searchParams.set('min_posts', String(params.min_posts))

  const query = searchParams.toString()
  return fetchJson(`/authors${query ? `?${query}` : ''}`)
}

export async function getAuthor(username: string): Promise<AuthorDetail> {
  return fetchJson(`/authors/${encodeURIComponent(username)}`)
}

// Posts
export async function getPosts(params?: {
  limit?: number
  offset?: number
  subreddit?: string
  author?: string
  min_score?: number
  analyzed_only?: boolean
  sort_by?: string
  sort_order?: string
}): Promise<{ posts: PostDetail[]; total: number }> {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.subreddit) searchParams.set('subreddit', params.subreddit)
  if (params?.author) searchParams.set('author', params.author)
  if (params?.min_score) searchParams.set('min_score', String(params.min_score))
  if (params?.analyzed_only) searchParams.set('analyzed_only', 'true')
  if (params?.sort_by) searchParams.set('sort_by', params.sort_by)
  if (params?.sort_order) searchParams.set('sort_order', params.sort_order)

  const query = searchParams.toString()
  return fetchJson(`/posts${query ? `?${query}` : ''}`)
}

export async function getPost(id: number): Promise<PostDetail> {
  return fetchJson(`/posts/${id}`)
}

// Subreddits
export async function getSubreddits(): Promise<{ subreddits: Subreddit[]; total: number }> {
  return fetchJson('/subreddits')
}

export async function createSubreddit(data: {
  name: string
  display_name: string
  stock_ticker?: string
}): Promise<Subreddit> {
  return fetchJson('/subreddits', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Admin
export async function getStats(): Promise<Stats> {
  return fetchJson('/admin/stats')
}

export async function triggerFetch(params?: {
  subreddit?: string
  limit?: number
  analyze?: boolean
}): Promise<{ message: string }> {
  const searchParams = new URLSearchParams()
  if (params?.subreddit) searchParams.set('subreddit', params.subreddit)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.analyze !== undefined) searchParams.set('analyze', String(params.analyze))

  const query = searchParams.toString()
  return fetchJson(`/admin/fetch${query ? `?${query}` : ''}`, { method: 'POST' })
}
