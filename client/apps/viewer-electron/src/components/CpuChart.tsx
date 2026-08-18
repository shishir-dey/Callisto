import { useEffect, useState } from 'react'

interface CpuChartProps {
  stats: {
    eventsPerSec: number
    bytesPerSec: number
    dropRate: number
    cpuLoad?: number
  }
}

interface DataPoint {
  timestamp: number
  cpuLoad: number
  eventsPerSec: number
  dropRate: number
}

export function CpuChart({ stats }: CpuChartProps) {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  const maxDataPoints = 60

  useEffect(() => {
    const newPoint: DataPoint = {
      timestamp: Date.now(),
      cpuLoad: stats.cpuLoad ?? 0,
      eventsPerSec: stats.eventsPerSec,
      dropRate: stats.dropRate
    }

    setDataPoints(previous => [...previous, newPoint].slice(-maxDataPoints))
  }, [stats])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const unitSize = 1024
    const units = ['B', 'KB', 'MB', 'GB']
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(unitSize)),
      units.length - 1
    )

    return `${parseFloat((bytes / Math.pow(unitSize, unitIndex)).toFixed(1))} ${units[unitIndex]}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return value.toFixed(0)
  }

  const getBarStatus = (value: number, max: number) => {
    if (value > max * 0.8) return 'critical'
    if (value > max * 0.6) return 'warning'
    return 'healthy'
  }

  const renderMiniChart = (data: number[], max: number) => {
    const visibleData = data.slice(-maxDataPoints)

    return (
      <div className="mini-chart">
        {visibleData.map((value, index) => {
          const barHeight = Math.max(2, Math.min(100, (value / max) * 100))
          const point = dataPoints[dataPoints.length - visibleData.length + index]

          return (
            <div
              className={`mini-chart-bar ${getBarStatus(value, max)}`}
              key={`${point?.timestamp}-${index}`}
              style={{ height: `${barHeight}%` }}
            />
          )
        })}
      </div>
    )
  }

  const eventRateMax = Math.max(
    100,
    Math.max(0, ...dataPoints.map(point => point.eventsPerSec)) * 1.2
  )

  return (
    <section className="cpu-chart" aria-label="Performance monitor">
      <header className="chart-header">
        <div>
          <div className="chart-title">Performance Monitor</div>
          <div className="chart-subtitle">Rolling telemetry overview</div>
        </div>
        <span className="chart-window">Last 60 samples</span>
      </header>

      <div className="performance-grid">
        <div className="stat-item">
          <div className="stat-label">CPU Load</div>
          <div className="stat-value">
            {stats.cpuLoad != null ? `${(stats.cpuLoad * 100).toFixed(1)}%` : 'N/A'}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Events / sec</div>
          <div className="stat-value">{formatNumber(stats.eventsPerSec)}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Throughput</div>
          <div className="stat-value">{formatBytes(stats.bytesPerSec)}<span>/s</span></div>
        </div>
        <div className={`stat-item ${stats.dropRate > 0 ? 'has-alert' : ''}`}>
          <div className="stat-label">Drop Rate</div>
          <div className="stat-value">{(stats.dropRate * 100).toFixed(1)}%</div>
        </div>

        <div className="trend-panel">
          <div className="trend-label"><span>CPU load</span><span>0–100%</span></div>
          {renderMiniChart(dataPoints.map(point => point.cpuLoad * 100), 100)}
        </div>
        <div className="trend-panel">
          <div className="trend-label"><span>Event rate</span><span>events/s</span></div>
          {renderMiniChart(dataPoints.map(point => point.eventsPerSec), eventRateMax)}
        </div>
        <div className="trend-panel">
          <div className="trend-label"><span>Drop rate</span><span>0–10%</span></div>
          {renderMiniChart(dataPoints.map(point => point.dropRate * 100), 10)}
        </div>
      </div>
    </section>
  )
}
