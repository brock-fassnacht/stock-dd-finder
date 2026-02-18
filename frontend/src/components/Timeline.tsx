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

const CARDS_PER_ROW = 5

function getFormTypeColor(formType: string): string {
  if (formType.includes('10-K')) return '#3b82f6'
  if (formType.includes('10-Q')) return '#3b82f6'
  if (formType.includes('8-K')) return '#eab308'
  if (formType === '4') return '#a855f7'
  return '#22c55e'
}

export function Timeline({ events, onEventClick: _onEventClick }: TimelineProps) {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) =>
      new Date(b.filed_date).getTime() - new Date(a.filed_date).getTime()
    )
  }, [events])

  // Group events into rows
  const rows = useMemo(() => {
    const result: TimelineEvent[][] = []
    for (let i = 0; i < sortedEvents.length; i += CARDS_PER_ROW) {
      const row = sortedEvents.slice(i, i + CARDS_PER_ROW)
      // Reverse every other row for snake pattern
      const rowIndex = Math.floor(i / CARDS_PER_ROW)
      result.push(rowIndex % 2 === 1 ? [...row].reverse() : row)
    }
    return result
  }, [sortedEvents])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (events.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-900">
        No filings found. Add companies and fetch filings to get started.
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-auto p-4 bg-gray-900">
      {/* Animated gradient line style */}
      <style>{`
        @keyframes flowRight {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes flowLeft {
          0% { background-position: 200% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes flowDown {
          0% { background-position: 50% 0%; }
          100% { background-position: 50% 200%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        .snake-line-h {
          background: linear-gradient(90deg, #06b6d4, #22d3ee, #a855f7, #ec4899, #06b6d4);
          background-size: 200% 100%;
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.6), 0 0 40px rgba(168, 85, 247, 0.4);
          animation: pulse 2s ease-in-out infinite;
        }
        .snake-line-h-right {
          animation: flowRight 1.5s linear infinite, pulse 2s ease-in-out infinite;
        }
        .snake-line-h-left {
          animation: flowLeft 1.5s linear infinite, pulse 2s ease-in-out infinite;
        }
        .snake-line-v {
          background: linear-gradient(180deg, #06b6d4, #22d3ee, #a855f7, #ec4899, #06b6d4);
          background-size: 100% 200%;
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.6), 0 0 40px rgba(168, 85, 247, 0.4);
          animation: flowDown 1.5s linear infinite, pulse 2s ease-in-out infinite;
        }
        .timeline-row:has(.timeline-card-wrapper:hover) {
          z-index: 100;
        }
        .timeline-card-wrapper {
          position: relative;
          z-index: 1;
        }
        .timeline-card-wrapper:hover {
          z-index: 100;
        }
        .timeline-card {
          transition: background-color 0.2s ease-out, box-shadow 0.2s ease-out;
        }
        .timeline-card .card-content {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .timeline-card-wrapper:hover .timeline-card {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        .timeline-card-wrapper:hover .timeline-card .card-content {
          display: block;
          -webkit-line-clamp: unset;
          overflow: visible;
          max-height: 300px;
          overflow-y: auto;
        }
      `}</style>

      {rows.map((row, rowIndex) => {
        const isReversed = rowIndex % 2 === 1
        const isLastRow = rowIndex === rows.length - 1
        const rowHasFullCards = row.length === CARDS_PER_ROW

        return (
          <div key={rowIndex} className="timeline-row relative">
            {/* Horizontal snake line behind cards */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 h-2 rounded-full snake-line-h ${isReversed ? 'snake-line-h-left' : 'snake-line-h-right'}`}
              style={{
                left: isReversed ? (rowHasFullCards ? '12px' : `${((CARDS_PER_ROW - row.length) / CARDS_PER_ROW) * 100}%`) : '12px',
                right: isReversed ? '12px' : (rowHasFullCards ? '12px' : `${((CARDS_PER_ROW - row.length) / CARDS_PER_ROW) * 100}%`),
              }}
            />

            {/* Row of cards */}
            <div
              className="grid gap-3 mb-0 relative z-10"
              style={{ gridTemplateColumns: `repeat(${CARDS_PER_ROW}, 1fr)` }}
            >
              {/* Fill empty slots at START for reversed rows to maintain alignment */}
              {isReversed && row.length < CARDS_PER_ROW &&
                Array(CARDS_PER_ROW - row.length).fill(0).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))
              }

              {row.map((event) => (
                <div key={event.id} className="timeline-card-wrapper" style={{ minHeight: '150px' }}>
                  <a
                    href={event.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      timeline-card p-3 rounded-lg shadow-lg cursor-pointer
                      border-l-4 ${TICKER_BORDER[event.ticker] || 'border-gray-600'}
                      flex flex-col no-underline
                    `}
                    style={{ backgroundColor: 'rgb(31, 41, 55)', minHeight: '150px' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(75, 85, 99)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(31, 41, 55)'}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`
                        text-[11px] font-bold px-1.5 py-0.5 rounded text-white
                        ${TICKER_COLORS[event.ticker] || 'bg-gray-500'}
                      `}>
                        {event.ticker}
                      </span>
                      <span
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: getFormTypeColor(event.form_type) }}
                      >
                        {event.form_type}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="text-[11px] text-gray-500 mb-1">
                      {formatDate(event.filed_date)}
                    </div>

                    {/* Headline */}
                    <p className="card-content text-sm text-gray-300 leading-snug">
                      {event.headline || event.form_type_description || 'No summary'}
                    </p>
                  </a>
                </div>
              ))}
            </div>

            {/* Vertical connector to next row */}
            {!isLastRow && (
              <div
                className="relative"
                style={{ height: '28px' }}
              >
                {/* Vertical line on the turn side */}
                <div
                  className="absolute w-2 rounded-full snake-line-v"
                  style={{
                    top: 0,
                    bottom: 0,
                    [isReversed ? 'left' : 'right']: '12px',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Buffer + Disclaimer */}
      <div className="pt-16 pb-8 text-center">
        <p className="text-xs text-gray-500">
          These summaries are AI-generated. Please refer to the original filings at{' '}
          <a href="https://www.sec.gov/edgar/searchedgar/companysearch" target="_blank" rel="noopener noreferrer" className="text-gray-400 underline hover:text-gray-300">
            SEC.gov
          </a>{' '}
          for complete information.
        </p>
      </div>
    </div>
  )
}
