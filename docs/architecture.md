# Callisto ITM Viewer Architecture

This document describes the overall architecture and design decisions of the Callisto ITM viewer system.

## Overview

Callisto is a real-time ITM (Instrumentation Trace Macrocell) viewer designed for embedded systems development. It consists of three main components:

1. **Server** (Rust) - Hardware interface and data processing
2. **Client** (Electron + React) - User interface and visualization
3. **Embedded Libraries** (C/Rust) - Target-side tracing support

## System Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│                 │ ◄─────────────► │                 │
│  Electron App   │                 │  Rust Server    │
│  (Client UI)    │                 │  (Data Bridge)  │
│                 │                 │                 │
└─────────────────┘                 └─────────────────┘
                                             │
                                             │ probe-rs
                                             ▼
                                    ┌─────────────────┐
                                    │                 │
                                    │  Debug Probe    │
                                    │  (ST-Link, etc) │
                                    │                 │
                                    └─────────────────┘
                                             │
                                             │ SWD/JTAG
                                             ▼
                                    ┌─────────────────┐
                                    │                 │
                                    │  Target MCU     │
                                    │  (ARM Cortex-M) │
                                    │                 │
                                    └─────────────────┘
```

## Component Details

### Server (Rust)

The server is implemented as a Cargo workspace with three crates:

#### `protocol/` - Message Definitions
- **Purpose**: WebSocket protocol definitions and JSON schema generation
- **Dependencies**: `serde`, `schemars`, `uuid`, `chrono`
- **Key Features**:
  - Type-safe message definitions
  - Automatic JSON schema generation
  - Comprehensive event types for ITM data

#### `core/` - ITM Processing Engine
- **Purpose**: Hardware abstraction and data processing
- **Dependencies**: `probe-rs`, `tokio`, `crossbeam-channel`
- **Key Features**:
  - Probe management and session handling
  - ITM frame parsing and decoding
  - Per-port decoder plugins (text, markers, RTOS events, counters)
  - Backpressure and flow control
  - Mock data generation for testing

#### `cli/` - WebSocket Server
- **Purpose**: HTTP/WebSocket server and client interface
- **Dependencies**: `axum`, `tower`, `tokio`
- **Key Features**:
  - WebSocket server on `127.0.0.1:9229/ws`
  - CORS support for web clients
  - Authentication via Bearer tokens
  - Real-time event streaming
  - Connection management

### Client (Electron + React + Vite)

The client is a pnpm workspace with multiple packages:

#### `apps/viewer-electron/` - Main Application
- **Framework**: Electron + React + Vite + TypeScript
- **Purpose**: Desktop application with native OS integration
- **Key Features**:
  - Apple-inspired UI design
  - Real-time timeline visualization
  - CPU load and performance charts
  - Server process management
  - File export/import capabilities

#### `shared/types/` - Generated Types
- **Purpose**: TypeScript type definitions from JSON schemas
- **Generation**: `json-schema-to-typescript` from `schema/ws/`
- **Features**:
  - Runtime type validation with `ajv`
  - Full protocol coverage
  - IDE autocomplete support

### Embedded Libraries

#### `callisto_trace.h` - C Header
- **Target**: C/C++ embedded projects
- **Features**:
  - Zero-overhead inline functions
  - Direct ITM register access
  - Comprehensive event API
  - RTOS integration macros
  - Configurable port assignments

#### `callisto-trace/` - Rust Crate
- **Target**: Embedded Rust (`no_std`)
- **Features**:
  - Type-safe ITM interface
  - Zero-cost abstractions
  - Optional `cortex-m` integration
  - Global instance support
  - Comprehensive documentation

## Data Flow

### ITM Data Path

```
Target MCU          Debug Probe         Server              Client
─────────           ───────────         ──────              ──────

ITM Stimulus  ──►   USB/Serial   ──►    probe-rs     ──►    WebSocket
Ports 0-31          Transport            Parsing             JSON Events
                                        │
                                        ▼
                                    Decoders:
                                    • Text
                                    • Markers  
                                    • RTOS Events
                                    • Counters
                                    • User-defined
```

### Message Flow

1. **Target** writes to ITM stimulus ports using embedded libraries
2. **Debug Probe** captures ITM data via SWO pin
3. **Server** reads data through probe-rs, decodes frames, and streams via WebSocket
4. **Client** receives JSON events, validates against schemas, and updates UI

### Timing and Synchronization

- **ITM Timestamps**: DWT CYCCNT (preferred) or host monotonic time
- **WebSocket Latency**: <10ms typical for local connections
- **Update Rate**: 60 FPS UI updates, unbounded event rate
- **Buffering**: Client-side circular buffer (1MB default)

## Design Decisions

### Why Rust for the Server?

1. **Performance**: Zero-cost abstractions, minimal runtime overhead
2. **Safety**: Memory safety without garbage collection
3. **Ecosystem**: Excellent `probe-rs` library for debug probe access
4. **Concurrency**: Tokio async runtime for WebSocket handling
5. **Type Safety**: Strong typing prevents protocol errors

### Why Electron for the Client?

1. **Cross-Platform**: Single codebase for Windows, macOS, Linux
2. **Web Technologies**: Leverage React ecosystem and CSS for UI
3. **Native Integration**: File system access, process management
4. **Development Speed**: Rapid prototyping and iteration
5. **Packaging**: Easy distribution with auto-updater support

### Why WebSocket Protocol?

1. **Real-Time**: Low-latency bidirectional communication
2. **Standardized**: Well-supported across platforms and languages
3. **Debuggable**: Human-readable JSON messages
4. **Extensible**: Easy to add new message types
5. **Firewall-Friendly**: Uses standard HTTP ports

### Why JSON Schema?

1. **Validation**: Runtime message validation on both ends
2. **Documentation**: Self-documenting protocol
3. **Code Generation**: Automatic TypeScript type generation
4. **Tooling**: IDE support and validation
5. **Versioning**: Schema evolution and compatibility

## Performance Characteristics

### Throughput

| Component | Typical | Maximum | Bottleneck |
|-----------|---------|---------|------------|
| ITM Hardware | 100KB/s | 2MB/s | Clock speed |
| Debug Probe | 50KB/s | 500KB/s | USB 2.0 |
| Server Processing | 1MB/s | 10MB/s | CPU |
| WebSocket | 10MB/s | 100MB/s | Network |
| Client Rendering | 60 FPS | 120 FPS | GPU |

### Latency

| Path | Typical | Maximum |
|------|---------|---------|
| ITM → Probe | <1ms | 5ms |
| Probe → Server | 1-8ms | 50ms |
| Server Processing | <1ms | 10ms |
| WebSocket Transport | <1ms | 5ms |
| Client Processing | 1-16ms | 50ms |
| **Total End-to-End** | **5-25ms** | **100ms** |

### Memory Usage

| Component | Typical | Peak |
|-----------|---------|------|
| Server | 10MB | 50MB |
| Client | 100MB | 500MB |
| Embedded Library | <1KB | <10KB |

## Scalability

### Concurrent Connections
- **Current**: Single client per server instance
- **Future**: Multiple clients with broadcast support
- **Limitation**: Debug probe exclusivity

### Event Rate
- **Sustainable**: 10,000 events/second
- **Burst**: 100,000 events/second
- **Backpressure**: Automatic flow control and dropping

### Data Retention
- **Client Buffer**: 1MB circular buffer (~10,000 events)
- **Persistence**: Optional file export/import
- **Streaming**: No server-side storage

## Security Considerations

### Authentication
- **Optional**: Bearer token authentication
- **Transport**: WebSocket over HTTP (local only)
- **Future**: TLS support for remote connections

### Access Control
- **Probe Access**: OS-level permissions required
- **Network**: Localhost binding by default
- **File System**: Electron sandbox restrictions

### Data Privacy
- **Local Only**: No external network communication
- **No Telemetry**: No usage data collection
- **User Control**: All data remains on user's machine

## Extensibility

### Adding New Event Types

1. **Protocol**: Add to `TraceEvent` enum in `protocol/src/lib.rs`
2. **Server**: Implement decoder in `core/src/decoder.rs`
3. **Client**: Add UI handling in timeline component
4. **Schema**: Regenerate with `just typegen`

### Custom Decoders

```rust
pub struct CustomDecoder {
    // Decoder state
}

impl ItmDecoder for CustomDecoder {
    fn decode(&mut self, port: u8, data: &[u8], timestamp: u64) -> Result<Vec<TraceEvent>> {
        // Custom decoding logic
    }
}
```

### Plugin Architecture (Future)

- **Server Plugins**: Dynamic decoder loading
- **Client Plugins**: Custom visualization components
- **Protocol Extensions**: Versioned message types

## Testing Strategy

### Unit Tests
- **Server**: Cargo test framework
- **Client**: Jest + React Testing Library
- **Coverage**: >80% target

### Integration Tests
- **Protocol**: Message round-trip validation
- **Hardware**: Mock probe simulation
- **End-to-End**: Automated UI testing

### Performance Tests
- **Throughput**: Synthetic event generation
- **Latency**: Timestamp correlation
- **Memory**: Leak detection and profiling

## Deployment

### Development
```bash
just setup    # Install dependencies
just dev      # Start development servers
```

### Production Build
```bash
just release  # Build and package everything
```

### Distribution
- **Electron**: Platform-specific installers
- **Server**: Bundled as resource in Electron app
- **Libraries**: Published to crates.io and GitHub

## Device Discovery and Management

### Probe Detection
The server now includes comprehensive device discovery capabilities:

- **Automatic Detection**: Uses probe-rs to scan for connected debug probes
- **Device Types**: Supports both mock devices (for testing) and real hardware probes
- **Dynamic Switching**: Users can switch between devices without restarting the application
- **Graceful Fallback**: Falls back to mock devices if no hardware is detected

### Supported Probe Types
- ST-Link V2/V3 (STMicroelectronics)
- J-Link (Segger)
- CMSIS-DAP compatible probes
- Black Magic Probe
- Any probe-rs supported device

### Device Selection UI
The Electron client features a modern device selection modal:

- **Visual Distinction**: Mock devices (🎭) vs real probes (🔌)
- **Real-time Scanning**: Refresh button to re-scan for devices
- **Status Indicators**: Clear indication of device type and capabilities
- **Theme Support**: Consistent with light/dark theme system

### Server Management
Enhanced server lifecycle management:

- **Conflict Detection**: Automatically detects if external server is running
- **Graceful Restart**: Stops and restarts server with new device configuration
- **Error Handling**: Proper handling of port conflicts and device unavailability
- **Logging**: Comprehensive logging for debugging device issues

## UI Enhancements

### Theme System
- **Light/Dark Modes**: Complete theme system with CSS variables
- **Instant Switching**: Toggle between themes without restart
- **Consistent Styling**: All components respect theme settings
- **System Integration**: Follows OS theme preferences

### Card-Based Layout
- **Visual Separation**: Timeline and performance charts in distinct cards
- **Borders and Shadows**: Clear visual hierarchy with modern styling
- **Responsive Design**: Adapts to different window sizes
- **Accessibility**: High contrast borders for better visibility

### Title Bar Fix
- **Content Separation**: Fixed overlap between title bar and application content
- **Cross-Platform**: Consistent behavior across operating systems
- **Native Feel**: Maintains platform-specific title bar styling

## Future Enhancements

### Short Term
- [x] Real probe-rs integration with device discovery
- [x] Enhanced UI with theme support and card layout
- [ ] File export/import functionality
- [ ] Advanced filtering and search
- [ ] Performance optimizations

### Medium Term
- [ ] Multiple probe support (concurrent connections)
- [ ] Remote server connections
- [ ] Plugin system for custom decoders
- [ ] Advanced visualization modes

### Long Term
- [ ] Web-based client (no Electron)
- [ ] Cloud synchronization
- [ ] Machine learning analysis
- [ ] Integration with other tools

## Contributing

### Development Setup
1. Install Rust (latest stable)
2. Install Node.js 18+ and pnpm
3. Install just command runner
4. Run `just setup` to initialize

### Code Style
- **Rust**: `cargo fmt` and `cargo clippy`
- **TypeScript**: Prettier and ESLint
- **Documentation**: Comprehensive inline docs

### Pull Request Process
1. Fork repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Update documentation
6. Submit pull request

For detailed development workflow, see [`dev-workflow.md`](dev-workflow.md).