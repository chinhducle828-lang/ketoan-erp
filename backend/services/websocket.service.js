/**
 * WebSocket Service - Socket.io + Redis Adapter
 * Đồng bộ trạng thái thời gian thực giữa các server
 */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../cache/redis.js';

let io = null;

/**
 * Khởi tạo Socket.io server
 * @param {Object} server - HTTP server
 * @returns {Server}
 */
export function initWebSocket(server) {
  if (io) {
    return io;
  }

  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Sử dụng Redis adapter cho multi-server
  if (redis.status === 'ready') {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    
    io.adapter(createAdapter(pubClient, subClient));
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join room theo công ty
    socket.on('join-company', (companyId) => {
      socket.join(`company:${companyId}`);
      console.log(`Socket ${socket.id} joined company:${companyId}`);
    });

    // Join room theo vai trò
    socket.on('join-role', (role) => {
      socket.join(`role:${role}`);
      console.log(`Socket ${socket.id} joined role:${role}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

/**
 * Publish event tới tất cả server
 * @param {string} event - Tên event
 * @param {Object} data - Dữ liệu
 */
export function publishEvent(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Publish event tới room công ty
 * @param {number} companyId - ID công ty
 * @param {string} event - Tên event
 * @param {Object} data - Dữ liệu
 */
export function publishToCompany(companyId, event, data) {
  if (io) {
    io.to(`company:${companyId}`).emit(event, data);
  }
}

/**
 * Publish event tới room vai trò
 * @param {string} role - Vai trò
 * @param {string} event - Tên event
 * @param {Object} data - Dữ liệu
 */
export function publishToRole(role, event, data) {
  if (io) {
    io.to(`role:${role}`).emit(event, data);
  }
}

/**
 * Lấy socket instance
 * @returns {Server|null}
 */
export function getIO() {
  return io;
}