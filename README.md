# Callisto ITM Viewer

A real-time ITM (Instrumentation Trace Macrocell) viewer for embedded systems development. Callisto provides a modern, Apple-inspired interface for visualizing trace data from ARM Cortex-M microcontrollers.

## Quick Start

### Prerequisites

- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)
- **Node.js** 18+ - [Download](https://nodejs.org/)
- **pnpm** - `npm install -g pnpm`
- **just** - `cargo install just`

### Installation

```bash
# Clone the repository
git clone https://github.com/callisto-itm/callisto.git
cd callisto

# Set up development environment
just setup

# Start the application
just dev
```

This will:
1. Install all dependencies
2. Generate TypeScript types from JSON schemas
3. Start the server on `127.0.0.1:9229`
4. Launch the Electron client with device selection
5. Automatically detect available debug probes

## Architecture

Callisto consists of three main components:

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│  Electron App   │ ◄─────────────► │  Rust Server    │
│  (Client UI)    │                 │  (Data Bridge)  │
└─────────────────┘                 └─────────────────┘
                                             │ probe-rs
                                             ▼
                                    ┌─────────────────┐
                                    │  Debug Probe    │
                                    │  (ST-Link, etc) │
                                    └─────────────────┘
                                             │ SWD/JTAG
                                             ▼
                                    ┌─────────────────┐
                                    │  Target MCU     │
                                    │  (ARM Cortex-M) │
                                    └─────────────────┘
```

### Server (Rust)
- **Protocol**: WebSocket message definitions with JSON schema generation
- **Core**: ITM processing engine with probe-rs integration
- **CLI**: WebSocket server with real-time event streaming

### Client (Electron + React)
- **Viewer**: Desktop application with timeline and performance charts
- **Types**: Generated TypeScript definitions from JSON schemas

### Embedded Libraries
- **C Header**: `callisto_trace.h` for C/C++ projects
- **Rust Crate**: `callisto-trace` for embedded Rust projects

## Features

### Device Discovery
- **Automatic Detection**: Scans for connected debug probes using probe-rs
- **Mock Support**: Built-in mock device for testing without hardware
- **Dynamic Switching**: Change devices without restarting the application
- **Visual Interface**: Modern device selection modal with clear indicators

### Modern UI
- **Light/Dark Themes**: Toggle between themes with instant switching
- **Card-Based Layout**: Timeline and performance charts in distinct, bordered cards
- **Apple-Inspired Design**: Clean, modern interface with smooth animations
- **Responsive**: Adapts to different window sizes and screen densities

### Real-Time Visualization
- **Timeline View**: Live ITM event stream with syntax highlighting
- **Performance Charts**: CPU load, event rate, and throughput monitoring
- **Event Filtering**: Filter by port, event type, or custom criteria
- **Export/Import**: Save and load trace sessions (coming soon)

## Usage

### Getting Started

1. **Launch Application**: Run `just dev` to start both server and client
2. **Select Device**: Choose from detected probes or use mock device for testing
3. **Connect**: Click connect to establish communication with your target
4. **Start Tracing**: Begin capturing ITM data from your embedded application

### Embedded Integration

#### C/C++ Projects

```c
#include "callisto_trace.h"

int main() {
    // Initialize ITM tracing
    callisto_trace_init(0x0F); // Enable ports 0-3
    
    // Send text messages
    callisto_puts("System initialized");
    
    // Send markers
    callisto_marker(42);
    
    // RTOS events
    callisto_task_switch(1, 2);
    callisto_isr_enter(10);
    callisto_isr_exit(10);
    
    while (1) {
        callisto_idle_enter();
        __WFI(); // Wait for interrupt
        callisto_idle_exit();
        
        // Your application code...
    }
}
```

#### Rust Projects

```rust
use callisto_trace::*;

fn main() -> ! {
    // Initialize global ITM
    let itm = init_global();
    
    // Send trace data
    itm.console().puts("Hello from Rust!");
    itm.markers().marker(123);
    itm.rtos().task_switch(1, 2);
    
    loop {
        // Your application code...
    }
}
```

### ITM Port Map

| Port | Name | Purpose | Decoder |
|------|------|---------|---------|
| 0 | Console | Text output | Text |
| 1 | RTOS | Task/ISR events | TaskIsr |
| 2 | Markers | Timestamped markers | Marker |
| 3 | Counters | Performance counters | Counter |
| 4-31 | User | Custom data | User-defined |

### WebSocket Protocol

Connect to `ws://127.0.0.1:9229/ws` for real-time ITM data:

```javascript
const ws = new WebSocket('ws://127.0.0.1:9229/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'Hello':
      console.log('Connected:', message.data.version);
      break;
    case 'Event':
      console.log('ITM Event:', message.data);
      break;
    case 'Stats':
      console.log('Performance:', message.data);
      break;
  }
};
```

## Development

### Commands

```bash
# Development
just dev          # Start development environment
just build        # Build everything
just test         # Run all tests
just clean        # Clean build artifacts

# Code Quality
just lint         # Lint all code
just fmt          # Format all code
just check        # Check project health

# Utilities
just typegen      # Generate TypeScript types
just docs         # Generate documentation
just status       # Show project status
```

### Project Structure

```
callisto/
├── server/                 # Rust server workspace
│   ├── protocol/          # WebSocket protocol definitions
│   ├── core/              # ITM processing engine
│   └── cli/               # WebSocket server binary
├── client/                # Node.js client workspace
│   ├── apps/viewer-electron/  # Electron + React app
│   └── shared/types/      # Generated TypeScript types
├── schema/ws/             # JSON schemas
├── docs/                  # Documentation
├── callisto-trace/        # Embedded Rust library
├── callisto_trace.h       # Embedded C library
└── justfile              # Development commands
```

### Adding New Event Types

1. **Protocol**: Add to `TraceEvent` enum in [`server/protocol/src/lib.rs`](server/protocol/src/lib.rs)
2. **Server**: Implement decoder in [`server/core/src/decoder.rs`](server/core/src/decoder.rs)
3. **Client**: Add UI handling in [`client/apps/viewer-electron/src/components/Timeline.tsx`](client/apps/viewer-electron/src/components/Timeline.tsx)
4. **Types**: Regenerate with `just typegen`

## Documentation

- **[Device Discovery](docs/device-discovery.md)**: Device detection, UI enhancements, and management
- **[Protocol](docs/protocol.md)**: WebSocket message format and ITM port assignments
- **[Architecture](docs/architecture.md)**: System design and component overview
- **[Development Workflow](docs/dev-workflow.md)**: Contributing guidelines and best practices

## Hardware Support

### Supported Debug Probes
- **ST-Link V2/V3** (STMicroelectronics) - Full support with automatic detection
- **J-Link** (Segger) - All models supported via probe-rs
- **CMSIS-DAP** compatible probes - Standard ARM debug interface
- **Black Magic Probe** - Open source debug probe
- **Custom Probes** - Any probe-rs supported device

### Supported Microcontrollers
- **ARM Cortex-M series**: M0, M0+, M3, M4, M7, M33, M55
- **STM32 family**: All series with ITM support
- **Nordic nRF series**: nRF52, nRF53, nRF91
- **NXP LPC/Kinetis series**: LPC4xxx, LPC5xxx, Kinetis K/L series
- **Atmel/Microchip SAM series**: SAMD, SAME, SAMV

### Requirements
- **ITM Support**: Most Cortex-M3/M4/M7 devices (check datasheet)
- **SWO Connection**: SWO pin connected to debug probe
- **Firmware Setup**: ITM enabled and configured in target application
- **Debug Probe**: Connected via USB and recognized by operating system

### Device Detection
The application automatically scans for connected probes on startup:
- **Real-time Scanning**: Refresh device list without restarting
- **Status Indicators**: Clear visual feedback for device availability
- **Fallback Mode**: Mock device available when no hardware detected
- **Error Handling**: Graceful handling of disconnected or busy probes

## Performance

- **Throughput**: Up to 500KB/s with USB 2.0 debug probes
- **Latency**: <10ms end-to-end typical
- **Event Rate**: 10,000+ events/second sustained
- **Memory**: <50MB server, <500MB client
- **CPU**: <5% on modern systems

## Troubleshooting

### Common Issues

**"No devices found" or empty device list**
- Ensure debug probe is connected via USB
- Check that probe drivers are installed (ST-Link, J-Link, etc.)
- Try refreshing the device list using the refresh button
- Verify probe is not in use by another application (IDE, debugger)
- Use `just list-probes` command to verify probe detection

**"Failed to connect to device"**
- Ensure target microcontroller is powered and connected
- Verify SWO pin is properly connected to debug probe
- Check that no other debugging session is active
- Try selecting a different device or using mock device

**"ITM data not received"**
- Verify ITM is enabled and configured in target firmware
- Check SWO baud rate matches server configuration (typically 2MHz)
- Ensure target CPU frequency is correctly configured
- Verify ITM stimulus ports are enabled (ports 0-31)

**"WebSocket connection failed"**
- Check server is running on port 9229
- Verify firewall is not blocking the connection
- Try restarting with `just server`
- Check for port conflicts with other applications

**"Server startup failed" or "Address already in use"**
- Another server instance may be running - stop it first
- Check if port 9229 is in use by another application
- Try restarting the entire development environment with `just dev`

### Debug Mode

```bash
# Enable debug logging
RUST_LOG=debug just server

# Monitor WebSocket traffic
websocat ws://127.0.0.1:9229/ws
```

## Contributing

We welcome contributions! Please see our [development workflow](docs/dev-workflow.md) for guidelines.

### Quick Contribution Setup

```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR_USERNAME/callisto.git
cd callisto

# Set up development environment
just setup

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
just test
just lint

# Commit and push
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature

# Create pull request on GitHub
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
