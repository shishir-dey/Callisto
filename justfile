# Callisto ITM Viewer - Development Commands
# 
# This justfile provides convenient commands for building, testing, and running
# the Callisto ITM viewer project.
#
# Usage: just <command>
# 
# Install just: https://github.com/casey/just

# Default recipe - show available commands
default:
    @just --list

# Development workflow
dev: typegen
    #!/usr/bin/env bash
    echo "🚀 Starting Callisto development environment..."
    
    # Start the server in background
    echo "📡 Starting server..."
    cd server && cargo run --bin callisto -- --mock &
    SERVER_PID=$!
    
    # Start the client
    echo "🖥️  Starting client..."
    cd client && pnpm dev &
    CLIENT_PID=$!
    
    # Wait for Ctrl+C
    echo "✅ Development environment running!"
    echo "   Server: http://127.0.0.1:9229/ws"
    echo "   Client: http://localhost:5173"
    echo ""
    echo "Press Ctrl+C to stop..."
    
    trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null" EXIT
    wait

# Generate TypeScript types from JSON schemas
typegen:
    @echo "🔄 Generating TypeScript types..."
    cd server/protocol && cargo run --bin generate-schemas
    cd client && pnpm typegen

# Build everything
build: typegen build-server build-client

# Build server (Rust)
build-server:
    @echo "🦀 Building Rust server..."
    cd server && cargo build --release

# Build client (Electron)
build-client: typegen
    @echo "⚛️  Building Electron client..."
    cd client && pnpm build

# Test everything
test: test-server test-client

# Test server
test-server:
    @echo "🧪 Testing Rust server..."
    cd server && cargo test

# Test client
test-client:
    @echo "🧪 Testing client..."
    cd client && pnpm test

# Lint and format
lint: lint-server lint-client

# Lint server
lint-server:
    @echo "🔍 Linting Rust code..."
    cd server && cargo fmt --check
    cd server && cargo clippy -- -D warnings

# Lint client
lint-client:
    @echo "🔍 Linting TypeScript code..."
    cd client && pnpm lint

# Format code
fmt: fmt-server fmt-client

# Format server
fmt-server:
    @echo "✨ Formatting Rust code..."
    cd server && cargo fmt

# Format client
fmt-client:
    @echo "✨ Formatting TypeScript code..."
    cd client && pnpm format

# Clean build artifacts
clean: clean-server clean-client

# Clean server
clean-server:
    @echo "🧹 Cleaning Rust artifacts..."
    cd server && cargo clean

# Clean client
clean-client:
    @echo "🧹 Cleaning client artifacts..."
    cd client && rm -rf node_modules dist dist-electron
    cd client && find . -name "node_modules" -type d -exec rm -rf {} +

# Install dependencies
install: install-server install-client

# Install server dependencies (Rust)
install-server:
    @echo "📦 Installing Rust dependencies..."
    cd server && cargo fetch

# Install client dependencies (Node.js)
install-client:
    @echo "📦 Installing Node.js dependencies..."
    cd client && pnpm install

# Run server only
server:
    @echo "📡 Starting server..."
    cd server && cargo run --bin callisto -- --mock

# Run client only (assumes server is running)
client:
    @echo "🖥️  Starting client..."
    cd client && pnpm dev

# Package Electron app for distribution
package: build-client
    @echo "📦 Packaging Electron app..."
    cd client && pnpm electron:pack

# List available probes (requires hardware)
list-probes:
    @echo "🔍 Listing available probes..."
    cd server && cargo run --bin callisto -- --list-probes

# Generate documentation
docs: docs-server docs-client

# Generate server docs
docs-server:
    @echo "📚 Generating Rust documentation..."
    cd server && cargo doc --no-deps --open

# Generate client docs
docs-client:
    @echo "📚 Generating TypeScript documentation..."
    cd client && pnpm docs

# Check project health
check: check-server check-client

# Check server
check-server:
    @echo "🔍 Checking Rust project..."
    cd server && cargo check --all-targets
    cd server && cargo audit || echo "⚠️  cargo-audit not installed, skipping security check"

# Check client
check-client:
    @echo "🔍 Checking client project..."
    cd client && pnpm audit || echo "⚠️  Some vulnerabilities found, check pnpm audit output"

# Update dependencies
update: update-server update-client

# Update server dependencies
update-server:
    @echo "⬆️  Updating Rust dependencies..."
    cd server && cargo update

# Update client dependencies
update-client:
    @echo "⬆️  Updating Node.js dependencies..."
    cd client && pnpm update

# Create a release build
release: clean typegen
    @echo "🚀 Creating release build..."
    just build-server
    just build-client
    just package
    @echo "✅ Release build complete!"

# Development setup for new contributors
setup:
    @echo "🛠️  Setting up development environment..."
    @echo "1. Installing Rust dependencies..."
    just install-server
    @echo "2. Installing Node.js dependencies..."
    just install-client
    @echo "3. Generating types..."
    just typegen
    @echo "4. Running initial build..."
    just build
    @echo "✅ Setup complete! Run 'just dev' to start development."

# Show project status
status:
    @echo "📊 Callisto Project Status"
    @echo "=========================="
    @echo ""
    @echo "🦀 Rust (Server):"
    @cd server && cargo --version
    @cd server && echo "   Workspace members: $(ls -1 | grep -E '^(protocol|core|cli)$' | wc -l)"
    @echo ""
    @echo "⚛️  Node.js (Client):"
    @node --version 2>/dev/null || echo "   Node.js not found"
    @pnpm --version 2>/dev/null || echo "   pnpm not found"
    @echo ""
    @echo "📁 Project Structure:"
    @echo "   $(find . -name "*.rs" | wc -l) Rust files"
    @echo "   $(find . -name "*.ts" -o -name "*.tsx" | wc -l) TypeScript files"
    @echo "   $(find . -name "*.json" | wc -l) JSON files"
    @echo ""
    @echo "🔧 Generated Files:"
    @echo "   Schemas: $(ls -1 schema/ws/*.json 2>/dev/null | wc -l)"
    @echo "   Types: $(ls -1 client/shared/types/src/*.d.ts 2>/dev/null | wc -l)"

# Benchmark performance
bench:
    @echo "⚡ Running benchmarks..."
    cd server && cargo bench

# Profile the application
profile:
    @echo "📊 Profiling application..."
    cd server && cargo build --release
    @echo "Run with: perf record -g ./server/target/release/callisto --mock"
    @echo "Analyze with: perf report"

# Security audit
audit:
    @echo "🔒 Running security audit..."
    cd server && cargo audit
    cd client && pnpm audit

# Watch for changes and rebuild
watch:
    @echo "👀 Watching for changes..."
    cd server && cargo watch -x "run --bin callisto -- --mock"

# Create a new release tag
tag VERSION:
    @echo "🏷️  Creating release tag v{{VERSION}}..."
    git tag -a "v{{VERSION}}" -m "Release v{{VERSION}}"
    git push origin "v{{VERSION}}"

# Show help for common tasks
help:
    @echo "🆘 Callisto Development Help"
    @echo "============================"
    @echo ""
    @echo "Quick Start:"
    @echo "  just setup    - Set up development environment"
    @echo "  just dev      - Start development servers"
    @echo ""
    @echo "Building:"
    @echo "  just build    - Build everything"
    @echo "  just release  - Create release build"
    @echo ""
    @echo "Testing:"
    @echo "  just test     - Run all tests"
    @echo "  just lint     - Lint all code"
    @echo ""
    @echo "Utilities:"
    @echo "  just typegen  - Generate TypeScript types"
    @echo "  just clean    - Clean build artifacts"
    @echo "  just status   - Show project status"
    @echo ""
    @echo "For more commands, run: just --list"