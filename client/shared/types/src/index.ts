// Re-export all generated types
export * from './protocol.d';
export * from './server-message.d';
export * from './client-message.d';

// Additional utility types
export interface ConnectionState {
  connected: boolean;
  target?: string;
  chip?: string;
  probe?: string;
}

export interface AppState {
  connection: ConnectionState;
  tracing: boolean;
  portMask: number;
  events: TraceEventWithTimestamp[];
  stats: SessionStats;
}

export interface TraceEventWithTimestamp {
  timestamp: number;
  port: number;
  event: any; // Will be properly typed from generated types
}

export interface SessionStats {
  eventsPerSec: number;
  bytesPerSec: number;
  dropRate: number;
  cpuLoad?: number;
}

// WebSocket connection utilities
export interface WebSocketConfig {
  url: string;
  token?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}