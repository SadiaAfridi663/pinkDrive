import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import { SERVER_EVENTS, CLIENT_EVENTS } from '../constants/socketEvents';
import logger from '../utils/logger';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

const SocketContext = createContext(null);

function SocketProvider({ children }) {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        logger.info('[Socket] Logging out, disconnecting socket');
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    logger.info('[Socket] Creating new socket connection');
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      logger.info(`[Socket] Connected: ${newSocket.id}`);
      setConnected(true);
    });
    newSocket.on('disconnect', (reason) => {
      logger.info(`[Socket] Disconnected: ${reason}`);
      setConnected(false);
    });
    newSocket.on('connect_error', (err) => {
      logger.error(`[Socket] Connection error: ${err.message}`);
    });

    setSocket(newSocket);

    return () => {
      logger.info('[Socket] Cleaning up socket');
      newSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

function useSocket() {
  const ctx = useContext(SocketContext);
  return ctx || { socket: null, connected: false };
}

export { SocketProvider, useSocket, SocketContext };
