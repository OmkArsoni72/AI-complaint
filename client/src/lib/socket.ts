import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

let socket: Socket | undefined;

export const getSocket = (token?: string | null) => {
  // 🟢 VERCEL FIX: Socket.io does not work on Vercel Serverless. 
  // Disable it in production to avoid continuous 404 errors.
  const isVercel = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  
  if (isVercel) {
    console.warn('Socket.io is disabled on Vercel (Production) to prevent 404 polling errors.');
    return {
      on: () => {},
      off: () => {},
      emit: () => {},
      connected: false,
      connect: () => {},
      disconnect: () => {},
    } as any;
  }

  if (!socket) {
    socket = io(SOCKET_URL || undefined, {
      path: '/socket.io',
      // Start with polling to avoid noisy websocket handshake failures on strict networks.
      transports: ['polling', 'websocket'],
      upgrade: true,
      withCredentials: true,
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      auth: token ? { token } : {},
    });

    // Log connection events
    socket.on('connect', () => {
      console.log('Socket.io connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.io disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('Socket.io connection warning:', error?.message || error);
    });
  }

  if (token && (socket.auth as any)?.token !== token) {
    socket.auth = { token };
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const onEvent = (event: string, callback: (data: any) => void, token?: string | null) => {
  const s = getSocket(token);
  s.on(event, callback);
  return () => {
    s.off(event, callback);
  };
};
