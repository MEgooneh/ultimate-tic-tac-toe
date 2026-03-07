class WsClient {
  constructor(gameId, playerToken, playerName) {
    this.gameId = gameId;
    this.playerToken = playerToken;
    this.playerName = playerName || 'Player';
    this.ws = null;
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.closed = false;
  }

  connect() {
    const wsUrl = `${getWsUrl()}/ws?gameId=${encodeURIComponent(this.gameId)}&playerToken=${encodeURIComponent(this.playerToken)}&playerName=${encodeURIComponent(this.playerName)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._emit('connected');
    };

    this.ws.onmessage = (event) => {
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

  on(type, handler) {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type].push(handler);
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close() {
    this.closed = true;
    if (this.ws) this.ws.close();
  }

  _emit(type, data) {
    const handlers = this.handlers[type];
    if (handlers) handlers.forEach(h => h(data));
  }

  _reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.closed) this.connect();
    }, delay);
  }
}
