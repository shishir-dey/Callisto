//! ITM port decoders for different data types

use callisto_protocol::TraceEvent;
use anyhow::Result;

/// Trait for ITM port decoders
pub trait ItmDecoder {
    fn decode(&mut self, port: u8, data: &[u8], timestamp: u64) -> Result<Vec<TraceEvent>>;
    fn reset(&mut self);
}

/// Text decoder for string data
pub struct TextDecoder {
    buffer: String,
}

impl TextDecoder {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
        }
    }
}

impl ItmDecoder for TextDecoder {
    fn decode(&mut self, _port: u8, data: &[u8], _timestamp: u64) -> Result<Vec<TraceEvent>> {
        let text = String::from_utf8_lossy(data);
        self.buffer.push_str(&text);
        
        let mut events = Vec::new();
        
        // Split on newlines and emit complete messages
        while let Some(pos) = self.buffer.find('\n') {
            let message = self.buffer[..pos].to_string();
            self.buffer.drain(..=pos);
            
            if !message.trim().is_empty() {
                events.push(TraceEvent::Text { message });
            }
        }
        
        Ok(events)
    }

    fn reset(&mut self) {
        self.buffer.clear();
    }
}

/// Marker decoder for timestamped events
pub struct MarkerDecoder;

impl MarkerDecoder {
    pub fn new() -> Self {
        Self
    }
}

impl ItmDecoder for MarkerDecoder {
    fn decode(&mut self, _port: u8, data: &[u8], _timestamp: u64) -> Result<Vec<TraceEvent>> {
        if data.len() >= 4 {
            let id = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
            Ok(vec![TraceEvent::Marker { 
                id, 
                name: Some(format!("Marker {}", id))
            }])
        } else {
            Ok(vec![])
        }
    }

    fn reset(&mut self) {
        // No state to reset
    }
}

/// Task/ISR decoder for RTOS events
pub struct TaskIsrDecoder;

impl TaskIsrDecoder {
    pub fn new() -> Self {
        Self
    }
}

impl ItmDecoder for TaskIsrDecoder {
    fn decode(&mut self, _port: u8, data: &[u8], _timestamp: u64) -> Result<Vec<TraceEvent>> {
        if data.len() >= 9 {
            let event_type = data[0];
            let param_a = u32::from_le_bytes([data[1], data[2], data[3], data[4]]);
            let param_b = u32::from_le_bytes([data[5], data[6], data[7], data[8]]);
            
            let event = match event_type {
                0x01 => TraceEvent::TaskSwitch { from_task: param_a, to_task: param_b },
                0x02 => TraceEvent::IsrEnter { isr_id: param_a, name: Some(format!("ISR {}", param_a)) },
                0x03 => TraceEvent::IsrExit { isr_id: param_a },
                0x04 => TraceEvent::IdleEnter,
                0x05 => TraceEvent::IdleExit,
                _ => TraceEvent::Raw { data: data.to_vec() },
            };
            
            Ok(vec![event])
        } else {
            Ok(vec![])
        }
    }

    fn reset(&mut self) {
        // No state to reset
    }
}

/// Counter decoder for performance metrics
pub struct CounterDecoder;

impl CounterDecoder {
    pub fn new() -> Self {
        Self
    }
}

impl ItmDecoder for CounterDecoder {
    fn decode(&mut self, _port: u8, data: &[u8], _timestamp: u64) -> Result<Vec<TraceEvent>> {
        if data.len() >= 12 {
            let counter_id = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
            let value = u64::from_le_bytes([
                data[4], data[5], data[6], data[7],
                data[8], data[9], data[10], data[11]
            ]);
            
            Ok(vec![TraceEvent::Counter { counter_id, value }])
        } else {
            Ok(vec![])
        }
    }

    fn reset(&mut self) {
        // No state to reset
    }
}