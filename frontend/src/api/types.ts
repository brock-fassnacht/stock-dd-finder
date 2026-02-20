export interface Company {
  id: number
  ticker: string
  name: string
  cik: string
  created_at: string
}

export interface TimelineEvent {
  id: number
  ticker: string
  company_name: string
  form_type: string
  form_type_description: string
  filed_date: string
  headline: string | null
  document_url: string
  event_type: 'filing' | 'press_release'
}

export interface TimelineResponse {
  events: TimelineEvent[]
  total: number
}

export interface Filing {
  id: number
  company_id: number
  accession_number: string
  form_type: string
  form_type_description: string
  filed_date: string
  document_url: string
  headline: string | null
  summary: string | null
  created_at: string
  company_ticker: string
  company_name: string
}

export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PriceResponse {
  ticker: string
  candles: Candle[]
}

export interface TickerSearchResult {
  ticker: string
  cik: string
  name: string
}

export interface SyncStatus {
  running: boolean
  fetched: number
  skipped: number
  errors: string[]
  current: string | null
  message: string
  started_at: string | null
  completed_at: string | null
}
