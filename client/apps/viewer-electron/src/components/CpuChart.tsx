import { useState, useEffect } from 'react'

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
  const maxDataPoints = 60 // Keep 60 seconds of data

  useEffect(() => {
    const now = Date.now()
    const newPoint: DataPoint = {
      timestamp: now,
      cpuLoad: stats.cpuLoad || 0,
      eventsPerSec: stats.eventsPerSec,
      dropRate: stats.dropRate
    }

    setDataPoints(prev => {
      const updated = [...prev, newPoint]
      // Keep only the last maxDataPoints
      return updated.slice(-maxDataPoints)
    })
  }, [stats])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toFixed(0)
  }

  // Simple ASCII-style chart
  const renderMiniChart = (data: number[], max: number, height: number = 20) => {
    if (data.length === 0) return null
    
    const width = Math.min(data.length, 60)
    const bars = data.slice(-width).map((value, index) => {
      const barHeight = Math.max(1, (value / max) * height)
      return (
        <div
          key={index}
          style={{
            width: '2px',
            height: `${barHeight}px`,
            backgroundColor: value > max * 0.8 ? '#ef4444' : value > max * 0.6 ? '#f59e0b' : '#10b981',
            marginRight: '1px',
            alignSelf: 'flex-end'
          }}
        />
      )
    })

    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        height: `${height}px`,
        minWidth: '120px',
        padding: '2px'
      }}>
        {bars}
      </div>
    )
  }

  return (
    <div className="cpu-chart">
      <div className="chart-header">
        <div className="chart-title">Performance Monitor</div>
        <div className="chart-stats">
          <div className="stat-item">
            <div className="stat-value">{stats.cpuLoad ? `${(stats.cpuLoad * 100).toFixed(1)}%` : 'N/A'}</div>
            <div className="stat-label">CPU Load</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{formatNumber(stats.eventsPerSec)}</div>
            <div className="stat-label">Events/sec</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{formatBytes(stats.bytesPerSec)}/s</div>
            <div className="stat-label">Throughput</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: stats.dropRate > 0 ? '#ef4444' : '#10b981' }}>
              {(stats.dropRate * 100).toFixed(1)}%
            </div>
            <div className="stat-label">Drop Rate</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
            CPU Load
          </div>
          {renderMiniChart(
            dataPoints.map(p => p.cpuLoad * 100), 
            100,
            40
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
            Events/sec
          </div>
          {renderMiniChart(
            dataPoints.map(p => p.eventsPerSec), 
            Math.max(100, Math.max(...dataPoints.map(p => p.eventsPerSec)) * 1.2),
            40
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
            Drop Rate %
          </div>
          {renderMiniChart(
            dataPoints.map(p => p.dropRate * 100), 
            10,
            40
          )}
        </div>
      </div>

      {dataPoints.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          color: '#666', 
          fontStyle: 'italic',
          marginTop: '20px'
        }}>
          Waiting for performance data...
        </div>
      )}
    </div>
  )
}