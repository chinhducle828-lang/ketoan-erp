/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtimeInvalidation } from './useRealtimeInvalidation.js';
import { useRealTimeSync } from './useRealTimeSync.js';

/**
 * Hook quản lý voucher queries với React Query
 * Thay thế VoucherContext state management
 */
export function useVoucherQueries() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;
  const queryClient = useQueryClient();

  // Query: Lấy danh sách vouchers
  const vouchersQuery = useQuery({
    queryKey: ['vouchers', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const res = await api.get(`/vouchers?company_id=${companyId}`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 phút
    gcTime: 10 * 60 * 1000, // 10 phút
  });

  // Realtime invalidation
  const { invalidateKeys } = useRealtimeInvalidation(
    {
      vouchers: () => queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] }),
    },
    {
      eventMap: {
        'voucher:created': ['vouchers'],
        'voucher:updated': ['vouchers'],
        'voucher:deleted': ['vouchers'],
        'voucher:posted': ['vouchers'],
        voucherCreated: ['vouchers'],
        voucherUpdated: ['vouchers'],
        voucherDeleted: ['vouchers'],
        voucherPosted: ['vouchers'],
        'closing:completed': ['vouchers'],
        closingCompleted: ['vouchers']
      },
      debounceMs: 300,
    }
  );

  // Realtime sync với clientInstanceId để chống self-echoing
  useRealTimeSync(
    {
      'voucher:created': invalidateKeys,
      'voucher:updated': invalidateKeys,
      'voucher:deleted': invalidateKeys,
      'voucher:posted': invalidateKeys,
      voucherCreated: invalidateKeys,
      voucherUpdated: invalidateKeys,
      voucherDeleted: invalidateKeys,
      voucherPosted: invalidateKeys,
      'closing:completed': invalidateKeys,
      closingCompleted: invalidateKeys
    },
    { enabled: Boolean(companyId) }
  );

  // Mutation: Tạo voucher mới
  const createMutation = useMutation({
    mutationFn: async (voucherData) => {
      const res = await api.post('/vouchers', voucherData);
      return res.data;
    },
    onSuccess: () => {
      // Optimistic update đã được React Query xử lý
      queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] });
    },
  });

  // Mutation: Xóa voucher
  const deleteMutation = useMutation({
    mutationFn: async (voucherId) => {
      const res = await api.delete(`/vouchers/${voucherId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] });
    },
  });

  // Mutation: Ghi sổ voucher
  const postMutation = useMutation({
    mutationFn: async ({ voucherId, companyId }) => {
      const res = await api.post(`/vouchers/${voucherId}/post`, { company_id: companyId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vouchers', companyId] });
    },
  });

  return {
    // State từ React Query
    vouchers: vouchersQuery.data || [],
    isLoading: vouchersQuery.isLoading,
    isFetching: vouchersQuery.isFetching,
    error: vouchersQuery.error,
    refetch: vouchersQuery.refetch,
    
    // Actions
    createVoucher: createMutation.mutateAsync,
    deleteVoucher: deleteMutation.mutateAsync,
    postVoucher: postMutation.mutateAsync,
    
    // Loading states
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isPosting: postMutation.isPending,
  };
}