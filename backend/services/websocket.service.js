/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * WebSocket Service - Socket.io + Redis Adapter
 * Đồng bộ trạng thái thời gian thực giữa các server
 */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../cache/redis.js';
import jwt from 'jsonwebtoken';

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

  // WebSocket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      // Get auth data from either handshake.auth or query params
      const { companyId, userId, clientInstanceId } = socket.handshake.auth || {};
      const queryCompanyId = socket.handshake.query.company_id;
      const queryUserId = socket.handshake.query.user_id;
      const queryClientInstanceId = socket.handshake.query.client_instance_id;
      
      // Support both auth object and query parameters
      const finalCompanyId = companyId || queryCompanyId;
      const finalUserId = userId || queryUserId;
      const finalClientInstanceId = clientInstanceId || queryClientInstanceId;
      
      // Validate required fields
      if (!finalCompanyId || !finalUserId) {
        console.warn(`WebSocket connection rejected: missing companyId or userId from ${socket.handshake.address}`);
        return next(new Error('Missing authentication data'));
      }

      // Optional: Validate JWT token if provided (check both auth.token and query access_token)
      const token = socket.handshake.auth.token || socket.handshake.query.access_token;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          // Token is valid, attach user info to socket
          socket.data.user = decoded;
          socket.data.companyId = Number(finalCompanyId);
          socket.data.userId = Number(finalUserId);
          socket.data.clientInstanceId = finalClientInstanceId;
          console.log(`WebSocket authenticated: userId=${finalUserId}, companyId=${finalCompanyId}, socketId=${socket.id}`);
        } catch (jwtError) {
          console.warn(`WebSocket JWT validation failed for userId=${finalUserId}:`, jwtError.message);
          // Continue without JWT validation - allow connection for backward compatibility
          socket.data.companyId = Number(finalCompanyId);
          socket.data.userId = Number(finalUserId);
          socket.data.clientInstanceId = finalClientInstanceId;
        }
      } else {
        // No token provided - allow connection but log warning
        socket.data.companyId = Number(finalCompanyId);
        socket.data.userId = Number(finalUserId);
        socket.data.clientInstanceId = finalClientInstanceId;
        console.log(`WebSocket connected without token: userId=${finalUserId}, companyId=${finalCompanyId}, socketId=${socket.id}`);
      }

      next();
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      next(new Error('Authentication failed'));
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