/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

const STORAGE_KEY = 'erp_client_instance_id';

function generateClientInstanceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getClientInstanceId() {
  if (typeof window === 'undefined') {
    return 'server-runtime';
  }

  let id = window.sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateClientInstanceId();
    window.sessionStorage.setItem(STORAGE_KEY, id);
  }

  return id;
}
