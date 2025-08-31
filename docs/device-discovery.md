# Device Discovery and Management

This document describes the device discovery system and UI enhancements in Callisto ITM Viewer.

## Overview

Callisto now features comprehensive device discovery capabilities that automatically detect connected debug probes and provide a modern interface for device selection and management.

## Device Discovery System

### Automatic Detection

The server uses probe-rs to automatically scan for connected debug probes:

```rust
// Server-side device discovery
let probes = probe_rs::Probe::list_all();
for probe in probes {
    devices.push(Device {
        id: format!("probe_{}", probe.serial_number()),
        name: format!("{} ({})", probe.name(), probe.serial_number()),
        type: DeviceType::Real,
    });
}
```

### Supported Probe Types

- **ST-Link V2/V3**: STMicroelectronics debug probes
- **J-Link**: Segger debug probes (all models)
- **CMSIS-DAP**: ARM standard debug interface
- **Black Magic Probe**: Open source debug probe
- **Custom Probes**: Any probe-rs supported device

### Mock Device Support

For development and testing without hardware:

```javascript
const mockDevice = {
  id: 'mock',
  name: 'Mock Device',
  type: 'mock'
};
```

## Device Selection UI

### Modal Interface

The device selection modal provides:

- **Visual Indicators**: 🎭 for mock devices, 🔌 for real probes
- **Device Information**: Name, type, and capabilities
- **Real-time Scanning**: Refresh button to re-scan for devices
- **Loading States**: Visual feedback during device discovery
- **Theme Support**: Consistent with light/dark theme system

### User Experience

1. **Startup**: Modal appears automatically on application launch
2. **Selection**: Click on desired device to select
3. **Connection**: Click "Connect" to establish communication
4. **Switching**: Use toolbar button to change devices anytime

## Server Management

### Lifecycle Management

The server handles device switching gracefully:

```typescript
// Client-side device switching
const handleDeviceSelect = async (device: Device) => {
  const result = await electronAPI.restartServerWithDevice(device.type);
  if (result.success) {
    // Connect WebSocket to new server instance
    connectWebSocket();
  }
};
```

### Conflict Resolution

- **External Server Detection**: Checks if server is already running
- **Port Conflict Handling**: Graceful handling of address-in-use errors
- **Process Management**: Clean shutdown and restart of server processes

### Error Handling

- **Device Unavailable**: Fallback to mock device if hardware fails
- **Connection Timeout**: Automatic retry with exponential backoff
- **Permission Issues**: Clear error messages for access problems

## UI Enhancements

### Theme System

Complete light/dark theme support:

```css
:root {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --bg-card: #2d2d2d;
  --border-color: #404040;
  --text-primary: #ffffff;
  --text-secondary: #cccccc;
  --accent-color: #007aff;
}

[data-theme="light"] {
  --bg-primary: #f5f5f5;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --border-color: #e0e0e0;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent-color: #007aff;
}
```

### Card-Based Layout

Modern card design for better visual separation:

- **Timeline Card**: ITM event stream with bordered container
- **Performance Card**: CPU load and statistics with distinct styling
- **Shadows and Borders**: Subtle depth and clear boundaries
- **Responsive Design**: Adapts to different window sizes

### Title Bar Fix

Resolved content overlap issues:

- **Default Title Bar**: Uses system-native title bar styling
- **Content Spacing**: Proper padding to prevent overlap
- **Cross-Platform**: Consistent behavior on all operating systems

## API Reference

### IPC Handlers

#### `get-available-devices`

Scans for connected debug probes:

```typescript
interface DeviceResponse {
  success: boolean;
  devices: Device[];
}

const devices = await electronAPI.getAvailableDevices();
```

#### `restart-server-with-device`

Restarts server with specific device type:

```typescript
interface RestartResponse {
  success: boolean;
  error?: string;
}

const result = await electronAPI.restartServerWithDevice('mock' | 'real');
```

### Device Interface

```typescript
interface Device {
  id: string;           // Unique device identifier
  name: string;         // Human-readable device name
  type: 'mock' | 'real'; // Device type indicator
}
```

## Configuration

### Server Arguments

- `--mock`: Start with mock device (simulated data)
- `--probe`: Start with real probe detection
- `--list-probes`: List available devices and exit

### Environment Variables

- `RUST_LOG=debug`: Enable detailed logging
- `CALLISTO_PORT=9229`: Override default WebSocket port
- `CALLISTO_MOCK_EVENTS=1000`: Mock event generation rate

## Troubleshooting

### Device Detection Issues

**No devices found:**
```bash
# Check probe-rs installation
cargo install probe-rs --features cli

# List probes manually
probe-rs list

# Check USB permissions (Linux)
sudo usermod -a -G plugdev $USER
```

**Device connection fails:**
```bash
# Check device is not in use
lsof /dev/ttyACM* /dev/ttyUSB*

# Restart udev rules (Linux)
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### UI Issues

**Theme not switching:**
- Hard refresh Electron app (Ctrl+Shift+R)
- Check CSS variables in DevTools
- Clear application cache

**Modal not appearing:**
- Check console for JavaScript errors
- Verify IPC communication is working
- Restart application

### Server Issues

**Port conflicts:**
```bash
# Kill existing processes
pkill -f callisto
lsof -ti:9229 | xargs kill -9

# Clean restart
just clean && just dev
```

**Permission denied:**
```bash
# Linux: Add user to dialout group
sudo usermod -a -G dialout $USER

# macOS: Check System Preferences > Security & Privacy
# Windows: Run as administrator if needed
```

## Development

### Adding New Device Types

1. **Extend Device Interface**:
```typescript
type DeviceType = 'mock' | 'real' | 'custom';
```

2. **Update Server Detection**:
```rust
// Add custom device detection logic
if let Ok(custom_devices) = detect_custom_devices() {
    devices.extend(custom_devices);
}
```

3. **Update UI Icons**:
```typescript
const getDeviceIcon = (type: DeviceType) => {
  switch (type) {
    case 'mock': return '🎭';
    case 'real': return '🔌';
    case 'custom': return '⚡';
  }
};
```

### Testing Device Discovery

```bash
# Test with mock devices only
CALLISTO_MOCK_ONLY=1 just dev

# Test with specific probe types
CALLISTO_PROBE_FILTER="ST-Link" just dev

# Test error conditions
CALLISTO_SIMULATE_ERRORS=1 just dev
```

## Future Enhancements

### Planned Features

- **Multiple Device Support**: Connect to multiple probes simultaneously
- **Device Profiles**: Save and restore device-specific configurations
- **Advanced Filtering**: Filter devices by type, manufacturer, or capabilities
- **Remote Devices**: Support for network-connected debug probes

### API Extensions

- **Device Capabilities**: Query supported features per device
- **Connection Status**: Real-time device connection monitoring
- **Performance Metrics**: Per-device throughput and latency stats
- **Configuration Sync**: Automatic device-specific settings

## Best Practices

### For Users

1. **Always scan for devices** before assuming none are available
2. **Use mock device** for development and testing
3. **Check device permissions** if detection fails
4. **Restart application** if device switching fails

### For Developers

1. **Handle device unavailability** gracefully
2. **Provide clear error messages** for device issues
3. **Test with both mock and real devices**
4. **Log device operations** for debugging

## Related Documentation

- [Architecture Overview](architecture.md)
- [Development Workflow](dev-workflow.md)
- [Protocol Specification](protocol.md)
- [Hardware Support](../README.md#hardware-support)