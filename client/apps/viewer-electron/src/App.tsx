import { useEffect, useState } from 'react'
import { Cable, Cpu, RefreshCw, X } from 'lucide-react'
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

interface Device {
  id: string
  name: string
  type: 'mock' | 'real'
}

interface DeviceSelectionModalProps {
  isOpen: boolean
  devices: Device[]
  selectedDevice: Device | null
  loading: boolean
  onSelect: (device: Device) => void
  onClose: () => void
  onRefresh: () => void
}

function DeviceSelectionModal({ isOpen, devices, selectedDevice, loading, onSelect, onClose, onRefresh }: DeviceSelectionModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <div className="device-modal" role="dialog" aria-modal="true" aria-labelledby="device-modal-title">
        <div className="modal-header">
          <div>
            <h2 id="device-modal-title">Select a device</h2>
            <p>Choose the trace source you want Callisto to monitor.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close device selection">
            <X size={17} />
          </button>
        </div>

        <div className="device-list">
          {loading ? (
            <div className="device-loading">
              <RefreshCw className="spin" size={18} />
              Scanning for devices…
            </div>
          ) : (
            (() => {
              const realDevices = devices.filter(d => d.type === 'real')
              const hasRealProbes = realDevices.length > 0
              
              // If no real probes, show mock + disabled "Hardware Probes" option
              const displayDevices = hasRealProbes ? devices : [
                ...devices.filter(d => d.type === 'mock'),
                { id: 'no-probes', name: 'Hardware Probes', type: 'real' as const }
              ]
              
              return displayDevices.map(device => {
                const isRealDevice = device.type === 'real'
                const isDisabled = isRealDevice && !hasRealProbes
                
                return (
                  <button
                    type="button"
                    key={device.id}
                    onClick={() => !isDisabled && onSelect(device)}
                    disabled={isDisabled}
                    className={`device-option ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                  >
                    <span className="device-option-icon">
                      {device.type === 'mock' ? <Cpu size={19} /> : <Cable size={19} />}
                    </span>
                    <span className="device-option-copy">
                      <strong>{device.name}</strong>
                      <small>
                        {device.type === 'mock' ? 'Simulated trace data' :
                         isDisabled ? 'No hardware probes available' : 'Connected hardware probe'}
                      </small>
                    </span>
                    <span className="selection-ring" aria-hidden="true" />
                  </button>
                )
              })
            })()
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary refresh-button" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={loading ? 'spin' : ''} size={15} />
            Refresh
          </button>
          <span className="modal-footer-spacer" />
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onClose}
            disabled={!selectedDevice || loading}
          >
            Use Device
          </button>
        </div>
      </div>
    </div>
  )
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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [devices, setDevices] = useState<Device[]>([
    { id: 'mock', name: 'Mock Device', type: 'mock' }
  ])
  const [loadingDevices, setLoadingDevices] = useState(false)

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Load available devices and show device selection on startup
  useEffect(() => {
    const loadDevices = async () => {
      setLoadingDevices(true)
      try {
        const result = await (window as any).electronAPI.getAvailableDevices()
        if (result.success && result.devices) {
          setDevices(result.devices)
        }
      } catch (error) {
        console.error('Failed to load devices:', error)
      } finally {
        setLoadingDevices(false)
        setShowDeviceModal(true)
      }
    }
    
    loadDevices()
  }, [])

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

    // Don't auto-connect WebSocket on startup
    // User must explicitly select device and connect

    return () => {
      wsManager.disconnect()
    }
  }, [wsManager])

  const handleConnect = async () => {
    if (!selectedDevice) {
      console.error('No device selected')
      return
    }

    try {
      // Setup server with selected device type
      const result = await (window as any).electronAPI.restartServerWithDevice(selectedDevice.type)
      if (result.success || result.message) {
        // Connect WebSocket first
        wsManager.connect('ws://127.0.0.1:9229/ws')
        
        // Wait a moment for WebSocket to connect, then send Connect and Start messages
        setTimeout(() => {
          wsManager.send({
            type: 'Connect',
            data: {
              probe_selector: null,
              chip: null,
              token: null
            }
          })
          
          // Automatically start tracing after connecting
          setTimeout(() => {
            wsManager.send({
              type: 'Start',
              data: {
                allow_mask: 0xFFFFFFFF, // Enable all ports
                baud_rate: 2000000
              }
            })
            setState(prev => ({ ...prev, tracing: true }))
          }, 500)
        }, 1000)
        
        if (result.message) {
          console.log(result.message)
        }
      } else {
        console.error('Failed to setup server:', result.error)
      }
    } catch (error) {
      console.error('Error setting up server:', error)
    }
  }

  const handleDisconnect = () => {
    // Stop tracing first
    wsManager.send({
      type: 'Stop'
    })
    
    // Disconnect WebSocket
    wsManager.disconnect()
    
    // Update state
    setState(prev => ({
      ...prev,
      connected: false,
      tracing: false,
      events: [],
      stats: {
        eventsPerSec: 0,
        bytesPerSec: 0,
        dropRate: 0,
      }
    }))
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const handleDeviceSelect = (device: Device) => {
    setSelectedDevice(device)
  }

  const handleDeviceModalClose = () => {
    setShowDeviceModal(false)
    // Don't auto-connect, let user explicitly connect and start tracing
  }

  const handleShowDeviceModal = () => {
    setShowDeviceModal(true)
  }

  const handleRefreshDevices = async () => {
    setLoadingDevices(true)
    try {
      const result = await (window as any).electronAPI.getAvailableDevices()
      if (result.success && result.devices) {
        setDevices(result.devices)
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error)
    } finally {
      setLoadingDevices(false)
    }
  }

  return (
    <div className="app">
      <Toolbar
        connected={state.connected}
        tracing={state.tracing}
        serverVersion={state.serverVersion}
        selectedDevice={selectedDevice}
        theme={theme}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onToggleTheme={toggleTheme}
        onShowDeviceModal={handleShowDeviceModal}
      />
      
      <div className="main-content">
        <div className="timeline-container">
          <Timeline events={state.events} />
        </div>

        <aside className="performance-panel">
          <CpuChart stats={state.stats} />
        </aside>
      </div>

      <DeviceSelectionModal
        isOpen={showDeviceModal}
        devices={devices}
        selectedDevice={selectedDevice}
        loading={loadingDevices}
        onSelect={handleDeviceSelect}
        onClose={handleDeviceModalClose}
        onRefresh={handleRefreshDevices}
      />
    </div>
  )
}

export default App
