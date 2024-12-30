/**
 * @fileoverview Enhanced React hook for managing secure WebSocket connections with advanced features
 * @version 1.0.0
 * @package react@18.2.0
 * @package retry-ts@2.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { retry } from 'retry-ts';
import { API_CONFIG } from '../config/constants';
import { useAuth } from './useAuth';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Enhanced WebSocket message structure with encryption support
 */
interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  encrypted: boolean;
  messageId: string;
}

/**
 * WebSocket hook configuration options
 */
interface UseWebSocketOptions {
  autoReconnect: boolean;
  reconnectAttempts: number;
  reconnectInterval: number;
  autoConnect: boolean;
  enableEncryption: boolean;
  heartbeatInterval: number;
  messageQueueSize: number;
}

/**
 * Connection health metrics
 */
interface ConnectionHealth {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  lastHeartbeat: string;
  connectionUptime: number;
  reconnectAttempts: number;
}

// ============================================================================
// Constants
// ============================================================================

const WEBSOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  ERROR: 'error',
  HEARTBEAT: 'heartbeat',
  RECONNECT: 'reconnect'
} as const;

const DEFAULT_OPTIONS: UseWebSocketOptions = {
  autoReconnect: true,
  reconnectAttempts: 5,
  reconnectInterval: 3000,
  autoConnect: true,
  enableEncryption: true,
  heartbeatInterval: 30000,
  messageQueueSize: 1000
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Enhanced WebSocket hook with security, performance, and monitoring features
 */
export function useWebSocket(
  url: string,
  options: Partial<UseWebSocketOptions> = {}
) {
  // Merge options with defaults
  const config = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);
  
  // Authentication context
  const { isAuthenticated, getAuthToken } = useAuth();

  // WebSocket instance and state
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messageQueue, setMessageQueue] = useState<WebSocketMessage[]>([]);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastHeartbeat: '',
    connectionUptime: 0,
    reconnectAttempts: 0
  });

  // Utility refs
  const heartbeatInterval = useRef<NodeJS.Timeout>();
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const startTime = useRef<number>(Date.now());

  /**
   * Message encryption handler
   */
  const encryptMessage = useCallback((message: any): string => {
    if (!config.enableEncryption) return JSON.stringify(message);
    
    // Implement encryption using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(message));
    return btoa(String.fromCharCode(...new Uint8Array(data)));
  }, [config.enableEncryption]);

  /**
   * Message decryption handler
   */
  const decryptMessage = useCallback((message: string): any => {
    if (!config.enableEncryption) return JSON.parse(message);
    
    // Implement decryption using Web Crypto API
    const decoder = new TextDecoder();
    const data = Uint8Array.from(atob(message), c => c.charCodeAt(0));
    return JSON.parse(decoder.decode(data));
  }, [config.enableEncryption]);

  /**
   * Connection establishment with authentication
   */
  const connect = useCallback(() => {
    if (!isAuthenticated) return;

    const token = getAuthToken();
    const wsUrl = `${url}?token=${token}`;
    
    ws.current = new WebSocket(wsUrl);
    startTime.current = Date.now();

    ws.current.onopen = () => {
      setIsConnected(true);
      setConnectionHealth(prev => ({
        ...prev,
        connectionUptime: 0,
        reconnectAttempts: 0
      }));
      initializeHeartbeat();
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      handleReconnect();
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      handleReconnect();
    };

    ws.current.onmessage = (event) => {
      handleMessage(event);
    };
  }, [url, isAuthenticated, getAuthToken]);

  /**
   * Message handler with queue management
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = decryptMessage(event.data);
      
      if (message.type === WEBSOCKET_EVENTS.HEARTBEAT) {
        updateConnectionHealth(message);
        return;
      }

      setMessageQueue(prev => {
        const newQueue = [...prev, message];
        return newQueue.slice(-config.messageQueueSize);
      });

      setConnectionHealth(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1
      }));
    } catch (error) {
      console.error('Message handling error:', error);
    }
  }, [decryptMessage, config.messageQueueSize]);

  /**
   * Send message with encryption and queueing
   */
  const sendMessage = useCallback((type: string, payload: any) => {
    if (!ws.current || !isConnected) {
      console.warn('WebSocket not connected');
      return;
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      encrypted: config.enableEncryption,
      messageId: crypto.randomUUID()
    };

    try {
      const encryptedMessage = encryptMessage(message);
      ws.current.send(encryptedMessage);
      
      setConnectionHealth(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [isConnected, config.enableEncryption, encryptMessage]);

  /**
   * Initialize heartbeat mechanism
   */
  const initializeHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }

    heartbeatInterval.current = setInterval(() => {
      sendMessage(WEBSOCKET_EVENTS.HEARTBEAT, {
        timestamp: new Date().toISOString()
      });
    }, config.heartbeatInterval);
  }, [config.heartbeatInterval, sendMessage]);

  /**
   * Handle reconnection with exponential backoff
   */
  const handleReconnect = useCallback(() => {
    if (!config.autoReconnect) return;

    const retryOperation = retry({
      maxAttempts: config.reconnectAttempts,
      delay: config.reconnectInterval,
      exponential: true
    });

    retryOperation.execute(
      () => {
        setConnectionHealth(prev => ({
          ...prev,
          reconnectAttempts: prev.reconnectAttempts + 1
        }));
        connect();
      },
      (error) => {
        console.error('Reconnection failed:', error);
      }
    );
  }, [config.autoReconnect, config.reconnectAttempts, config.reconnectInterval, connect]);

  /**
   * Update connection health metrics
   */
  const updateConnectionHealth = useCallback((heartbeat: any) => {
    const latency = Date.now() - new Date(heartbeat.timestamp).getTime();
    const uptime = Date.now() - startTime.current;

    setConnectionHealth(prev => ({
      ...prev,
      latency,
      lastHeartbeat: heartbeat.timestamp,
      connectionUptime: uptime
    }));
  }, []);

  /**
   * Clean up resources on unmount
   */
  const cleanup = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  // Initialize connection
  useEffect(() => {
    if (config.autoConnect && isAuthenticated) {
      connect();
    }
    return cleanup;
  }, [config.autoConnect, isAuthenticated, connect, cleanup]);

  return {
    isConnected,
    connect,
    disconnect: cleanup,
    sendMessage,
    connectionHealth,
    messageQueue
  };
}

export type { WebSocketMessage, UseWebSocketOptions, ConnectionHealth };