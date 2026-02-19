import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCompanies, getTimeline, getFiling, getPrices, searchTickers } from '../api'

const MOBILE_BREAKPOINT = 640

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies,
  })
}

export function useTimeline(params?: {
  ticker?: string
  form_type?: string
  exclude_form_types?: string[]
  start_date?: string
  end_date?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['timeline', params],
    queryFn: () => getTimeline(params),
  })
}

export function useFiling(id: number) {
  return useQuery({
    queryKey: ['filing', id],
    queryFn: () => getFiling(id),
    enabled: !!id,
  })
}

export function useTickerSearch(query: string) {
  return useQuery({
    queryKey: ['tickerSearch', query],
    queryFn: () => searchTickers(query),
    enabled: query.length >= 1,
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
  })
}

export function usePrices(ticker: string | undefined, period: string = '1y') {
  return useQuery({
    queryKey: ['prices', ticker, period],
    queryFn: () => getPrices(ticker!, period),
    enabled: !!ticker,
  })
}
