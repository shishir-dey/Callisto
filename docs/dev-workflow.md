# Callisto Development Workflow

This document describes the development workflow, tools, and best practices for contributing to the Callisto ITM viewer project.

## Quick Start

### Prerequisites

- **Rust**: Latest stable version (install via [rustup](https://rustup.rs/))
- **Node.js**: Version 18+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- **pnpm**: Package manager (install via `npm install -g pnpm`)
- **just**: Command runner (install via `cargo install just`)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/callisto-itm/callisto.git
cd callisto

# Set up development environment
just setup

# Start development servers
just dev
```

This will:
1. Install all Rust and Node.js dependencies
2. Generate TypeScript types from JSON schemas
3. Start the server with mock data
4. Launch the Electron client
5. Open the development tools

## Project Structure

```
callisto/
├── client/                # Node.js client workspace
│   ├── apps/viewer-electron/  # Electron + React app
│   └── shared/types/          # Shared TypeScript types
├── server/                # Rust server workspace
│   ├── protocol/          # WebSocket protocol definitions
│   └── cli/               # WebSocket server binary
├── device/                # Device-side libraries
│   ├── c/callisto_trace.h     # C header for embedded systems
│   └── rust/callisto-trace/   # Rust library for embedded systems
├── docs/                  # Documentation
├── justfile              # Development commands
├── README.md
└── .github/              # CI/CD workflows
```

## Development Commands

All development tasks are managed through the `justfile`. Run `just` to see all available commands.

### Essential Commands

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

### Server Development

```bash
# Server-specific commands
just server       # Run server only
just build-server # Build server
just test-server  # Test server
just lint-server  # Lint Rust code
```

### Client Development

```bash
# Client-specific commands
just client       # Run client only (assumes server running)
just build-client # Build Electron app
just test-client  # Test client
just lint-client  # Lint TypeScript code
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes...
# Edit code, add tests, update docs

# Check code quality
just lint
just test

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### 2. Protocol Changes

When modifying the WebSocket protocol:

```bash
# 1. Edit protocol definitions
vim server/protocol/src/lib.rs

# 2. Regenerate schemas and types
just typegen

# 3. Update client code to use new types
vim client/apps/viewer-electron/src/...

# 4. Test the changes
just test

# 5. Update documentation
vim docs/protocol.md
```

### 3. Adding New ITM Event Types

```bash
# 1. Add event to protocol
vim server/protocol/src/lib.rs
# Add new variant to TraceEvent enum

# 2. Implement decoder
vim server/core/src/decoder.rs
# Add decoding logic

# 3. Update client UI
vim client/apps/viewer-electron/src/components/Timeline.tsx
# Add rendering for new event type

# 4. Regenerate types and test
just typegen
just test
```

## Code Style and Standards

### Rust Code

- **Formatting**: Use `cargo fmt` (enforced by CI)
- **Linting**: Use `cargo clippy` with default settings
- **Documentation**: All public APIs must have doc comments
- **Testing**: Unit tests for all non-trivial functions
- **Error Handling**: Use `Result<T, E>` and `anyhow` for errors

Example:
```rust
/// Decode ITM frame data into trace events
/// 
/// # Arguments
/// 
/// * `port` - ITM stimulus port number (0-31)
/// * `data` - Raw frame data
/// * `timestamp` - Frame timestamp in microseconds
/// 
/// # Returns
/// 
/// Vector of decoded trace events
/// 
/// # Errors
/// 
/// Returns error if frame data is malformed
pub fn decode_frame(port: u8, data: &[u8], timestamp: u64) -> Result<Vec<TraceEvent>> {
    // Implementation...
}
```

### TypeScript Code

- **Formatting**: Use Prettier (configured in `.prettierrc`)
- **Linting**: Use ESLint with TypeScript rules
- **Types**: Prefer explicit types over `any`
- **Components**: Use functional components with hooks
- **Testing**: Jest + React Testing Library

Example:
```typescript
interface TimelineProps {
  events: TraceEvent[]
  onEventSelect?: (event: TraceEvent) => void
}

export function Timeline({ events, onEventSelect }: TimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<TraceEvent | null>(null)
  
  const handleEventClick = useCallback((event: TraceEvent) => {
    setSelectedEvent(event)
    onEventSelect?.(event)
  }, [onEventSelect])
  
  return (
    <div className="timeline">
      {events.map((event, index) => (
        <EventItem
          key={index}
          event={event}
          selected={event === selectedEvent}
          onClick={handleEventClick}
        />
      ))}
    </div>
  )
}
```

### Documentation

- **API Docs**: Comprehensive inline documentation
- **README**: Keep up-to-date with current features
- **Architecture**: Update when making structural changes
- **Protocol**: Document all message types and formats

## Testing Strategy

### Unit Tests

**Rust:**
```bash
# Run all tests
cargo test

# Run specific test
cargo test test_decode_frame

# Run with output
cargo test -- --nocapture
```

**TypeScript:**
```bash
# Run all tests
pnpm test

# Run in watch mode
pnpm test --watch

# Run with coverage
pnpm test --coverage
```

### Integration Tests

```bash
# Test protocol message round-trips
just test-protocol

# Test WebSocket communication
just test-websocket

# Test end-to-end workflow
just test-e2e
```

### Manual Testing

```bash
# Start development environment (includes device selection)
just dev

# Test server with specific device types
just server --mock          # Mock device for testing
just server --probe         # Real hardware probes
just server --list-probes   # List available devices

# Test client features
# - Device selection modal on startup
# - Light/dark theme toggle
# - Card-based layout with borders
# - Real-time device switching
```

## Debugging

### Server Debugging

```bash
# Enable debug logging
RUST_LOG=debug just server

# Run with debugger
rust-gdb target/debug/callisto

# Profile performance
cargo build --release
perf record -g ./target/release/callisto --mock
perf report
```

### Client Debugging

```bash
# Open DevTools automatically
just client

# Debug main process
code --inspect-brk=9229 .

# Debug renderer process
# Use Chrome DevTools in Electron window
```

### Protocol Debugging

```bash
# Monitor WebSocket traffic
websocat ws://127.0.0.1:9229/ws

# Validate JSON schemas
ajv validate -s schema/ws/server-message.json -d test-message.json
```

## Performance Optimization

### Profiling

```bash
# Profile server
just profile

# Benchmark performance
just bench

# Memory usage analysis
valgrind --tool=massif ./target/release/callisto --mock
```

### Optimization Guidelines

1. **Server**: Minimize allocations in hot paths
2. **Client**: Use React.memo for expensive components
3. **Protocol**: Batch messages when possible
4. **UI**: Virtualize large lists (timeline events)

## Release Process

### Version Bumping

```bash
# Update version in all Cargo.toml files
vim server/*/Cargo.toml

# Update version in package.json files
vim client/*/package.json

# Update CHANGELOG.md
vim CHANGELOG.md

# Commit version bump
git commit -am "chore: bump version to v0.2.0"
```

### Creating Releases

```bash
# Build release artifacts
just release

# Create and push tag
just tag 0.2.0

# GitHub Actions will automatically:
# - Build for all platforms
# - Create GitHub release
# - Upload artifacts
```

### Distribution

- **Electron App**: Auto-updater via GitHub releases
- **Rust Crates**: Published to crates.io
- **Documentation**: Deployed to GitHub Pages

## Continuous Integration

### GitHub Actions Workflows

- **`.github/workflows/ci.yml`**: Main CI pipeline
- **`.github/workflows/release.yml`**: Release builds
- **`.github/workflows/docs.yml`**: Documentation deployment

### CI Pipeline

1. **Code Quality**:
   - Rust: `cargo fmt --check`, `cargo clippy`
   - TypeScript: `eslint`, `prettier --check`

2. **Testing**:
   - Unit tests: `cargo test`, `pnpm test`
   - Integration tests: Protocol validation
   - Security: `cargo audit`, `pnpm audit`

3. **Building**:
   - Server: All platforms (Linux, macOS, Windows)
   - Client: Electron packaging for all platforms
   - Documentation: mdBook generation

4. **Deployment**:
   - Artifacts uploaded to GitHub releases
   - Documentation deployed to GitHub Pages
   - Crates published to crates.io (on tags)

## Troubleshooting

### Common Issues

**"Schema generation failed"**
```bash
# Ensure protocol crate compiles
cd server/protocol
cargo check

# Regenerate schemas
just typegen
```

**"WebSocket connection failed"**
```bash
# Check if server is running
curl http://127.0.0.1:9229/ws

# Check firewall settings
# Ensure port 9229 is not blocked
```

**"Electron app won't start"**
```bash
# Clear node_modules and reinstall
just clean-client
just install-client

# Check Node.js version
node --version  # Should be 18+
```

**"Device selection not working"**
```bash
# Check probe-rs installation
cargo install probe-rs --features cli

# Test device detection manually
just list-probes

# Check server logs for device errors
RUST_LOG=debug just server
```

**"Server startup conflicts"**
```bash
# Kill existing server processes
pkill -f callisto
lsof -ti:9229 | xargs kill -9

# Clean restart
just clean
just dev
```

**"TypeScript errors after protocol changes"**
```bash
# Regenerate types
just typegen

# Clear TypeScript cache
rm -rf client/apps/viewer-electron/node_modules/.cache
```

**"Theme not switching properly"**
```bash
# Clear browser cache in Electron
# Use Ctrl+Shift+R or Cmd+Shift+R to hard refresh

# Check CSS variables are loaded
# Open DevTools and inspect :root element
```

### Getting Help

1. **Documentation**: Check `docs/` directory
2. **Issues**: Search existing GitHub issues
3. **Discussions**: Use GitHub Discussions for questions
4. **Discord**: Join the development Discord server

## Contributing Guidelines

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch from `main`
3. **Make** your changes with tests
4. **Ensure** all CI checks pass
5. **Update** documentation if needed
6. **Submit** pull request with clear description

### Code Review

- All PRs require at least one review
- Automated checks must pass
- Documentation must be updated for API changes
- Breaking changes require discussion

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for custom ITM decoders
fix: resolve WebSocket connection timeout
docs: update protocol documentation
chore: bump dependencies to latest versions
```

### Issue Templates

- **Bug Report**: Use provided template
- **Feature Request**: Describe use case and requirements
- **Documentation**: Specify what needs clarification

## Development Environment