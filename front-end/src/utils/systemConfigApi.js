/**
 * System Config API Utilities
 * ====================================================================
 * API client để quản lý system configs từ frontend
 * ====================================================================
 */

import api from './api.js';

export const systemConfigApi = {
  getConfigs: async (params = {}) => {
    const response = await api.get('/settings/configs', { params });
    return response.data;
  },

  getConfig: async (key, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.get(`/settings/config/${encodeURIComponent(key)}`, { params });
    return response.data;
  },

  createConfig: async (config) => {
    const response = await api.post('/settings/configs', config);
    return response.data;
  },

  updateConfig: async (key, updates, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.put(`/settings/config/${encodeURIComponent(key)}`, updates, { params });
    return response.data;
  },

  deleteConfig: async (key, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.delete(`/settings/config/${encodeURIComponent(key)}`, { params });
    return response.data;
  },

  batchUpdate: async (configs, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.post('/settings/configs/batch-update', { configs }, { params });
    return response.data;
  },

  exportConfigs: async (companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.get('/settings/configs/export', { params });
    return response.data;
  },

  importConfigs: async (configs, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.post('/settings/configs/import', { configs }, { params });
    return response.data;
  },

  getTaxRate: async (partnerId = null, companyId = null) => {
    const params = {};
    if (partnerId) params.partner_id = partnerId;
    if (companyId) params.company_id = companyId;
    const response = await api.get('/settings/tax-rate', { params });
    return response.data;
  },

  getBatchConfigs: async (keys, companyId = null) => {
    const response = await api.post('/settings/configs/batch', { keys, company_id: companyId });
    return response.data;
  }
};

export default systemConfigApi;