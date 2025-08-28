interface TimelineProps {
  events: any[]
}

export function Timeline({ events }: TimelineProps) {
  const formatTimestamp = (timestamp: number) => {
    return (timestamp / 1000).toFixed(3) + 'ms'
  }

  const formatEvent = (event: any) => {
    switch (event.event?.kind) {
      case 'Text':
        return {
          className: 'event-text',
          content: event.event.data.message
        }
      case 'Marker':
        return {
          className: 'event-marker',
          content: `Marker ${event.event.data.id}${event.event.data.name ? ` (${event.event.data.name})` : ''}`
        }
      case 'TaskSwitch':
        return {
          className: 'event-task',
          content: `Task switch: ${event.event.data.from_task} → ${event.event.data.to_task}`
        }
      case 'IsrEnter':
        return {
          className: 'event-isr',
          content: `ISR enter: ${event.event.data.isr_id}${event.event.data.name ? ` (${event.event.data.name})` : ''}`
        }
      case 'IsrExit':
        return {
          className: 'event-isr',
          content: `ISR exit: ${event.event.data.isr_id}`
        }
      case 'IdleEnter':
        return {
          className: 'event-task',
          content: 'Idle enter'
        }
      case 'IdleExit':
        return {
          className: 'event-task',
          content: 'Idle exit'
        }
      case 'Counter':
        return {
          className: 'event-counter',
          content: `Counter ${event.event.data.counter_id}: ${event.event.data.value}`
        }
      default:
        return {
          className: 'event-text',
          content: JSON.stringify(event.event)
        }
    }
  }

  return (
    <div className="timeline">
      <div className="timeline-header">
        ITM Trace Events ({events.length} events)
      </div>
      <div className="timeline-content">
        {events.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            No events received yet. Start tracing to see ITM data.
          </div>
        ) : (
          events.map((event, index) => {
            const formatted = formatEvent(event)
            return (
              <div key={index} className="event-item">
                <div className="event-timestamp">
                  {formatTimestamp(event.timestamp)}
                </div>
                <div className="event-port">
                  P{event.port}
                </div>
                <div className={`event-content ${formatted.className}`}>
                  {formatted.content}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}