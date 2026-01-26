import { useMemo } from 'react'
import type { TimelineEvent } from '../api/types'

interface TimelineProps {
  events: TimelineEvent[]
  onEventClick?: (event: TimelineEvent) => void
}

const TICKER_COLORS: Record<string, string> = {
  ASTS: 'bg-blue-500',
  PLTR: 'bg-purple-500',
  TSLA: 'bg-red-500',
  IREN: 'bg-green-500',
}

const FORM_COLORS: Record<string, string> = {
  '10-K': 'border-yellow-400',
  '10-Q': 'border-blue-400',
  '8-K': 'border-red-400',
  '4': 'border-gray-400',
  'DEF 14A': 'border-purple-400',
}

export function Timeline({ events, onEventClick }: TimelineProps) {
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {}

    events.forEach(event => {
      const date = new Date(event.filed_date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    })

    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [events])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatMonth = (key: string) => {
    const [year, month] = key.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No filings found. Add companies and fetch filings to get started.
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-full px-4 py-8">
        {/* Timeline line */}
        <div className="relative">
          <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200" />

          {/* Events grouped by month */}
          <div className="flex gap-8">
            {groupedByMonth.map(([monthKey, monthEvents]) => (
              <div key={monthKey} className="flex-shrink-0">
                {/* Month label */}
                <div className="text-sm font-semibold text-gray-600 mb-4 sticky top-0 bg-gray-50 px-2">
                  {formatMonth(monthKey)}
                </div>

                {/* Events in this month */}
                <div className="flex gap-4">
                  {monthEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={`
                        relative flex-shrink-0 w-64 cursor-pointer
                        transition-transform hover:scale-105
                      `}
                    >
                      {/* Dot on timeline */}
                      <div className={`
                        absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full
                        ${TICKER_COLORS[event.ticker] || 'bg-gray-500'}
                        border-2 border-white shadow
                      `} />

                      {/* Card */}
                      <div className={`
                        mt-6 p-3 bg-white rounded-lg shadow-sm
                        border-l-4 ${FORM_COLORS[event.form_type] || 'border-gray-300'}
                        hover:shadow-md transition-shadow
                      `}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`
                            text-xs font-bold px-2 py-0.5 rounded text-white
                            ${TICKER_COLORS[event.ticker] || 'bg-gray-500'}
                          `}>
                            {event.ticker}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(event.filed_date)}
                          </span>
                        </div>

                        {/* Form type */}
                        <div className="text-xs text-gray-600 mb-1">
                          {event.form_type} - {event.form_type_description}
                        </div>

                        {/* Headline */}
                        <p className="text-sm text-gray-800 line-clamp-3">
                          {event.headline || 'No summary available'}
                        </p>

                        {/* View link */}
                        <a
                          href={event.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                        >
                          View Filing
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
