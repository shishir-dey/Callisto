# Callisto ITM Viewer Protocol

This document describes the WebSocket protocol used for communication between the Callisto server and client applications.

## Overview

The Callisto protocol is a JSON-based WebSocket protocol that enables real-time streaming of ITM (Instrumentation Trace Macrocell) data from embedded systems to visualization clients.

## Connection

- **URL**: `ws://127.0.0.1:9229/ws`
- **Protocol**: WebSocket with JSON messages
- **Authentication**: Optional Bearer token via `Authorization` header

## Message Format

All messages are JSON objects with a `type` field indicating the message type and a `data` field containing the payload.

```json
{
  "type": "MessageType",
  "data": { ... }
}
```

## Server → Client Messages

### Hello

Sent immediately after connection establishment.

```json
{
  "type": "Hello",
  "data": {
    "version": "0.1.0",
    "server_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2023-12-07T10:30:00Z"
  }
}
```

### Status

Connection and target status updates.

```json
{
  "type": "Status",
  "data": {
    "connected": true,
    "target": "STM32F4xx",
    "chip": "STM32F407VG",
    "probe": "ST-Link V2"
  }
}
```

### Meta

Metadata about the target configuration.

```json
{
  "type": "Meta",
  "data": {
    "ports_map": {
      "0": {
        "port": 0,
        "name": "Console",
        "decoder": "Text",
        "enabled": true
      },
      "1": {
        "port": 1,
        "name": "RTOS Events",
        "decoder": "TaskIsr",
        "enabled": true
      }
    },
    "cpu_hz": 168000000,
    "dwt_available": true
  }
}
```

### Event

ITM trace events (decoded).

```json
{
  "type": "Event",
  "data": {
    "timestamp": 1234567890,
    "port": 0,
    "event": {
      "kind": "Text",
      "data": {
        "message": "Hello World!"
      }
    }
  }
}
```

### ITM

Raw ITM frames (for debugging).

```json
{
  "type": "Itm",
  "data": {
    "timestamp": 1234567890,
    "frames": [
      {
        "port": 0,
        "data": [72, 101, 108, 108, 111],
        "timestamp": 1234567890
      }
    ]
  }
}
```

### Stats

Performance statistics.

```json
{
  "type": "Stats",
  "data": {
    "timestamp": "2023-12-07T10:30:00Z",
    "events_per_sec": 1250.5,
    "bytes_per_sec": 5120.0,
    "drop_rate": 0.001,
    "cpu_load": 0.45
  }
}
```

### Error

Error messages.

```json
{
  "type": "Error",
  "data": {
    "timestamp": "2023-12-07T10:30:00Z",
    "message": "Failed to connect to probe",
    "code": "PROBE_NOT_FOUND"
  }
}
```

## Client → Server Messages

### Connect

Request connection to a probe/target.

```json
{
  "type": "Connect",
  "data": {
    "probe_selector": "VID:PID:0483:374B",
    "chip": "STM32F407VG",
    "token": "optional-auth-token"
  }
}
```

### Start

Start ITM tracing with configuration.

```json
{
  "type": "Start",
  "data": {
    "allow_mask": 4294967295,
    "baud_rate": 2000000
  }
}
```

- `allow_mask`: 32-bit bitmask for enabled ports (bit 0 = port 0, etc.)
- `baud_rate`: ITM baud rate in Hz

### Stop

Stop ITM tracing.

```json
{
  "type": "Stop"
}
```

### SetFilter

Configure filtering options.

```json
{
  "type": "SetFilter",
  "data": {
    "port_mask": 15,
    "event_types": ["Text", "Marker", "TaskSwitch"]
  }
}
```

## ITM Port Map (0-31)

### Standard Assignments

| Port | Name | Decoder | Purpose |
|------|------|---------|---------|
| 0 | Console | Text | General text output |
| 1 | RTOS Events | TaskIsr | Task switches, ISR events |
| 2 | Markers | Marker | Timestamped markers |
| 3 | Counters | Counter | Performance counters |
| 4-7 | User | Text/User | User-defined |
| 8-31 | Reserved | - | Available for custom use |

### Port Configuration

Each port can be configured with:

- **Name**: Human-readable identifier
- **Decoder**: How to interpret the data
- **Enabled**: Whether the port is active

### Decoder Types

#### Text
Plain text messages, typically null-terminated strings.

#### Marker
32-bit marker IDs with optional names:
```json
{
  "kind": "Marker",
  "data": {
    "id": 42,
    "name": "Checkpoint A"
  }
}
```

#### TaskIsr
RTOS events with structured data:

**Task Switch:**
```json
{
  "kind": "TaskSwitch",
  "data": {
    "from_task": 1,
    "to_task": 2
  }
}
```

**ISR Enter:**
```json
{
  "kind": "IsrEnter",
  "data": {
    "isr_id": 10,
    "name": "TIM1_IRQHandler"
  }
}
```

**ISR Exit:**
```json
{
  "kind": "IsrExit",
  "data": {
    "isr_id": 10
  }
}
```

**Idle State:**
```json
{
  "kind": "IdleEnter"
}
```

#### Counter
Performance counter values:
```json
{
  "kind": "Counter",
  "data": {
    "counter_id": 1,
    "value": 12345678
  }
}
```

#### User
Custom format specified by format string.

## Event Formats

### Binary Protocol (ITM Stimulus Ports)

#### RTOS Events (Port 1)
```
Byte 0: Event Type
  0x01 = Task Switch
  0x02 = ISR Enter  
  0x03 = ISR Exit
  0x04 = Idle Enter
  0x05 = Idle Exit

Bytes 1-4: Parameter A (little-endian)
Bytes 5-8: Parameter B (little-endian)
```

#### Markers (Port 2)
```
Bytes 0-3: Marker ID (little-endian)
```

#### Counters (Port 3)
```
Bytes 0-3: Counter ID (little-endian)
Bytes 4-11: Counter Value (little-endian, 64-bit)
```

## Timestamps

### DWT CYCCNT (Preferred)
When available, timestamps use the ARM DWT CYCCNT register:
- Unit: CPU cycles
- Resolution: 1 cycle
- Rollover: ~25 seconds at 168MHz

### Host Monotonic (Fallback)
When DWT is unavailable:
- Unit: Microseconds
- Resolution: System dependent
- Synchronized with periodic clock_sync messages

## Error Handling

### Connection Errors
- `PROBE_NOT_FOUND`: No matching probe detected
- `PROBE_IN_USE`: Probe already in use by another process
- `TARGET_NOT_RESPONDING`: Target device not responding
- `PERMISSION_DENIED`: Insufficient permissions to access probe

### Protocol Errors
- `INVALID_MESSAGE`: Malformed JSON or unknown message type
- `INVALID_PARAMETERS`: Invalid parameters in message
- `NOT_CONNECTED`: Operation requires active connection
- `ALREADY_TRACING`: Tracing already active

### ITM Errors
- `ITM_NOT_ENABLED`: ITM not enabled on target
- `BAUD_RATE_ERROR`: Invalid or unsupported baud rate
- `PORT_NOT_AVAILABLE`: Requested port not available
- `BUFFER_OVERFLOW`: Internal buffer overflow

## Performance Considerations

### Throughput
- Maximum theoretical: ~2MB/s at 2MHz ITM clock
- Practical limit: ~500KB/s with USB 2.0 debug probes
- Recommended: <100KB/s for stable operation

### Latency
- ITM hardware: <1ms
- USB transport: 1-8ms
- WebSocket: <1ms local
- Total typical: 2-10ms

### Backpressure
The server implements backpressure handling:
1. Client-side buffering (1MB default)
2. Drop rate monitoring
3. Automatic flow control
4. Statistics reporting

## Example Session

```javascript
// Connect to server
const ws = new WebSocket('ws://127.0.0.1:9229/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'Hello':
      console.log('Connected to server:', message.data.version);
      // Request connection to probe
      ws.send(JSON.stringify({
        type: 'Connect',
        data: { probe_selector: null, chip: null, token: null }
      }));
      break;
      
    case 'Status':
      if (message.data.connected) {
        // Start tracing all ports
        ws.send(JSON.stringify({
          type: 'Start',
          data: { allow_mask: 0xFFFFFFFF, baud_rate: 2000000 }
        }));
      }
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

## Schema Validation

JSON schemas are available in `schema/ws/` for validation:
- `server-message.json`: Server → Client messages
- `client-message.json`: Client → Server messages  
- `protocol.json`: Combined schema

Use with libraries like `ajv` for runtime validation:

```javascript
import Ajv from 'ajv';
import serverSchema from './schema/ws/server-message.json';

const ajv = new Ajv();
const validate = ajv.compile(serverSchema);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (!validate(message)) {
    console.error('Invalid message:', validate.errors);
    return;
  }
  // Process valid message...
};