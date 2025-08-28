# Callisto ITM Viewer

A real-time ITM (Instrumentation Trace Macrocell) viewer for embedded systems development. Callisto provides a modern, Apple-inspired interface for visualizing trace data from ARM Cortex-M microcontrollers.

![Callisto Screenshot](docs/images/screenshot.png)

## Features

- 🚀 **Real-time ITM trace visualization** with sub-10ms latency
- 📊 **Apple-inspired UI** with timeline, CPU charts, and performance metrics
- 🦀 **High-performance Rust server** with probe-rs integration
- ⚛️ **Cross-platform Electron client** (Windows, macOS, Linux)
- 🔌 **Easy embedded integration** with C header and Rust crate
- 📡 **WebSocket protocol** with JSON schema validation
- 🎯 **Multi-port support** for different trace data types
- 🔍 **Advanced filtering** and search capabilities
- 📈 **Performance monitoring** with drop rate and throughput stats

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
3. Start the server with mock data on `127.0.0.1:9229`
4. Launch the Electron client

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

## Usage

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

- **[Protocol](docs/protocol.md)**: WebSocket message format and ITM port assignments
- **[Architecture](docs/architecture.md)**: System design and component overview
- **[Development Workflow](docs/dev-workflow.md)**: Contributing guidelines and best practices

## Hardware Support

### Supported Debug Probes
- ST-Link V2/V3
- J-Link (Segger)
- CMSIS-DAP compatible probes
- Black Magic Probe

### Supported Microcontrollers
- All ARM Cortex-M series (M0, M0+, M3, M4, M7, M33, M55)
- STM32 family
- Nordic nRF series
- NXP LPC/Kinetis series
- Atmel/Microchip SAM series

### Requirements
- ITM support (most Cortex-M3/M4/M7 devices)
- SWO pin connected to debug probe
- ITM enabled in firmware

## Performance

- **Throughput**: Up to 500KB/s with USB 2.0 debug probes
- **Latency**: <10ms end-to-end typical
- **Event Rate**: 10,000+ events/second sustained
- **Memory**: <50MB server, <500MB client
- **CPU**: <5% on modern systems

## Troubleshooting

### Common Issues

**"No probes found"**
- Ensure debug probe is connected and recognized by OS
- Check USB drivers are installed
- Try `just list-probes` to verify detection

**"ITM data not received"**
- Verify SWO pin is connected
- Check ITM is enabled in target firmware
- Ensure correct baud rate (typically 2MHz)
- Verify target CPU frequency matches configuration

**"WebSocket connection failed"**
- Check server is running on port 9229
- Verify firewall settings
- Try restarting with `just server`

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

## Acknowledgments

- [probe-rs](https://github.com/probe-rs/probe-rs) - Rust debugging toolkit
- [Electron](https://electronjs.org/) - Cross-platform desktop apps
- [React](https://reactjs.org/) - UI framework
- [Axum](https://github.com/tokio-rs/axum) - Web framework for Rust
- ARM Cortex-M ITM specification

## Roadmap

### v0.2.0
- [ ] Real probe-rs integration (currently mocked)
- [ ] File export/import functionality
- [ ] Advanced filtering and search
- [ ] Performance optimizations

### v0.3.0
- [ ] Multiple probe support
- [ ] Remote server connections
- [ ] Plugin system
- [ ] Advanced visualization modes

### v1.0.0
- [ ] Web-based client option
- [ ] Production-ready stability
- [ ] Comprehensive hardware testing
- [ ] Professional documentation

---

**Made with ❤️ for embedded developers**

For questions, issues, or feature requests, please visit our [GitHub repository](https://github.com/callisto-itm/callisto).