import { useEffect, useRef } from 'react'
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts'
import type { CandlestickData, Time } from 'lightweight-charts'
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
  const dotsContainerRef = useRef<HTMLDivElement>(null)
  const chartCreated = useRef(false)

  useEffect(() => {
    if (chartCreated.current) return
    if (!chartContainerRef.current || candles.length === 0) return

    chartCreated.current = true
    const container = chartContainerRef.current
    const tooltip = tooltipRef.current!
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
      height: window.innerHeight - 180,
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
    const candleDates = new Set(candles.map(c => c.date))
    const seen = new Set<string>()
    const markerInfos: { date: string; color: string; high: number }[] = []
    for (const f of filings) {
      const date = f.filed_date.split('T')[0]
      if (!candleDates.has(date) || seen.has(date)) continue
      seen.add(date)
      markerInfos.push({
        date,
        color: getMarkerColor(f.form_type),
        high: candleHighByDate.get(date) || 0,
      })
    }

    // Create dot DOM elements
    const dotElements: { el: HTMLDivElement; date: string; high: number }[] = []
    for (const info of markerInfos) {
      const dot = document.createElement('div')
      dot.style.cssText = `position:absolute;width:12px;height:12px;border-radius:50%;background:${info.color};pointer-events:none;display:none;transform:translate(-50%,-50%);box-shadow:0 0 6px ${info.color};z-index:6;`
      dotsContainer.appendChild(dot)
      dotElements.push({ el: dot, date: info.date, high: info.high })
    }

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

    // Tooltip on crosshair move
    const markerDatesSet = new Set(markerInfos.map(m => m.date))

    chart.subscribeCrosshairMove(param => {
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
        return `<div style="margin-bottom:6px"><span style="color:${getMarkerColor(f.form_type)};font-weight:bold">${f.form_type}</span> <span style="color:#9ca3af;font-size:11px">${dateStr}</span><br/><span style="color:#e5e7eb">${summary}</span></div>`
      })

      tooltip.innerHTML = lines.join('')
      tooltip.style.display = 'block'

      const point = param.point
      if (point) {
        const tooltipWidth = 320
        const tooltipHeight = tooltip.offsetHeight
        let left = point.x + 16
        let top = point.y - tooltipHeight - 10

        if (left + tooltipWidth > container.clientWidth) {
          left = point.x - tooltipWidth - 16
        }
        if (top < 0) {
          top = point.y + 16
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
        height: window.innerHeight - 180,
      })
      requestAnimationFrame(updateDotPositions)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      dotsContainer.innerHTML = ''
      chartCreated.current = false
    }
  }, [candles, filings])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{ticker} Price Chart</h2>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-gray-400">10-K/10-Q</span>
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
            maxWidth: 320,
            padding: '10px 12px',
            backgroundColor: 'rgba(22, 22, 40, 0.95)',
            border: '1px solid #4b5563',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.4,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        />
      </div>
    </div>
  )
}

function getMarkerColor(formType: string): string {
  if (formType.includes('10-K') || formType.includes('10-Q')) {
    return '#3b82f6'
  }
  if (formType.includes('8-K')) {
    return '#eab308'
  }
  if (formType === '4') {
    return '#a855f7'
  }
  return '#22c55e'
}
