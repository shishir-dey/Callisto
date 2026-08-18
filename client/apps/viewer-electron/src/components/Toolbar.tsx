import { Moon, Power, Sun } from 'lucide-react'

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
        {connected ? (
          <button
            className="btn btn-danger connection-button"
            onClick={onDisconnect}
          >
            <Power size={14} /> Disconnect
          </button>
        ) : (
          <button
            className="btn btn-primary connection-button"
            onClick={onConnect}
            disabled={!selectedDevice}
          >
            <Power size={14} /> Connect
          </button>
        )}

        <div className="toolbar-divider" />

        {selectedDevice ? (
          <button
            type="button"
            className={`status-pill ${tracing ? 'tracing' : connected ? 'connected' : 'disconnected'}`}
            onClick={onShowDeviceModal}
          >
            <span className="status-dot" aria-hidden="true" />
            {selectedDevice.name}
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={onShowDeviceModal}>
            Select Device
          </button>
        )}

        <div className="toolbar-divider" />

        <div className="control-group">
          <label htmlFor="baud-select">ITM Baud</label>
          <select id="baud-select" defaultValue="2000000">
            <option value="115200">115200</option>
            <option value="460800">460800</option>
            <option value="921600">921600</option>
            <option value="2000000">2000000</option>
          </select>
        </div>

        <div className="toolbar-divider" />

        <div className="control-group">
          <label htmlFor="port-filter">ITM Ports</label>
          <input id="port-filter" type="text" placeholder="0–31" />
        </div>
      </div>

      <div className="toolbar-section toolbar-actions">
        <button className="theme-toggle" onClick={onToggleTheme} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {serverVersion && (
          <div className="server-version">v{serverVersion}</div>
        )}
      </div>
    </div>
  )
}
