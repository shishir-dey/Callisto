interface Device {
  id: string
  name: string
  type: 'mock' | 'real'
}

interface ToolbarProps {
  connected: boolean
  tracing: boolean
  serverVersion?: string
  selectedDevice: Device | null
  theme: 'light' | 'dark'
  onConnect: () => void
  onDisconnect: () => void
  onToggleTheme: () => void
  onShowDeviceModal: () => void
}

export function Toolbar({
  connected,
  tracing,
  serverVersion,
  selectedDevice,
  theme,
  onConnect,
  onDisconnect,
  onToggleTheme,
  onShowDeviceModal
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        {/* Connect/Disconnect Button */}
        {connected ? (
          <button
            className="btn btn-danger"
            onClick={onDisconnect}
            style={{ 
              background: '#dc3545',
              borderColor: '#dc3545',
              minWidth: '100px'
            }}
          >
            🔴 Disconnect
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={onConnect}
            disabled={!selectedDevice}
            style={{ 
              background: '#28a745',
              borderColor: '#28a745',
              minWidth: '100px'
            }}
          >
            🟢 Connect
          </button>
        )}
        
        <div className="toolbar-divider" />
        
        {/* Device Name */}
        {selectedDevice ? (
          <div className="status-pill" onClick={onShowDeviceModal} style={{ cursor: 'pointer' }}>
            {selectedDevice.name}
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={onShowDeviceModal}>
            Select Device
          </button>
        )}
        
        <div className="toolbar-divider" />
        
        {/* ITM Baud Rate */}
        <label htmlFor="baud-select" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          ITM Baud:
        </label>
        <select
          id="baud-select"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            marginLeft: '4px'
          }}
          defaultValue="2000000"
        >
          <option value="115200">115200</option>
          <option value="460800">460800</option>
          <option value="921600">921600</option>
          <option value="2000000">2000000</option>
        </select>

        <div className="toolbar-divider" />

        {/* ITM Ports */}
        <label htmlFor="port-filter" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          ITM Ports:
        </label>
        <input
          id="port-filter"
          type="text"
          placeholder="0-31"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            width: '60px',
            marginLeft: '4px'
          }}
        />
      </div>

      <div className="toolbar-section" style={{ marginLeft: 'auto' }}>
        {/* Theme Toggle */}
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        
        {serverVersion && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
            v{serverVersion}
          </div>
        )}
      </div>
    </div>
  )
}