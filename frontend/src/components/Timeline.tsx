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

const TICKER_BORDER: Record<string, string> = {
  ASTS: 'border-blue-500',
  PLTR: 'border-purple-500',
  TSLA: 'border-red-500',
  IREN: 'border-green-500',
}

const TICKER_LINE: Record<string, string> = {
  ASTS: 'bg-blue-500',
  PLTR: 'bg-purple-500',
  TSLA: 'bg-red-500',
  IREN: 'bg-green-500',
}

export function Timeline({ events, onEventClick }: TimelineProps) {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) =>
      new Date(b.filed_date).getTime() - new Date(a.filed_date).getTime()
    )
  }, [events])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    })
  }

  if (events.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
        No filings found. Add companies and fetch filings to get started.
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      {/* Cards area - full height minus timeline bar, horizontally scrollable */}
      <div
        className="absolute top-0 left-0 right-0 overflow-x-auto"
        style={{ bottom: '36px' }}
      >
        <div className="flex gap-2 h-full items-stretch px-2 py-2">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="flex flex-col flex-shrink-0"
              style={{ width: '140px' }}
            >
              {/* Card - grows to fill available space */}
              <a
                href={event.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  flex-1 p-2 bg-white rounded shadow cursor-pointer
                  border-l-2 ${TICKER_BORDER[event.ticker] || 'border-gray-400'}
                  hover:shadow-md transition-shadow
                  flex flex-col overflow-hidden no-underline
                `}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`
                    text-[10px] font-bold px-1.5 py-0.5 rounded text-white
                    ${TICKER_COLORS[event.ticker] || 'bg-gray-500'}
                  `}>
                    {event.ticker}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium">
                    {event.form_type}
                  </span>
                </div>

                {/* Date */}
                <div className="text-[10px] text-gray-400 mb-1">
                  {formatDate(event.filed_date)}
                </div>

                {/* Headline - grows to fill space */}
                <p className="text-xs text-gray-700 leading-tight flex-1 overflow-hidden">
                  {event.headline || event.form_type_description || 'No summary available'}
                </p>
              </a>

              {/* Vertical connector line */}
              <div className={`w-0.5 flex-shrink-0 mx-auto ${TICKER_LINE[event.ticker] || 'bg-gray-400'}`} style={{ height: '12px' }} />

              {/* Dot */}
              <div className={`w-2 h-2 rounded-full mx-auto flex-shrink-0 ${TICKER_COLORS[event.ticker] || 'bg-gray-400'}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline bar - fixed at bottom */}
      <div
        className="absolute left-0 right-0 bg-gray-100 border-t flex items-center px-4"
        style={{ bottom: '0', height: '36px' }}
      >
        {/* Timeline line */}
        <div className="absolute left-4 right-4 top-0 h-0.5 bg-gray-300" />

        {/* Date labels */}
        <div className="relative w-full flex justify-between text-xs text-gray-600 font-medium">
          {sortedEvents.length > 0 && (
            <>
              <span>Newest: {formatDate(sortedEvents[0].filed_date)}</span>
              {sortedEvents.length > 1 && (
                <span>Oldest: {formatDate(sortedEvents[sortedEvents.length - 1].filed_date)}</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
