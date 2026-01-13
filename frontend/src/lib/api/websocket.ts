// frontend/src/lib/api/websocket.ts
import { io, Socket } from 'socket.io-client';
import { Product } from '../types';

export interface WebSocketEvent {
  type: 'NAVIGATE' | 'HOVER' | 'CLICK' | 'LOAD_MORE' | 'GET_DETAILS';
  payload: {
    target: string;
    action: 'hover' | 'click' | 'paginate';
    categorySlug?: string;
    navigationSlug?: string;
  };
}

export interface WebSocketResponse {
  type: 'DATA_CHUNK' | 'SCRAPE_STATUS' | 'SESSION_READY' | 'ERROR' | 'PROGRESS';
  payload: {
    products?: Product[];
    status?: 'active' | 'idle' | 'scraping' | 'ready';
    message?: string;
    totalScraped?: number;
    chunkIndex?: number;
    sessionId?: string;
    hasMore?: boolean;
  };
}

class WebSocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectionUrl: string;

  constructor() {
    this.connectionUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    this.initialize();
  }

  private initialize() {
    this.socket = io(this.connectionUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🟢 WebSocket connected:', this.socket?.id);
      this.sessionId = this.socket?.id || null;
      this.reconnectAttempts = 0;
      this.emit('connected', { sessionId: this.sessionId });
    });

    this.socket.on('SESSION_READY', (data: WebSocketResponse) => {
      console.log('🔵 Session ready:', data);
      this.emit('session-ready', data);
    });

    this.socket.on('DATA_CHUNK', (data: WebSocketResponse) => {
      console.log('📦 Data chunk received:', data.payload.products?.length || 0, 'products');
      this.emit('data-chunk', data);
    });

    this.socket.on('SCRAPE_STATUS', (data: WebSocketResponse) => {
      console.log('🔄 Scrape status:', data.payload.status, data.payload.message);
      this.emit('scrape-status', data);
    });

    this.socket.on('PROGRESS', (data: WebSocketResponse) => {
      console.log('📊 Progress:', data.payload.message);
      this.emit('progress', data);
    });

    this.socket.on('ERROR', (data: WebSocketResponse) => {
      console.error('🔴 WebSocket error:', data);
      this.emit('error', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🟡 WebSocket disconnected:', reason);
      this.emit('disconnected', { reason });
      
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      this.emit('reconnecting', { attempt: attemptNumber });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('🔴 WebSocket reconnection failed');
      this.emit('reconnect-failed', {});
    });
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public sendEvent(event: WebSocketEvent): void {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      this.emit('error', { message: 'WebSocket not connected' });
      return;
    }

    console.log('📤 Sending event:', event.type, event.payload);
    this.socket.emit(event.type, event);
  }

  public hoverNavigation(target: string, navigationSlug?: string): void {
    this.sendEvent({
      type: 'NAVIGATE',
      payload: {
        target,
        action: 'hover',
        navigationSlug,
      },
    });
  }

  public clickCategory(target: string, categorySlug: string, navigationSlug?: string): void {
    this.sendEvent({
      type: 'NAVIGATE',
      payload: {
        target,
        action: 'click',
        categorySlug,
        navigationSlug,
      },
    });
  }

  public loadMore(target: string, categorySlug: string): void {
    this.sendEvent({
      type: 'NAVIGATE',
      payload: {
        target,
        action: 'paginate',
        categorySlug,
      },
    });
  }

  public getProductDetails(sourceId: string): void {
    this.sendEvent({
      type: 'GET_DETAILS',
      payload: {
        target: sourceId,
        action: 'click',
      },
    });
  }

  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  public off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.sessionId = null;
      this.listeners.clear();
    }
  }
}

export const webSocketClient = new WebSocketClient();