import { useMemo } from 'react'
import { useIsMobile } from '../hooks'
import type { TimelineEvent } from '../api/types'

interface TimelineProps {
  events: TimelineEvent[]
  onEventClick?: (event: TimelineEvent) => void
}

const CARDS_PER_ROW_MOBILE = 2
const CARDS_PER_ROW_DESKTOP = 4

function getFormTone(formType: string) {
  if (formType.includes('10-K') || formType.includes('10-Q')) {
    return {
      badge: 'border-sky-400/20 bg-sky-500/10 text-sky-200',
      accent: 'bg-sky-300/80',
    }
  }

  if (formType.includes('8-K') || formType.includes('DEF 14A')) {
    return {
      badge: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
      accent: 'bg-amber-300/80',
    }
  }

  if (formType === '4') {
    return {
      badge: 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-200',
      accent: 'bg-fuchsia-300/80',
    }
  }

  if (formType === 'PR') {
    return {
      badge: 'border-white/10 bg-white/10 text-stone-100',
      accent: 'bg-stone-200/80',
    }
  }

  return {
    badge: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    accent: 'bg-emerald-300/80',
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function Timeline({ events, onEventClick }: TimelineProps) {
  const isMobile = useIsMobile()
  const cardsPerRow = isMobile ? CARDS_PER_ROW_MOBILE : CARDS_PER_ROW_DESKTOP

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) =>
      new Date(b.filed_date).getTime() - new Date(a.filed_date).getTime()
    )
  }, [events])

  const rows = useMemo(() => {
    const result: TimelineEvent[][] = []
    for (let index = 0; index < sortedEvents.length; index += cardsPerRow) {
      const row = sortedEvents.slice(index, index + cardsPerRow)
      const rowIndex = Math.floor(index / cardsPerRow)
      result.push(!isMobile && rowIndex % 2 === 1 ? [...row].reverse() : row)
    }
    return result
  }, [cardsPerRow, isMobile, sortedEvents])

  if (events.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-6 sm:p-10">
        <div className="max-w-md rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-8 text-center">
          <h3 className="text-xl font-semibold text-white">No filings matched these filters</h3>
          <p className="mt-3 text-sm leading-7 text-stone-400">
            Try changing the selected stock or turning additional form types back on.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-auto px-4 py-5 sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.08),transparent_26%)]" />

      <div className="relative z-10 space-y-3">
        {rows.map((row, rowIndex) => {
          const isReversed = !isMobile && rowIndex % 2 === 1
          const isLastRow = rowIndex === rows.length - 1
          const rowHasFullCards = row.length === cardsPerRow

          return (
            <div key={rowIndex} className="relative">
              {!isMobile && (
                <div
                  className="pointer-events-none absolute top-[92px] h-px bg-gradient-to-r from-sky-300/20 via-white/15 to-amber-300/20"
                  style={{
                    left: isReversed
                      ? rowHasFullCards
                        ? '20px'
                        : `${((cardsPerRow - row.length) / cardsPerRow) * 100}%`
                      : '20px',
                    right: isReversed
                      ? '20px'
                      : rowHasFullCards
                        ? '20px'
                        : `${((cardsPerRow - row.length) / cardsPerRow) * 100}%`,
                  }}
                />
              )}

              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))` }}
              >
                {isReversed && row.length < cardsPerRow &&
                  Array(cardsPerRow - row.length).fill(0).map((_, index) => (
                    <div key={`empty-${rowIndex}-${index}`} />
                  ))}

                {row.map(event => {
                  const tone = getFormTone(event.form_type)
                  return (
                    <button
                      type="button"
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="group relative min-h-[184px] overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950/90 p-4 text-left shadow-[0_20px_60px_-35px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
                    >
                      <div className={`absolute inset-y-5 left-0 w-[3px] rounded-full ${tone.accent}`} />

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                              {event.ticker}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone.badge}`}>
                              {event.form_type === 'PR' ? 'News' : event.form_type}
                            </span>
                          </div>
                          <p className="mt-2 truncate text-xs uppercase tracking-[0.18em] text-stone-500">
                            {event.company_name}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs text-stone-500">
                          {formatDate(event.filed_date)}
                        </span>
                      </div>

                      <p
                        className="mt-4 text-sm leading-7 text-stone-200"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {event.headline || event.form_type_description || 'No summary available for this filing.'}
                      </p>

                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                        <span className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
                          {event.event_type === 'press_release' ? 'Press release' : 'SEC filing'}
                        </span>
                        <span className="text-sm font-medium text-stone-300 transition group-hover:text-white">
                          Open details
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {!isLastRow && !isMobile && (
                <div className="relative h-9">
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-sky-300/20 to-amber-300/20"
                    style={isReversed ? { left: '20px' } : { right: '20px' }}
                  />
                </div>
              )}

              {!isLastRow && isMobile && <div className="h-1" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
