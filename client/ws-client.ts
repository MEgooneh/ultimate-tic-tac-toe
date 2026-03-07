type WsEventHandler = (data?: any) => void;

class WsClient {
  private gameId: string;
  private playerToken: string;
  private playerName: string;
  private ws: WebSocket | null = null;
  private handlers: Record<string, WsEventHandler[]> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private closed = false;

  constructor(gameId: string, playerToken: string, playerName?: string) {
    this.gameId = gameId;
    this.playerToken = playerToken;
    this.playerName = playerName || 'Player';
  }

  connect(): void {
    const wsUrl = `${getWsUrl()}/ws?gameId=${encodeURIComponent(this.gameId)}&playerToken=${encodeURIComponent(this.playerToken)}&playerName=${encodeURIComponent(this.playerName)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._emit('connected');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        this._emit(msg.type, msg.data);
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    this.ws.onclose = () => {
      if (this.closed) return;
      this._emit('disconnected');
      this._reconnect();
    };

    this.ws.onerror = () => {};
  }

  on(type: string, handler: WsEventHandler): void {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(handler);
  }

  send(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.closed = true;
    if (this.ws) this.ws.close();
  }

  private _emit(type: string, data?: unknown): void {
    const handlers = this.handlers[type];
    if (handlers) handlers.forEach(h => h(data));
  }

  private _reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.closed) this.connect();
    }, delay);
  }
}
