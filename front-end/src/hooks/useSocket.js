/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext.jsx';

/**
 * Hook để sử dụng SocketContext
 * @returns {Object} Socket context value
 * @throws {Error} Nếu không được dùng bên trong SocketProvider
 */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket phải được dùng bên trong SocketProvider');
  }
  return context;
}