//! Mock data generator for testing and demonstration

use callisto_protocol::{ServerMessage, TraceEvent};
use chrono::Utc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::debug;

/// Mock data generator for testing the UI without hardware
pub struct MockDataGenerator {
    sender: mpsc::UnboundedSender<ServerMessage>,
    start_time: Instant,
    task_counter: u32,
    marker_counter: u32,
}

impl MockDataGenerator {
    pub fn new(sender: mpsc::UnboundedSender<ServerMessage>) -> Self {
        Self {
            sender,
            start_time: Instant::now(),
            task_counter: 0,
            marker_counter: 0,
        }
    }

    /// Start generating mock data
    pub async fn start(&mut self) {
        debug!("Starting mock data generation");
        
        let mut interval = tokio::time::interval(Duration::from_millis(100));
        
        loop {
            interval.tick().await;
            
            let timestamp = self.start_time.elapsed().as_micros() as u64;
            
            // Generate various types of events
            if self.task_counter % 10 == 0 {
                self.send_task_switch_event(timestamp).await;
            }
            
            if self.task_counter % 15 == 0 {
                self.send_marker_event(timestamp).await;
            }
            
            if self.task_counter % 20 == 0 {
                self.send_text_event(timestamp).await;
            }
            
            if self.task_counter % 25 == 0 {
                self.send_isr_event(timestamp).await;
            }
            
            if self.task_counter % 50 == 0 {
                self.send_counter_event(timestamp).await;
            }
            
            if self.task_counter % 100 == 0 {
                self.send_stats_update().await;
            }
            
            self.task_counter += 1;
            
            // Add some randomness to timing
            if self.task_counter % 7 == 0 {
                sleep(Duration::from_millis(50)).await;
            }
        }
    }

    async fn send_task_switch_event(&mut self, timestamp: u64) {
        let from_task = (self.task_counter % 4) + 1;
        let to_task = ((self.task_counter + 1) % 4) + 1;
        
        let event = ServerMessage::Event {
            timestamp,
            port: 1,
            event: TraceEvent::TaskSwitch { from_task, to_task },
        };
        
        let _ = self.sender.send(event);
    }

    async fn send_marker_event(&mut self, timestamp: u64) {
        self.marker_counter += 1;
        
        let event = ServerMessage::Event {
            timestamp,
            port: 2,
            event: TraceEvent::Marker {
                id: self.marker_counter,
                name: Some(format!("Checkpoint {}", self.marker_counter)),
            },
        };
        
        let _ = self.sender.send(event);
    }

    async fn send_text_event(&mut self, timestamp: u64) {
        let messages = [
            "System initialized",
            "Processing data...",
            "Task completed successfully",
            "Warning: Low memory",
            "Debug: Function called",
        ];
        
        let message = messages[self.task_counter as usize % messages.len()].to_string();
        
        let event = ServerMessage::Event {
            timestamp,
            port: 0,
            event: TraceEvent::Text { message },
        };
        
        let _ = self.sender.send(event);
    }

    async fn send_isr_event(&mut self, timestamp: u64) {
        let isr_id = (self.task_counter % 3) + 10; // ISR IDs 10, 11, 12
        
        // Send ISR enter
        let enter_event = ServerMessage::Event {
            timestamp,
            port: 1,
            event: TraceEvent::IsrEnter {
                isr_id,
                name: Some(format!("Timer{}", isr_id - 9)),
            },
        };
        let _ = self.sender.send(enter_event);
        
        // Send ISR exit after a short delay
        let exit_event = ServerMessage::Event {
            timestamp: timestamp + 500, // 500 microseconds later
            port: 1,
            event: TraceEvent::IsrExit { isr_id },
        };
        let _ = self.sender.send(exit_event);
    }

    async fn send_counter_event(&mut self, timestamp: u64) {
        let counter_id = 1;
        let value = (self.task_counter as u64 * 1000) + (timestamp % 1000);
        
        let event = ServerMessage::Event {
            timestamp,
            port: 3,
            event: TraceEvent::Counter { counter_id, value },
        };
        
        let _ = self.sender.send(event);
    }

    async fn send_stats_update(&mut self) {
        let stats = ServerMessage::Stats {
            timestamp: Utc::now(),
            events_per_sec: 50.0 + (self.task_counter as f64 % 20.0),
            bytes_per_sec: 1024.0 + (self.task_counter as f64 * 10.0 % 500.0),
            drop_rate: if self.task_counter % 200 == 0 { 0.1 } else { 0.0 },
            cpu_load: Some(0.3 + (self.task_counter as f64 % 100.0) / 200.0),
        };
        
        let _ = self.sender.send(stats);
    }
}