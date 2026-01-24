import { useQuery } from '@tanstack/react-query'
import { getPosts, getPost } from '../api'

export function usePosts(params?: {
  limit?: number
  offset?: number
  subreddit?: string
  author?: string
  min_score?: number
  analyzed_only?: boolean
  sort_by?: string
  sort_order?: string
}) {
  return useQuery({
    queryKey: ['posts', params],
    queryFn: () => getPosts(params),
  })
}

export function usePost(id: number) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id),
    enabled: !!id,
  })
}
