/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Casso Open Banking Integration Config
 * Docs: https://docs.casso.vn/
 *
 * Uses a single shared API key for the system.
 * Webhook is shared; per-company bank accounts are mapped in DB.
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const CASSO_BASE_URL = (process.env.CASSO_BASE_URL || 'https://oauth.casso.vn/v2').replace(/\/$/, '');
export const CASSO_API_KEY = process.env.CASSO_API_KEY || '';
export const CASSO_WEBHOOK_PATH = process.env.CASSO_WEBHOOK_PATH || '/api/casso/webhook';

export function getCassoHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Apikey ${CASSO_API_KEY}`
  };
}

export function getCassoWebhookUrl() {
  const base = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}${CASSO_WEBHOOK_PATH}`;
}