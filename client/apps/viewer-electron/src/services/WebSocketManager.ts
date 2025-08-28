export class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string = ''
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 3000
  private reconnectTimer: NodeJS.Timeout | null = null

  public onMessage: ((message: any) => void) | null = null
  public onConnectionChange: ((connected: boolean) => void) | null = null
  public onError: ((error: Event) => void) | null = null

  connect(url: string, token?: string): void {
    this.url = url
    this.reconnectAttempts = 0
    this.createConnection(token)
  }

  private createConnection(token?: string): void {
    try {
      console.log('Connecting to WebSocket:', this.url)
      
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
        this.onConnectionChange?.(true)
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('WebSocket message:', message)
          this.onMessage?.(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason)
        this.ws = null
        this.onConnectionChange?.(false)
        
        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(token)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        this.onError?.(error)
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.scheduleReconnect(token)
    }
  }

  private scheduleReconnect(token?: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000)
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)
    
    this.reconnectTimer = setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.createConnection(token)
      } else {
        console.error('Max reconnect attempts reached')
      }
    }, delay)
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const json = JSON.stringify(message)
        console.log('Sending WebSocket message:', json)
        this.ws.send(json)
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
      }
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }

    this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnection
    this.onConnectionChange?.(false)
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  getReadyState(): number | null {
    return this.ws?.readyState ?? null
  }
}