import { useState, useEffect } from 'react'
import { Toolbar } from './components/Toolbar'
import { Timeline } from './components/Timeline'
import { CpuChart } from './components/CpuChart'
import { WebSocketManager } from './services/WebSocketManager'
import './App.css'

interface AppState {
  connected: boolean
  tracing: boolean
  serverVersion?: string
  events: any[]
  stats: {
    eventsPerSec: number
    bytesPerSec: number
    dropRate: number
    cpuLoad?: number
  }
}

function App() {
  const [state, setState] = useState<AppState>({
    connected: false,
    tracing: false,
    events: [],
    stats: {
      eventsPerSec: 0,
      bytesPerSec: 0,
      dropRate: 0,
    }
  })

  const [wsManager] = useState(() => new WebSocketManager())

  useEffect(() => {
    // Set up WebSocket event handlers
    wsManager.onMessage = (message) => {
      console.log('Received message:', message)
      
      switch (message.type) {
        case 'Hello':
          setState(prev => ({
            ...prev,
            connected: true,
            serverVersion: message.data.version
          }))
          break
          
        case 'Event':
          setState(prev => ({
            ...prev,
            events: [...prev.events.slice(-999), message.data] // Keep last 1000 events
          }))
          break
          
        case 'Stats':
          setState(prev => ({
            ...prev,
            stats: {
              eventsPerSec: message.data.events_per_sec,
              bytesPerSec: message.data.bytes_per_sec,
              dropRate: message.data.drop_rate,
              cpuLoad: message.data.cpu_load
            }
          }))
          break
          
        case 'Status':
          setState(prev => ({
            ...prev,
            connected: message.data.connected
          }))
          break
      }
    }

    wsManager.onConnectionChange = (connected) => {
      setState(prev => ({ ...prev, connected }))
    }

    // Connect to WebSocket
    wsManager.connect('ws://127.0.0.1:9229/ws')

    return () => {
      wsManager.disconnect()
    }
  }, [wsManager])

  const handleConnect = () => {
    wsManager.send({
      type: 'Connect',
      data: {
        probe_selector: null,
        chip: null,
        token: null
      }
    })
  }

  const handleStartTracing = () => {
    wsManager.send({
      type: 'Start',
      data: {
        allow_mask: 0xFFFFFFFF, // Enable all ports
        baud_rate: 2000000
      }
    })
    setState(prev => ({ ...prev, tracing: true }))
  }

  const handleStopTracing = () => {
    wsManager.send({
      type: 'Stop'
    })
    setState(prev => ({ ...prev, tracing: false }))
  }

  return (
    <div className="app">
      <Toolbar
        connected={state.connected}
        tracing={state.tracing}
        serverVersion={state.serverVersion}
        onConnect={handleConnect}
        onStartTracing={handleStartTracing}
        onStopTracing={handleStopTracing}
      />
      
      <div className="main-content">
        <div className="timeline-container">
          <Timeline events={state.events} />
        </div>
        
        <div className="bottom-panel">
          <CpuChart stats={state.stats} />
        </div>
      </div>
    </div>
  )
}

export default App