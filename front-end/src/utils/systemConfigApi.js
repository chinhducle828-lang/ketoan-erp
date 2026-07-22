/**
 * System Config API Utilities
 * ====================================================================
 * API client để quản lý system configs từ frontend
 * ====================================================================
 */

import api from './api.js';

export const systemConfigApi = {
  /**
   * Get all system configs with filters
   * @param {Object} params - Query parameters
   * @param {string} params.category - Category filter
   * @param {string} params.search - Search query
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {number} params.company_id - Company ID
   * @returns {Promise<Object>} Paginated configs
   */
  getConfigs: async (params = {}) => {
    const response = await api.get('/settings/configs', { params });
    return response.data;
  },

  /**
   * Get single config by key
   * @param {string} key - Config key
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Config object
   */
  getConfig: async (key, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.get(`/settings/config/${encodeURIComponent(key)}`, { params });
    return response.data;
  },

  /**
   * Create new config
   * @param {Object} config - Config object
   * @returns {Promise<Object>} Created config
   */
  createConfig: async (config) => {
    const response = await api.post('/settings/configs', config);
    return response.data;
  },

  /**
   * Update config
   * @param {string} key - Config key
   * @param {Object} updates - Updates object
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Updated config
   */
  updateConfig: async (key, updates, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.put(`/settings/config/${encodeURIComponent(key)}`, updates, { params });
    return response.data;
  },

  /**
   * Delete config (soft delete)
   * @param {string} key - Config key
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Result
   */
  deleteConfig: async (key, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.delete(`/settings/config/${encodeURIComponent(key)}`, { params });
    return response.data;
  },

  /**
   * Batch update configs
   * @param {Array} configs - Array of { key, value }
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Result
   */
  batchUpdate: async (configs, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.post('/settings/configs/batch-update', { configs }, { params });
    return response.data;
  },

  /**
   * Export all configs as JSON
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Exported configs
   */
  exportConfigs: async (companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.get('/settings/configs/export', { params });
    return response.data;
  },

  /**
   * Import configs from JSON
   * @param {Array} configs - Array of config objects
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Import result
   */
  importConfigs: async (configs, companyId = null) => {
    const params = {};
    if (companyId) {
      params.company_id = companyId;
    }
    const response = await api.post('/settings/configs/import', { configs }, { params });
    return response.data;
  },

  /**
   * Get tax rate
   * @param {number} partnerId - Partner ID (optional)
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Tax rate info
   */
  getTaxRate: async (partnerId = null, companyId = null) => {
    const params = {};
    if (partnerId) params.partner_id = partnerId;
    if (companyId) params.company_id = companyId;
    const response = await api.get('/settings/tax-rate', { params });
    return response.data;
  },

  /**
   * Get multiple configs at once
   * @param {Array} keys - Array of config keys
   * @param {number} companyId - Company ID (optional)
   * @returns {Promise<Object>} Configs object
   */
  getBatchConfigs: async (keys, companyId = null) => {
    const response = await api.post('/settings/configs/batch', { keys, company_id: companyId });
    return response.data;
  }
};

export default systemConfigApi;