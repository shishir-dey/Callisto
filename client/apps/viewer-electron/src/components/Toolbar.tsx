interface ToolbarProps {
  connected: boolean
  tracing: boolean
  serverVersion?: string
  onConnect: () => void
  onStartTracing: () => void
  onStopTracing: () => void
}

export function Toolbar({
  connected,
  tracing,
  serverVersion,
  onConnect,
  onStartTracing,
  onStopTracing
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button
          className={`btn ${connected ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onConnect}
          disabled={connected}
        >
          {connected ? 'Connected' : 'Connect'}
        </button>
        
        <div className="toolbar-divider" />
        
        <div className={`status-pill ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
        
        {connected && (
          <div className="status-pill">
            Mock Target
          </div>
        )}
      </div>

      <div className="toolbar-section">
        <div className="toolbar-divider" />
        
        <label htmlFor="baud-select" style={{ fontSize: '12px', color: '#999' }}>
          Baud:
        </label>
        <select
          id="baud-select"
          style={{
            background: '#3a3a3a',
            border: '1px solid #555',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px'
          }}
          defaultValue="2000000"
        >
          <option value="115200">115200</option>
          <option value="460800">460800</option>
          <option value="921600">921600</option>
          <option value="2000000">2000000</option>
        </select>

        <label htmlFor="port-filter" style={{ fontSize: '12px', color: '#999', marginLeft: '12px' }}>
          Ports:
        </label>
        <input
          id="port-filter"
          type="text"
          placeholder="0-31"
          style={{
            background: '#3a3a3a',
            border: '1px solid #555',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            width: '60px'
          }}
        />
      </div>

      <div className="toolbar-section" style={{ marginLeft: 'auto' }}>
        {connected && !tracing && (
          <button
            className="btn btn-primary"
            onClick={onStartTracing}
          >
            Start Tracing
          </button>
        )}
        
        {connected && tracing && (
          <>
            <div className="status-pill tracing">
              Tracing
            </div>
            <button
              className="btn btn-danger"
              onClick={onStopTracing}
            >
              Stop
            </button>
          </>
        )}
        
        {serverVersion && (
          <div style={{ fontSize: '11px', color: '#666', marginLeft: '12px' }}>
            v{serverVersion}
          </div>
        )}
      </div>
    </div>
  )
}