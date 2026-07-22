/**
 * MetaApiClient.js - Client gọi /api/meta endpoints
 * Dùng cho Server-Driven UI (SDUI)
 */

const BASE = '/api/meta';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
  return json;
}

export const metaApi = {
  /**
   * Lấy UI Schema cho DynamicForm
   * @param {string} entityType - Loại nghiệp vụ
   * @param {number} companyId - ID công ty
   * @returns {Promise<Object>} UI Schema
   */
  getUISchema: async (entityType, companyId) => {
    const json = await fetchJson(`${BASE}/${entityType}/ui-schema?company_id=${companyId}`);
    return json.data;
  },

  /**
   * Lấy grid columns cho DynamicGrid
   * @param {string} entityType - Loại nghiệp vụ
   * @param {number} companyId - ID công ty
   * @returns {Promise<Array>} Mảng cấu hình cột
   */
  getGridColumns: async (entityType, companyId) => {
    const json = await fetchJson(`${BASE}/${entityType}/grid-columns?company_id=${companyId}`);
    return json.data;
  },

  /**
   * Lấy danh sách entity configs
   * @param {number} companyId - ID công ty
   * @returns {Promise<Array>} Danh sách entity configs
   */
  listEntities: async (companyId) => {
    const json = await fetchJson(`${BASE}/?company_id=${companyId}`);
    return json.data;
  },

  /**
   * Tạo entity config mới
   * @param {Object} config - Entity config { entity_type, table_name, ui_schema, grid_columns }
   * @param {number} companyId - ID công ty
   * @returns {Promise<Object>} Entity config đã tạo
   */
  createEntity: async (config, companyId) => {
    const json = await fetchJson(`${BASE}/`, {
      method: 'POST',
      body: JSON.stringify({ ...config, company_id: companyId })
    });
    return json.data;
  },

  /**
   * Lấy chi tiết entity config
   * @param {string} entityType - Loại nghiệp vụ
   * @param {number} companyId - ID công ty
   * @returns {Promise<Object>} Entity config
   */
  getEntity: async (entityType, companyId) => {
    const json = await fetchJson(`${BASE}/${entityType}?company_id=${companyId}`);
    return json.data;
  },

  /**
   * Cập nhật UI Schema / Grid Columns cho entity
   * @param {string} entityType - Loại nghiệp vụ
   * @param {Object} updates - { ui_schema, grid_columns, permissions }
   * @param {number} companyId - ID công ty
   * @returns {Promise<Object>} Entity config đã cập nhật
   */
  updateUISchema: async (entityType, updates, companyId) => {
    const json = await fetchJson(`${BASE}/${entityType}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, company_id: companyId })
    });
    return json.data;
  },

  /**
   * Xóa entity config
   * @param {string} entityType - Loại nghiệp vụ
   * @param {number} companyId - ID công ty
   * @returns {Promise<boolean>}
   */
  deleteEntity: async (entityType, companyId) => {
    const json = await fetchJson(`${BASE}/${entityType}?company_id=${companyId}`, {
      method: 'DELETE'
    });
    return json.success;
  }
};
