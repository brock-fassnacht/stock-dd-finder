import { useQuery } from '@tanstack/react-query'
import { getStats, getSubreddits } from '../api'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  })
}

export function useSubreddits() {
  return useQuery({
    queryKey: ['subreddits'],
    queryFn: getSubreddits,
  })
}
