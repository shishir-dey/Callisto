//! Probe management and probe-rs integration

use anyhow::Result;
use callisto_protocol::ProbeInfo;
use tracing::{debug, info, warn};

/// Manages probe connections and ITM data collection
pub struct ProbeManager {
    active_session: Option<ProbeSession>,
}

/// Active probe session
pub struct ProbeSession {
    // TODO: Add probe-rs session fields
    pub connected: bool,
    pub target: Option<String>,
    pub chip: Option<String>,
}

impl ProbeManager {
    pub fn new() -> Self {
        Self {
            active_session: None,
        }
    }

    /// List available probes
    pub async fn list_probes() -> Result<Vec<ProbeInfo>> {
        // TODO: Implement with probe-rs
        info!("Listing available probes");
        
        // Mock probe for now
        Ok(vec![ProbeInfo {
            identifier: "mock:0001".to_string(),
            vendor_id: 0x1234,
            product_id: 0x5678,
            serial_number: Some("MOCK001".to_string()),
            hid_interface: None,
        }])
    }

    /// Start a new probe session
    pub async fn start_session(&mut self, allow_mask: u32, baud_rate: Option<u32>) -> Result<()> {
        info!("Starting probe session with mask: 0x{:08x}, baud: {:?}", allow_mask, baud_rate);
        
        // TODO: Implement probe-rs connection
        // For now, create a mock session
        self.active_session = Some(ProbeSession {
            connected: true,
            target: Some("Mock Target".to_string()),
            chip: Some("STM32F4xx".to_string()),
        });

        Ok(())
    }

    /// Stop the current probe session
    pub async fn stop_session(&mut self) -> Result<()> {
        info!("Stopping probe session");
        self.active_session = None;
        Ok(())
    }

    /// Check if a session is active
    pub fn is_connected(&self) -> bool {
        self.active_session.as_ref().map_or(false, |s| s.connected)
    }

    /// Get current session info
    pub fn get_session_info(&self) -> Option<&ProbeSession> {
        self.active_session.as_ref()
    }
}

impl Default for ProbeManager {
    fn default() -> Self {
        Self::new()
    }
}