//! Callisto ITM Viewer Protocol
//! 
//! This crate defines the WebSocket message protocol between the Callisto server and client.
//! It uses serde for serialization and schemars for JSON Schema generation.

use chrono::{DateTime, Utc};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Messages sent from server to client
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", content = "data")]
pub enum ServerMessage {
    /// Initial handshake message
    Hello {
        version: String,
        server_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    /// Connection status updates
    Status {
        connected: bool,
        target: Option<String>,
        chip: Option<String>,
        probe: Option<String>,
    },
    /// Metadata about the target and configuration
    Meta {
        ports_map: HashMap<u8, PortConfig>,
        cpu_hz: Option<u64>,
        dwt_available: bool,
    },
    /// ITM trace events (decoded)
    Event {
        timestamp: u64,
        port: u8,
        event: TraceEvent,
    },
    /// Raw ITM frames (for debugging)
    Itm {
        timestamp: u64,
        frames: Vec<ItmFrame>,
    },
    /// Statistics and performance metrics
    Stats {
        timestamp: DateTime<Utc>,
        events_per_sec: f64,
        bytes_per_sec: f64,
        drop_rate: f64,
        cpu_load: Option<f64>,
    },
    /// Error messages
    Error {
        timestamp: DateTime<Utc>,
        message: String,
        code: Option<String>,
    },
}

/// Messages sent from client to server
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "type", content = "data")]
pub enum ClientMessage {
    /// Connect to a specific probe/target
    Connect {
        probe_selector: Option<String>,
        chip: Option<String>,
        token: Option<String>,
    },
    /// Start ITM tracing with port configuration
    Start {
        allow_mask: u32, // Bitmask for ports 0-31
        baud_rate: Option<u32>,
    },
    /// Stop ITM tracing
    Stop,
    /// Set filtering options
    SetFilter {
        port_mask: Option<u32>,
        event_types: Option<Vec<String>>,
    },
}

/// Configuration for an ITM port
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct PortConfig {
    pub port: u8,
    pub name: String,
    pub decoder: DecoderType,
    pub enabled: bool,
}

/// Types of decoders available for ITM ports
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub enum DecoderType {
    /// Plain text output
    Text,
    /// Marker events with IDs
    Marker,
    /// Task/ISR context switching
    TaskIsr,
    /// Performance counters
    Counter,
    /// User-defined format
    User { format: String },
}

/// Decoded trace events from ITM ports
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", content = "data")]
pub enum TraceEvent {
    /// Text message
    Text { message: String },
    /// Marker with ID
    Marker { id: u32, name: Option<String> },
    /// Task switch event
    TaskSwitch { from_task: u32, to_task: u32 },
    /// ISR enter event
    IsrEnter { isr_id: u32, name: Option<String> },
    /// ISR exit event
    IsrExit { isr_id: u32 },
    /// Idle state enter
    IdleEnter,
    /// Idle state exit
    IdleExit,
    /// Counter value
    Counter { counter_id: u32, value: u64 },
    /// Raw data (fallback)
    Raw { data: Vec<u8> },
}

/// Raw ITM frame data
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ItmFrame {
    pub port: u8,
    pub data: Vec<u8>,
    pub timestamp: Option<u64>, // DWT CYCCNT if available
}

/// Probe information for listing available probes
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ProbeInfo {
    pub identifier: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub serial_number: Option<String>,
    pub hid_interface: Option<u8>,
}

/// Default port configurations for common use cases
impl Default for PortConfig {
    fn default() -> Self {
        Self {
            port: 0,
            name: "Default".to_string(),
            decoder: DecoderType::Text,
            enabled: true,
        }
    }
}

/// Helper functions for creating common port configurations
impl PortConfig {
    pub fn text_port(port: u8, name: &str) -> Self {
        Self {
            port,
            name: name.to_string(),
            decoder: DecoderType::Text,
            enabled: true,
        }
    }

    pub fn marker_port(port: u8, name: &str) -> Self {
        Self {
            port,
            name: name.to_string(),
            decoder: DecoderType::Marker,
            enabled: true,
        }
    }

    pub fn task_port(port: u8, name: &str) -> Self {
        Self {
            port,
            name: name.to_string(),
            decoder: DecoderType::TaskIsr,
            enabled: true,
        }
    }

    pub fn counter_port(port: u8, name: &str) -> Self {
        Self {
            port,
            name: name.to_string(),
            decoder: DecoderType::Counter,
            enabled: true,
        }
    }
}

/// Standard port assignments (can be customized)
pub mod standard_ports {
    use super::*;

    pub fn default_config() -> HashMap<u8, PortConfig> {
        let mut ports = HashMap::new();
        
        // Port 0: General text output
        ports.insert(0, PortConfig::text_port(0, "Console"));
        
        // Port 1: Task/ISR events
        ports.insert(1, PortConfig::task_port(1, "RTOS Events"));
        
        // Port 2: Markers/timestamps
        ports.insert(2, PortConfig::marker_port(2, "Markers"));
        
        // Port 3: Performance counters
        ports.insert(3, PortConfig::counter_port(3, "Counters"));
        
        // Ports 4-7: User-defined
        for i in 4..8 {
            ports.insert(i, PortConfig::text_port(i, &format!("User {}", i)));
        }
        
        ports
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_serialization() {
        let hello = ServerMessage::Hello {
            version: "0.1.0".to_string(),
            server_id: Uuid::new_v4(),
            timestamp: Utc::now(),
        };

        let json = serde_json::to_string(&hello).unwrap();
        let _deserialized: ServerMessage = serde_json::from_str(&json).unwrap();
    }

    #[test]
    fn test_client_message_serialization() {
        let connect = ClientMessage::Connect {
            probe_selector: Some("VID:PID".to_string()),
            chip: Some("STM32F4xx".to_string()),
            token: None,
        };

        let json = serde_json::to_string(&connect).unwrap();
        let _deserialized: ClientMessage = serde_json::from_str(&json).unwrap();
    }
}