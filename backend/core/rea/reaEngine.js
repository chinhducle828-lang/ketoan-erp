/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * reaEngine.js - REA Event Engine
 * raiseEvent(): Ghi nhận sự kiện kinh tế + audit trail
 */

import { pool } from '../../config/db.js';

export class ReaEngine {
  /**
   * Ghi nhận một sự kiện kinh tế (REA Event)
   * @param {Object} event - { companyId, eventType, eventData, resources, agents, accountingEntries, voucherId, createdBy }
   * @param {Object} options - { client: dbClient (optional) }
   */
  static async raiseEvent(event, options = {}) {
    const client = options.client || pool;

    const safeStringify = (obj) => {
      try {
        return JSON.stringify(obj);
      } catch {
        const cache = new Set();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) return '[Circular]';
            cache.add(value);
          }
          return value;
        });
      }
    };

    const result = await client.query(`
      INSERT INTO rea_events (company_id, event_type, event_data, resources, agents, accounting_entries, voucher_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      event.companyId,
      event.eventType,
      safeStringify(event.eventData || {}),
      safeStringify(event.resources || []),
      safeStringify(event.agents || []),
      safeStringify(event.accountingEntries || []),
      event.voucherId || null,
      event.createdBy || null
    ]);

    return result.rows[0]?.id || null;
  }

  /**
   * Lấy lịch sử sự kiện của 1 công ty
   */
  static async getEvents(companyId, { eventType, limit = 50, offset = 0 } = {}) {
    try {
      const params = [companyId];
      let query = 'SELECT * FROM rea_events WHERE company_id = $1';

      if (eventType) {
        params.push(eventType);
        query += ` AND event_type = $2`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (err) {
      console.error('[ReaEngine] Error fetching events:', err.message);
      throw new Error(`Không thể lấy danh sách sự kiện: ${err.message}`);
    }
  }
}