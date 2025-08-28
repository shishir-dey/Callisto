/**
 * @file callisto_trace.h
 * @brief Callisto ITM Tracing Library for Embedded Systems
 * 
 * This header provides a simple interface for sending trace data through
 * ARM Cortex-M ITM (Instrumentation Trace Macrocell) stimulus ports.
 * 
 * Usage:
 *   #include "callisto_trace.h"
 *   
 *   // Initialize tracing (call once at startup)
 *   callisto_trace_init();
 *   
 *   // Send text messages
 *   callisto_puts("Hello from embedded system!");
 *   
 *   // Send markers
 *   callisto_marker(42);
 *   
 *   // Task/ISR events
 *   callisto_task_switch(1, 2);  // from task 1 to task 2
 *   callisto_isr_enter(10);      // ISR 10 entered
 *   callisto_isr_exit(10);       // ISR 10 exited
 *   
 *   // Idle state tracking
 *   callisto_idle_enter();
 *   callisto_idle_exit();
 * 
 * @author Callisto ITM Viewer
 * @version 0.1.0
 */

#ifndef CALLISTO_TRACE_H
#define CALLISTO_TRACE_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// ITM register definitions for ARM Cortex-M
#ifndef ITM_BASE
#define ITM_BASE            (0xE0000000UL)
#endif

#define ITM_STIM_PORT(n)    (*(volatile uint32_t*)(ITM_BASE + 4 * (n)))
#define ITM_TER             (*(volatile uint32_t*)(ITM_BASE + 0xE00))
#define ITM_TCR             (*(volatile uint32_t*)(ITM_BASE + 0xE80))

// Standard port assignments
#define CALLISTO_PORT_CONSOLE   0   ///< Text console output
#define CALLISTO_PORT_RTOS      1   ///< RTOS events (task/ISR)
#define CALLISTO_PORT_MARKERS   2   ///< Markers and timestamps
#define CALLISTO_PORT_COUNTERS  3   ///< Performance counters
#define CALLISTO_PORT_USER_BASE 4   ///< User-defined ports start here

// Event type definitions for RTOS port
#define CALLISTO_EVT_TASK_SWITCH    0x01
#define CALLISTO_EVT_ISR_ENTER      0x02
#define CALLISTO_EVT_ISR_EXIT       0x03
#define CALLISTO_EVT_IDLE_ENTER     0x04
#define CALLISTO_EVT_IDLE_EXIT      0x05

/**
 * @brief Initialize ITM tracing
 * 
 * Enables ITM and configures stimulus ports. Call this once at system startup.
 * 
 * @param port_mask Bitmask of ports to enable (default: 0x0F for ports 0-3)
 */
static inline void callisto_trace_init(uint32_t port_mask)
{
    // Enable ITM
    ITM_TCR = 0x0001000D;
    
    // Enable stimulus ports
    ITM_TER = port_mask;
}

/**
 * @brief Check if ITM port is ready for writing
 * 
 * @param port Port number (0-31)
 * @return 1 if ready, 0 if busy
 */
static inline int callisto_port_ready(uint8_t port)
{
    return (ITM_STIM_PORT(port) & 1) != 0;
}

/**
 * @brief Write a 32-bit word to ITM stimulus port
 * 
 * @param port Port number (0-31)
 * @param data 32-bit data to write
 */
static inline void callisto_write32(uint8_t port, uint32_t data)
{
    if (callisto_port_ready(port)) {
        ITM_STIM_PORT(port) = data;
    }
}

/**
 * @brief Write a byte to ITM stimulus port
 * 
 * @param port Port number (0-31)
 * @param data Byte to write
 */
static inline void callisto_write8(uint8_t port, uint8_t data)
{
    if (callisto_port_ready(port)) {
        *(volatile uint8_t*)&ITM_STIM_PORT(port) = data;
    }
}

/**
 * @brief Send a null-terminated string to console port
 * 
 * @param str String to send
 */
static inline void callisto_puts(const char* str)
{
    if (!str) return;
    
    while (*str) {
        callisto_write8(CALLISTO_PORT_CONSOLE, *str);
        str++;
    }
    callisto_write8(CALLISTO_PORT_CONSOLE, '\n');
}

/**
 * @brief Send a marker event
 * 
 * @param id Marker ID (0-4294967295)
 */
static inline void callisto_marker(uint32_t id)
{
    callisto_write32(CALLISTO_PORT_MARKERS, id);
}

/**
 * @brief Send a task switch event
 * 
 * @param from_task Previous task ID
 * @param to_task New task ID
 */
static inline void callisto_task_switch(uint32_t from_task, uint32_t to_task)
{
    if (callisto_port_ready(CALLISTO_PORT_RTOS)) {
        callisto_write8(CALLISTO_PORT_RTOS, CALLISTO_EVT_TASK_SWITCH);
        callisto_write32(CALLISTO_PORT_RTOS, from_task);
        callisto_write32(CALLISTO_PORT_RTOS, to_task);
    }
}

/**
 * @brief Send an ISR enter event
 * 
 * @param isr_id ISR number
 */
static inline void callisto_isr_enter(uint32_t isr_id)
{
    if (callisto_port_ready(CALLISTO_PORT_RTOS)) {
        callisto_write8(CALLISTO_PORT_RTOS, CALLISTO_EVT_ISR_ENTER);
        callisto_write32(CALLISTO_PORT_RTOS, isr_id);
        callisto_write32(CALLISTO_PORT_RTOS, 0); // Reserved
    }
}

/**
 * @brief Send an ISR exit event
 * 
 * @param isr_id ISR number
 */
static inline void callisto_isr_exit(uint32_t isr_id)
{
    if (callisto_port_ready(CALLISTO_PORT_RTOS)) {
        callisto_write8(CALLISTO_PORT_RTOS, CALLISTO_EVT_ISR_EXIT);
        callisto_write32(CALLISTO_PORT_RTOS, isr_id);
        callisto_write32(CALLISTO_PORT_RTOS, 0); // Reserved
    }
}

/**
 * @brief Send an idle enter event
 */
static inline void callisto_idle_enter(void)
{
    if (callisto_port_ready(CALLISTO_PORT_RTOS)) {
        callisto_write8(CALLISTO_PORT_RTOS, CALLISTO_EVT_IDLE_ENTER);
        callisto_write32(CALLISTO_PORT_RTOS, 0); // Reserved
        callisto_write32(CALLISTO_PORT_RTOS, 0); // Reserved
    }
}

/**
 * @brief Send an idle exit event
 */
static inline void callisto_idle_exit(void)
{
    if (callisto_port_ready(CALLISTO_PORT_RTOS)) {
        callisto_write8(CALLISTO_PORT_RTOS, CALLISTO_EVT_IDLE_EXIT);
        callisto_write32(CALLISTO_PORT_RTOS, 0); // Reserved
        callisto_write32(CALLISTO_PORT_RTOS, 0); // Reserved
    }
}

/**
 * @brief Send a counter value
 * 
 * @param counter_id Counter identifier
 * @param value Counter value
 */
static inline void callisto_counter(uint32_t counter_id, uint64_t value)
{
    if (callisto_port_ready(CALLISTO_PORT_COUNTERS)) {
        callisto_write32(CALLISTO_PORT_COUNTERS, counter_id);
        callisto_write32(CALLISTO_PORT_COUNTERS, (uint32_t)(value & 0xFFFFFFFF));
        callisto_write32(CALLISTO_PORT_COUNTERS, (uint32_t)(value >> 32));
    }
}

/**
 * @brief Generic event sender
 * 
 * @param port Port number
 * @param event_type Event type byte
 * @param param_a First parameter
 * @param param_b Second parameter
 */
static inline void callisto_event(uint8_t port, uint8_t event_type, uint32_t param_a, uint32_t param_b)
{
    if (callisto_port_ready(port)) {
        callisto_write8(port, event_type);
        callisto_write32(port, param_a);
        callisto_write32(port, param_b);
    }
}

// Convenience macros for common use cases

/**
 * @brief ISR enter macro - use at the beginning of ISR handlers
 * 
 * Example:
 *   void TIM1_IRQHandler(void) {
 *       CALLISTO_ISR_ENTER(TIM1_IRQn);
 *       // ... ISR code ...
 *       CALLISTO_ISR_EXIT(TIM1_IRQn);
 *   }
 */
#define CALLISTO_ISR_ENTER(irq_num) callisto_isr_enter(irq_num)

/**
 * @brief ISR exit macro - use at the end of ISR handlers
 */
#define CALLISTO_ISR_EXIT(irq_num) callisto_isr_exit(irq_num)

/**
 * @brief Idle hook macros for main loop or RTOS idle task
 * 
 * Example:
 *   while (1) {
 *       CALLISTO_IDLE_ENTER();
 *       __WFI(); // Wait for interrupt
 *       CALLISTO_IDLE_EXIT();
 *       // Process events...
 *   }
 */
#define CALLISTO_IDLE_ENTER() callisto_idle_enter()
#define CALLISTO_IDLE_EXIT() callisto_idle_exit()

/**
 * @brief Debug printf-style macro (requires stdio.h and sprintf)
 * 
 * Example:
 *   CALLISTO_PRINTF("Temperature: %d°C", temp);
 */
#ifdef CALLISTO_ENABLE_PRINTF
#include <stdio.h>
#define CALLISTO_PRINTF(fmt, ...) do { \
    char _buf[128]; \
    snprintf(_buf, sizeof(_buf), fmt, ##__VA_ARGS__); \
    callisto_puts(_buf); \
} while(0)
#endif

#ifdef __cplusplus
}
#endif

#endif // CALLISTO_TRACE_H