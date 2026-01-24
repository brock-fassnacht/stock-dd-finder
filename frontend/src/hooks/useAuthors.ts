import { useQuery } from '@tanstack/react-query'
import { getAuthors, getAuthor } from '../api'

export function useAuthors(params?: {
  limit?: number
  offset?: number
  min_posts?: number
}) {
  return useQuery({
    queryKey: ['authors', params],
    queryFn: () => getAuthors(params),
  })
}

export function useAuthor(username: string) {
  return useQuery({
    queryKey: ['author', username],
    queryFn: () => getAuthor(username),
    enabled: !!username,
  })
}
