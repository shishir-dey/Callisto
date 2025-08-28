//! # Callisto Trace - Embedded ITM Tracing Library
//! 
//! This crate provides a safe, no_std interface for sending trace data through
//! ARM Cortex-M ITM (Instrumentation Trace Macrocell) stimulus ports.
//! 
//! ## Features
//! 
//! - Zero-cost abstractions over ITM hardware
//! - Type-safe port management
//! - Support for text, markers, RTOS events, and counters
//! - Compatible with any ARM Cortex-M microcontroller
//! - Optional integration with cortex-m crate
//! 
//! ## Usage
//! 
//! ```rust,no_run
//! use callisto_trace::{Itm, Port};
//! 
//! // Initialize ITM with default port configuration
//! let mut itm = Itm::new();
//! itm.enable_ports(0x0F); // Enable ports 0-3
//! 
//! // Send text to console port
//! itm.console().puts("Hello from embedded Rust!");
//! 
//! // Send a marker
//! itm.markers().marker(42);
//! 
//! // RTOS events
//! itm.rtos().task_switch(1, 2);
//! itm.rtos().isr_enter(10);
//! itm.rtos().isr_exit(10);
//! 
//! // Performance counters
//! itm.counters().counter(1, 12345);
//! ```
//! 
//! ## Port Assignments
//! 
//! - Port 0: Console text output
//! - Port 1: RTOS events (task switches, ISR enter/exit)
//! - Port 2: Markers and timestamps
//! - Port 3: Performance counters
//! - Ports 4-31: User-defined

#![no_std]
#![deny(missing_docs)]

use core::ptr;

/// ITM base address for ARM Cortex-M
const ITM_BASE: usize = 0xE0000000;

/// ITM Trace Control Register
const ITM_TCR: *mut u32 = (ITM_BASE + 0xE80) as *mut u32;

/// ITM Trace Enable Register
const ITM_TER: *mut u32 = (ITM_BASE + 0xE00) as *mut u32;

/// Standard port assignments
pub mod ports {
    /// Console text output port
    pub const CONSOLE: u8 = 0;
    /// RTOS events port (task switches, ISR events)
    pub const RTOS: u8 = 1;
    /// Markers and timestamps port
    pub const MARKERS: u8 = 2;
    /// Performance counters port
    pub const COUNTERS: u8 = 3;
    /// First user-defined port
    pub const USER_BASE: u8 = 4;
}

/// RTOS event types
pub mod events {
    /// Task switch event
    pub const TASK_SWITCH: u8 = 0x01;
    /// ISR enter event
    pub const ISR_ENTER: u8 = 0x02;
    /// ISR exit event
    pub const ISR_EXIT: u8 = 0x03;
    /// Idle state enter event
    pub const IDLE_ENTER: u8 = 0x04;
    /// Idle state exit event
    pub const IDLE_EXIT: u8 = 0x05;
}

/// ITM stimulus port register
#[inline(always)]
fn stim_port(port: u8) -> *mut u32 {
    (ITM_BASE + 4 * port as usize) as *mut u32
}

/// Check if ITM port is ready for writing
#[inline(always)]
pub fn port_ready(port: u8) -> bool {
    unsafe { ptr::read_volatile(stim_port(port)) & 1 != 0 }
}

/// Write a 32-bit word to ITM stimulus port
#[inline(always)]
pub fn write32(port: u8, data: u32) {
    if port_ready(port) {
        unsafe {
            ptr::write_volatile(stim_port(port), data);
        }
    }
}

/// Write a byte to ITM stimulus port
#[inline(always)]
pub fn write8(port: u8, data: u8) {
    if port_ready(port) {
        unsafe {
            ptr::write_volatile(stim_port(port) as *mut u8, data);
        }
    }
}

/// ITM interface
pub struct Itm {
    _private: (),
}

impl Itm {
    /// Create a new ITM interface
    /// 
    /// # Safety
    /// 
    /// This function assumes that ITM is available and properly configured
    /// by the debugger or bootloader.
    pub fn new() -> Self {
        Self { _private: () }
    }

    /// Enable ITM and configure stimulus ports
    /// 
    /// # Arguments
    /// 
    /// * `port_mask` - Bitmask of ports to enable (bit 0 = port 0, etc.)
    /// 
    /// # Safety
    /// 
    /// This function writes to ITM control registers.
    pub unsafe fn enable_ports(&mut self, port_mask: u32) {
        // Enable ITM
        ptr::write_volatile(ITM_TCR, 0x0001000D);
        
        // Enable stimulus ports
        ptr::write_volatile(ITM_TER, port_mask);
    }

    /// Get console port interface
    pub fn console(&self) -> ConsolePort {
        ConsolePort::new()
    }

    /// Get RTOS events port interface
    pub fn rtos(&self) -> RtosPort {
        RtosPort::new()
    }

    /// Get markers port interface
    pub fn markers(&self) -> MarkersPort {
        MarkersPort::new()
    }

    /// Get counters port interface
    pub fn counters(&self) -> CountersPort {
        CountersPort::new()
    }

    /// Get a user-defined port interface
    pub fn user_port(&self, port: u8) -> UserPort {
        UserPort::new(port)
    }
}

impl Default for Itm {
    fn default() -> Self {
        Self::new()
    }
}

/// Console port for text output
pub struct ConsolePort {
    _private: (),
}

impl ConsolePort {
    fn new() -> Self {
        Self { _private: () }
    }

    /// Send a null-terminated string
    pub fn puts(&self, s: &str) {
        for byte in s.bytes() {
            write8(ports::CONSOLE, byte);
        }
        write8(ports::CONSOLE, b'\n');
    }

    /// Send a string without newline
    pub fn print(&self, s: &str) {
        for byte in s.bytes() {
            write8(ports::CONSOLE, byte);
        }
    }

    /// Send a single character
    pub fn putc(&self, c: u8) {
        write8(ports::CONSOLE, c);
    }
}

/// RTOS events port
pub struct RtosPort {
    _private: (),
}

impl RtosPort {
    fn new() -> Self {
        Self { _private: () }
    }

    /// Send a task switch event
    pub fn task_switch(&self, from_task: u32, to_task: u32) {
        if port_ready(ports::RTOS) {
            write8(ports::RTOS, events::TASK_SWITCH);
            write32(ports::RTOS, from_task);
            write32(ports::RTOS, to_task);
        }
    }

    /// Send an ISR enter event
    pub fn isr_enter(&self, isr_id: u32) {
        if port_ready(ports::RTOS) {
            write8(ports::RTOS, events::ISR_ENTER);
            write32(ports::RTOS, isr_id);
            write32(ports::RTOS, 0); // Reserved
        }
    }

    /// Send an ISR exit event
    pub fn isr_exit(&self, isr_id: u32) {
        if port_ready(ports::RTOS) {
            write8(ports::RTOS, events::ISR_EXIT);
            write32(ports::RTOS, isr_id);
            write32(ports::RTOS, 0); // Reserved
        }
    }

    /// Send an idle enter event
    pub fn idle_enter(&self) {
        if port_ready(ports::RTOS) {
            write8(ports::RTOS, events::IDLE_ENTER);
            write32(ports::RTOS, 0); // Reserved
            write32(ports::RTOS, 0); // Reserved
        }
    }

    /// Send an idle exit event
    pub fn idle_exit(&self) {
        if port_ready(ports::RTOS) {
            write8(ports::RTOS, events::IDLE_EXIT);
            write32(ports::RTOS, 0); // Reserved
            write32(ports::RTOS, 0); // Reserved
        }
    }

    /// Send a generic event
    pub fn event(&self, event_type: u8, param_a: u32, param_b: u32) {
        if port_ready(ports::RTOS) {
            write8(ports::RTOS, event_type);
            write32(ports::RTOS, param_a);
            write32(ports::RTOS, param_b);
        }
    }
}

/// Markers port
pub struct MarkersPort {
    _private: (),
}

impl MarkersPort {
    fn new() -> Self {
        Self { _private: () }
    }

    /// Send a marker with ID
    pub fn marker(&self, id: u32) {
        write32(ports::MARKERS, id);
    }

    /// Send a named marker (ID derived from name hash)
    pub fn named_marker(&self, name: &str) {
        let id = simple_hash(name);
        self.marker(id);
    }
}

/// Counters port
pub struct CountersPort {
    _private: (),
}

impl CountersPort {
    fn new() -> Self {
        Self { _private: () }
    }

    /// Send a counter value
    pub fn counter(&self, counter_id: u32, value: u64) {
        if port_ready(ports::COUNTERS) {
            write32(ports::COUNTERS, counter_id);
            write32(ports::COUNTERS, value as u32);
            write32(ports::COUNTERS, (value >> 32) as u32);
        }
    }

    /// Send a 32-bit counter value
    pub fn counter32(&self, counter_id: u32, value: u32) {
        self.counter(counter_id, value as u64);
    }
}

/// User-defined port
pub struct UserPort {
    port: u8,
}

impl UserPort {
    fn new(port: u8) -> Self {
        Self { port }
    }

    /// Write a 32-bit value
    pub fn write32(&self, data: u32) {
        write32(self.port, data);
    }

    /// Write a byte
    pub fn write8(&self, data: u8) {
        write8(self.port, data);
    }

    /// Write a slice of bytes
    pub fn write_bytes(&self, data: &[u8]) {
        for &byte in data {
            write8(self.port, byte);
        }
    }

    /// Check if port is ready
    pub fn ready(&self) -> bool {
        port_ready(self.port)
    }
}

/// Simple hash function for string IDs
fn simple_hash(s: &str) -> u32 {
    let mut hash = 0u32;
    for byte in s.bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as u32);
    }
    hash
}

/// Convenience macros for common operations
#[macro_export]
macro_rules! trace_puts {
    ($itm:expr, $s:expr) => {
        $itm.console().puts($s)
    };
}

/// Trace a marker
#[macro_export]
macro_rules! trace_marker {
    ($itm:expr, $id:expr) => {
        $itm.markers().marker($id)
    };
}

/// Trace ISR enter
#[macro_export]
macro_rules! trace_isr_enter {
    ($itm:expr, $isr:expr) => {
        $itm.rtos().isr_enter($isr)
    };
}

/// Trace ISR exit
#[macro_export]
macro_rules! trace_isr_exit {
    ($itm:expr, $isr:expr) => {
        $itm.rtos().isr_exit($isr)
    };
}

/// Global ITM instance (optional convenience)
#[cfg(feature = "cortex-m")]
static mut GLOBAL_ITM: Option<Itm> = None;

/// Initialize global ITM instance
#[cfg(feature = "cortex-m")]
pub fn init_global() -> &'static mut Itm {
    unsafe {
        if GLOBAL_ITM.is_none() {
            let mut itm = Itm::new();
            itm.enable_ports(0x0F); // Enable ports 0-3
            GLOBAL_ITM = Some(itm);
        }
        GLOBAL_ITM.as_mut().unwrap()
    }
}

/// Get global ITM instance
#[cfg(feature = "cortex-m")]
pub fn global() -> Option<&'static Itm> {
    unsafe { GLOBAL_ITM.as_ref() }
}

/// Global convenience functions
#[cfg(feature = "cortex-m")]
pub mod global {
    use super::*;

    /// Print to global console
    pub fn puts(s: &str) {
        if let Some(itm) = global() {
            itm.console().puts(s);
        }
    }

    /// Send marker to global ITM
    pub fn marker(id: u32) {
        if let Some(itm) = global() {
            itm.markers().marker(id);
        }
    }

    /// Send task switch to global ITM
    pub fn task_switch(from: u32, to: u32) {
        if let Some(itm) = global() {
            itm.rtos().task_switch(from, to);
        }
    }

    /// Send ISR enter to global ITM
    pub fn isr_enter(isr_id: u32) {
        if let Some(itm) = global() {
            itm.rtos().isr_enter(isr_id);
        }
    }

    /// Send ISR exit to global ITM
    pub fn isr_exit(isr_id: u32) {
        if let Some(itm) = global() {
            itm.rtos().isr_exit(isr_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_hash() {
        assert_eq!(simple_hash("test"), simple_hash("test"));
        assert_ne!(simple_hash("test"), simple_hash("different"));
    }

    #[test]
    fn test_port_constants() {
        assert_eq!(ports::CONSOLE, 0);
        assert_eq!(ports::RTOS, 1);
        assert_eq!(ports::MARKERS, 2);
        assert_eq!(ports::COUNTERS, 3);
    }
}