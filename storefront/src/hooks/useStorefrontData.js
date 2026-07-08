/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useState, useEffect, useRef } from 'react';
import { loadItems as fetchItems, loadWarehouseQueue as fetchQueue } from '../utils/api';
import { STOREFRONT_ROLE_KEY } from '../constants';

// Hook for managing items
export const useItems = (companyId) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadItems = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchItems(id);
      setItems(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadItems(companyId);
    }
  }, [companyId]);

  return { items, loading, error, loadItems, setItems };
};

// Hook for managing cart
export const useCart = () => {
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem('storefrontCart');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('storefrontCart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (item, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.id === item.id);
      if (existing) {
        return prev.map((entry) => 
          entry.id === item.id ? { ...entry, quantity: entry.quantity + qty } : entry
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
  };

  const updateCartQuantity = (itemId, delta) => {
    setCart((prev) => prev.flatMap((entry) => {
      if (entry.id !== itemId) return [entry];
      const nextQty = entry.quantity + delta;
      return nextQty > 0 ? [{ ...entry, quantity: nextQty }] : [];
    }));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (Number(item.price_sell) || 0) * item.quantity, 0);

  return { cart, addToCart, updateCartQuantity, clearCart, cartCount, cartSubtotal };
};

// Hook for managing warehouse queue
export const useWarehouseQueue = (companyId, canTrackQueue, storefrontToken) => {
  const [warehouseQueue, setWarehouseQueue] = useState([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState('all');
  const previousQueueRef = useRef(new Map());
  const firstQueueLoadRef = useRef(true);

  const loadQueue = async ({ source = 'poll', keepLoadingState = true } = {}) => {
    if (!companyId) {
      setWarehouseQueue([]);
      return;
    }

    if (keepLoadingState) {
      setWarehouseLoading(true);
    }
    try {
      const nextList = await fetchQueue(companyId, storefrontToken);
      const nextMap = new Map(nextList.map((order) => [Number(order.id), order]));
      previousQueueRef.current = nextMap;
      firstQueueLoadRef.current = false;
      setWarehouseQueue(nextList);
    } catch (err) {
      // Error handled by caller
    } finally {
      if (keepLoadingState) {
        setWarehouseLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!canTrackQueue || !companyId) return;

    previousQueueRef.current = new Map();
    firstQueueLoadRef.current = true;

    loadQueue();
    const timer = setInterval(() => loadQueue({ source: 'poll', keepLoadingState: false }), 60000);
    return () => clearInterval(timer);
  }, [companyId, canTrackQueue]);

  const warehouseFilteredQueue = warehouseStatusFilter === 'all' 
    ? warehouseQueue 
    : warehouseQueue.filter((order) => order.loading_status === warehouseStatusFilter);

  return {
    warehouseQueue,
    warehouseLoading,
    warehouseStatusFilter,
    setWarehouseStatusFilter,
    loadQueue,
    warehouseFilteredQueue
  };
};

// Hook for authentication
export const useAuth = (storefrontRole, isAdminRole, isWarehouseRole, isSalesRole) => {
  const [storefrontToken, setStorefrontToken] = useState(() => 
    localStorage.getItem('storefrontAccessToken') || ''
  );
  const [hasAdminSession, setHasAdminSession] = useState(false);
  const [authenticatingAdmin, setAuthenticatingAdmin] = useState(false);
  const [authBootstrapDone, setAuthBootstrapDone] = useState(false);
  const [adminSessionChecked, setAdminSessionChecked] = useState(false);
  const [sessionRole, setSessionRole] = useState('');
  const [adminMessage, setAdminMessage] = useState('');

  const getStoredRole = () => {
    if (typeof window === 'undefined') return 'guest';
    const current = window.sessionStorage.getItem(STOREFRONT_ROLE_KEY);
    if (current) return current;
    window.localStorage.removeItem(STOREFRONT_ROLE_KEY);
    return 'guest';
  };

  const setStoredRole = (role) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(STOREFRONT_ROLE_KEY, role);
    window.localStorage.removeItem(STOREFRONT_ROLE_KEY);
  };

  return {
    storefrontToken,
    setStorefrontToken,
    hasAdminSession,
    setHasAdminSession,
    authenticatingAdmin,
    setAuthenticatingAdmin,
    authBootstrapDone,
    setAuthBootstrapDone,
    adminSessionChecked,
    setAdminSessionChecked,
    sessionRole,
    setSessionRole,
    adminMessage,
    setAdminMessage,
    getStoredRole,
    setStoredRole
  };
};