//! Callisto Core
//! 
//! This crate provides the core functionality for ITM trace collection and processing.
//! It handles probe-rs integration, ITM decoding, and event batching.

use callisto_protocol::*;
use anyhow::Result;
use std::collections::HashMap;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

pub mod probe;
pub mod itm;
pub mod decoder;
pub mod mock;

pub use probe::*;
pub use itm::*;
pub use decoder::*;
pub use mock::*;

/// Core ITM session manager
pub struct ItmSession {
    probe_manager: ProbeManager,
    decoders: HashMap<u8, Box<dyn ItmDecoder + Send>>,
    event_sender: mpsc::UnboundedSender<ServerMessage>,
    stats: SessionStats,
}

/// Session statistics
#[derive(Debug, Default)]
pub struct SessionStats {
    pub events_processed: u64,
    pub bytes_processed: u64,
    pub dropped_events: u64,
    pub start_time: Option<std::time::Instant>,
}

impl ItmSession {
    pub fn new(event_sender: mpsc::UnboundedSender<ServerMessage>) -> Self {
        Self {
            probe_manager: ProbeManager::new(),
            decoders: HashMap::new(),
            event_sender,
            stats: SessionStats::default(),
        }
    }

    pub async fn start_tracing(&mut self, allow_mask: u32, baud_rate: Option<u32>) -> Result<()> {
        info!("Starting ITM tracing with port mask: 0x{:08x}", allow_mask);
        
        // Initialize decoders for enabled ports
        self.setup_decoders(allow_mask);
        
        // Start probe session (placeholder for now)
        self.probe_manager.start_session(allow_mask, baud_rate).await?;
        
        self.stats.start_time = Some(std::time::Instant::now());
        Ok(())
    }

    pub async fn stop_tracing(&mut self) -> Result<()> {
        info!("Stopping ITM tracing");
        self.probe_manager.stop_session().await?;
        Ok(())
    }

    fn setup_decoders(&mut self, allow_mask: u32) {
        self.decoders.clear();
        
        for port in 0..32 {
            if (allow_mask & (1 << port)) != 0 {
                let decoder: Box<dyn ItmDecoder + Send> = match port {
                    0 => Box::new(TextDecoder::new()),
                    1 => Box::new(TaskIsrDecoder::new()),
                    2 => Box::new(MarkerDecoder::new()),
                    3 => Box::new(CounterDecoder::new()),
                    _ => Box::new(TextDecoder::new()),
                };
                self.decoders.insert(port, decoder);
            }
        }
    }

    pub fn get_stats(&self) -> SessionStats {
        // Return a copy of current stats
        SessionStats {
            events_processed: self.stats.events_processed,
            bytes_processed: self.stats.bytes_processed,
            dropped_events: self.stats.dropped_events,
            start_time: self.stats.start_time,
        }
    }
}