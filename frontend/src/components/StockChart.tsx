import { useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import type { CandlestickData, Time } from 'lightweight-charts'
import { useIsMobile } from '../hooks'
import type { Candle, TimelineEvent } from '../api/types'

interface StockChartProps {
  ticker: string
  candles: Candle[]
  filings: TimelineEvent[]
  onFilingClick: (filing: TimelineEvent) => void
}

const DOT_OFFSET_PX = 20

export function StockChart({ ticker, candles, filings, onFilingClick: _onFilingClick }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const pinnedTooltipRef = useRef<HTMLDivElement>(null)
  const dotsContainerRef = useRef<HTMLDivElement>(null)
  const chartCreated = useRef(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (chartCreated.current) return
    if (!chartContainerRef.current || candles.length === 0) return

    chartCreated.current = true
    const container = chartContainerRef.current
    const tooltip = tooltipRef.current!
    const pinnedTooltip = pinnedTooltipRef.current!
    const dotsContainer = dotsContainerRef.current!

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a2e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2d2d44' },
        horzLines: { color: '#2d2d44' },
      },
      width: container.clientWidth,
      height: window.innerHeight - (isMobile ? 220 : 180),
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#4b5563',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#4b5563',
      },
    })

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    })

    const chartData: CandlestickData<Time>[] = candles
      .map(c => ({
        time: c.date as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      .sort((a, b) => (a.time as string).localeCompare(b.time as string))
    series.setData(chartData)

    // Build filing lookup by date and candle high by date
    const filingsByDate = new Map<string, TimelineEvent[]>()
    for (const f of filings) {
      const date = f.filed_date.split('T')[0]
      if (!filingsByDate.has(date)) filingsByDate.set(date, [])
      filingsByDate.get(date)!.push(f)
    }

    const candleHighByDate = new Map<string, number>()
    for (const c of candles) {
      candleHighByDate.set(c.date, c.high)
    }

    // Find which filing dates have matching candles
    // Use highest-priority filing type for dot color: 10-K > 10-Q > 8-K > other > Form 4
    const candleDates = new Set(candles.map(c => c.date))
    const bestByDate = new Map<string, { priority: number; formType: string }>()
    for (const f of filings) {
      const date = f.filed_date.split('T')[0]
      if (!candleDates.has(date)) continue
      const priority = getFormTypePriority(f.form_type)
      const existing = bestByDate.get(date)
      if (!existing || priority > existing.priority) {
        bestByDate.set(date, { priority, formType: f.form_type })
      }
    }
    const markerInfos: { date: string; color: string; high: number }[] = []
    for (const [date, info] of bestByDate) {
      markerInfos.push({
        date,
        color: getMarkerColor(info.formType),
        high: candleHighByDate.get(date) || 0,
      })
    }

    // Create dot DOM elements (visual only, clicks handled via chart)
    let pinnedDate: string | null = null
    const dotElements: { el: HTMLDivElement; date: string; high: number }[] = []
    for (const info of markerInfos) {
      const dot = document.createElement('div')
      const dotSize = isMobile ? 18 : 12
      dot.style.cssText = `position:absolute;width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${info.color};pointer-events:none;display:none;transform:translate(-50%,-50%);box-shadow:0 0 6px ${info.color};z-index:6;`
      dotsContainer.appendChild(dot)
      dotElements.push({ el: dot, date: info.date, high: info.high })
    }

    // Show pinned tooltip for a given date
    function showPinnedTooltip(dateStr: string, clickX: number, clickY: number) {
      const dayFilings = filingsByDate.get(dateStr)
      if (!dayFilings?.length) return

      // Toggle off if same date clicked
      if (pinnedDate === dateStr) {
        pinnedDate = null
        pinnedTooltip.style.display = 'none'
        return
      }

      pinnedDate = dateStr
      const lines = dayFilings.map((f, i) => {
        const summary = f.headline || 'No summary available'
        const closeBtn = i === 0 ? `<button id="pinned-close" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 8px;float:right;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#9ca3af'">&times;</button>` : ''
        return `<div style="margin-bottom:8px">${closeBtn}<a href="${f.document_url}" target="_blank" rel="noopener noreferrer" style="color:${getMarkerColor(f.form_type)};font-weight:bold;font-size:14px;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${f.form_type} — ${dateStr}</a><br/><span style="color:#e5e7eb">${summary}</span></div>`
      })

      pinnedTooltip.innerHTML = lines.join('')
      pinnedTooltip.style.maxHeight = ''
      pinnedTooltip.style.overflowY = ''
      pinnedTooltip.style.display = 'block'

      if (isMobile) {
        // Full-width pinned tooltip at bottom of chart
        pinnedTooltip.style.left = '0'
        pinnedTooltip.style.right = '0'
        pinnedTooltip.style.bottom = '0'
        pinnedTooltip.style.top = ''
        pinnedTooltip.style.maxWidth = 'none'
        pinnedTooltip.style.maxHeight = Math.floor(container.clientHeight * 0.4) + 'px'
        pinnedTooltip.style.overflowY = 'auto'
        pinnedTooltip.style.borderRadius = '8px 8px 0 0'
      } else {
        // Desktop: floating beside click point
        pinnedTooltip.style.right = ''
        pinnedTooltip.style.bottom = ''
        pinnedTooltip.style.maxWidth = ''
        pinnedTooltip.style.borderRadius = '8px'
        const tooltipWidth = 320
        const naturalHeight = pinnedTooltip.offsetHeight
        const containerHeight = container.clientHeight
        let left = clickX + 16
        let top = clickY - (naturalHeight / 2)

        if (left + tooltipWidth > container.clientWidth) {
          left = clickX - tooltipWidth - 16
        }
        // Clamp within chart bounds
        if (top < 0) top = 0
        if (top + naturalHeight > containerHeight) {
          top = containerHeight - naturalHeight
          if (top < 0) top = 0
        }

        // If tooltip is taller than available space, cap it with scroll
        const availableHeight = containerHeight - top - 12
        if (naturalHeight > availableHeight) {
          pinnedTooltip.style.maxHeight = availableHeight + 'px'
          pinnedTooltip.style.overflowY = 'auto'
        }

        pinnedTooltip.style.left = left + 'px'
        pinnedTooltip.style.top = top + 'px'
      }

      // Attach close handler
      const closeBtn = pinnedTooltip.querySelector('#pinned-close')
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        pinnedDate = null
        pinnedTooltip.style.display = 'none'
      })
    }

    // Set of dates with filing markers
    const markerDatesSet = new Set(markerInfos.map(m => m.date))

    // Handle clicks on the chart
    chart.subscribeClick(param => {
      // Click on a filing date — show/toggle pinned tooltip
      if (param.time && markerDatesSet.has(param.time as string)) {
        const point = param.point
        if (point) {
          showPinnedTooltip(param.time as string, point.x, point.y)
        }
        return
      }

      // Click anywhere else — dismiss pinned tooltip
      if (pinnedDate) {
        pinnedDate = null
        pinnedTooltip.style.display = 'none'
      }
    })

    // Position dots based on chart coordinates
    function updateDotPositions() {
      const timeScale = chart.timeScale()
      for (const dot of dotElements) {
        const x = timeScale.timeToCoordinate(dot.date as Time)
        const y = series.priceToCoordinate(dot.high)
        if (x === null || y === null) {
          dot.el.style.display = 'none'
          continue
        }
        dot.el.style.display = 'block'
        dot.el.style.left = x + 'px'
        dot.el.style.top = (y - DOT_OFFSET_PX) + 'px'
      }
    }

    // Update dots when chart scrolls/zooms or after initial render
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateDotPositions)
    requestAnimationFrame(updateDotPositions)

    // Tooltip on crosshair move (desktop only — useless on touch)
    if (!isMobile) chart.subscribeCrosshairMove(param => {
      // Hide hover tooltip if a pinned tooltip is showing
      if (pinnedDate) {
        tooltip.style.display = 'none'
        return
      }

      if (!param.time || !markerDatesSet.has(param.time as string)) {
        tooltip.style.display = 'none'
        return
      }

      const dateStr = param.time as string
      const dayFilings = filingsByDate.get(dateStr)
      if (!dayFilings?.length) {
        tooltip.style.display = 'none'
        return
      }

      const lines = dayFilings.map(f => {
        const summary = f.headline || 'No summary available'
        return `<div style="margin-bottom:8px"><span style="color:${getMarkerColor(f.form_type)};font-weight:bold;font-size:14px;">${f.form_type} — ${dateStr}</span><br/><span style="color:#e5e7eb">${summary}</span></div>`
      })

      tooltip.innerHTML = lines.join('')
      tooltip.style.display = 'block'

      const point = param.point
      if (point) {
        const tooltipWidth = 320
        const tooltipHeight = tooltip.offsetHeight
        let left = point.x + 16
        let top = point.y - (tooltipHeight / 2)

        if (left + tooltipWidth > container.clientWidth) {
          left = point.x - tooltipWidth - 16
        }
        if (top < 0) top = 0
        if (top + tooltipHeight > container.clientHeight) {
          top = container.clientHeight - tooltipHeight
        }

        tooltip.style.left = left + 'px'
        tooltip.style.top = top + 'px'
      }
    })

    chart.timeScale().fitContent()
    // Need to wait for fitContent to finish rendering before positioning dots
    setTimeout(updateDotPositions, 50)
    setTimeout(updateDotPositions, 200)

    const handleResize = () => {
      chart.applyOptions({
        width: container.clientWidth,
        height: window.innerHeight - (window.innerWidth < 640 ? 220 : 180),
      })
      requestAnimationFrame(updateDotPositions)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      dotsContainer.innerHTML = ''
      pinnedTooltip.style.display = 'none'
      pinnedTooltip.innerHTML = ''
      chartCreated.current = false
    }
  }, [candles, filings])

  return (
    <div>
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-xl font-bold text-white">{ticker} Price Chart</h2>
        <div className="flex items-center gap-x-4 gap-y-1 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-gray-400">10-K / 10-Q</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-gray-400">8-K</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            <span className="text-gray-400">Form 4</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-400">DEF 14A</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-400">S-1</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></span>
            <span className="text-gray-400">News</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-400">Other</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
        <div
          ref={dotsContainerRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}
        />
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'absolute',
            zIndex: 10,
            maxWidth: Math.min(320, (typeof window !== 'undefined' ? window.innerWidth : 320) - 24),
            padding: '10px 12px',
            backgroundColor: 'rgba(22, 22, 40, 0.97)',
            border: '1px solid #4b5563',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.4,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        />
        <div
          ref={pinnedTooltipRef}
          className="dark-scrollbar"
          style={{
            display: 'none',
            position: 'absolute',
            zIndex: 50,
            maxWidth: 320,
            padding: '10px 12px',
            backgroundColor: 'rgba(22, 22, 40, 0.97)',
            border: '1px solid #4b5563',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.4,
            pointerEvents: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  )
}

function getFormTypePriority(formType: string): number {
  if (formType.includes('10-K')) return 5
  if (formType.includes('10-Q')) return 4
  if (formType.includes('8-K')) return 3
  if (formType === 'PR') return 2
  if (formType === '4') return 1
  return 2
}

function getMarkerColor(formType: string): string {
  if (formType.includes('10-K')) return '#3b82f6'
  if (formType.includes('10-Q')) return '#3b82f6'
  if (formType.includes('8-K')) return '#eab308'
  if (formType === '4') return '#a855f7'
  if (formType === 'PR') return '#f97316'
  return '#22c55e'
}
