/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiProposal.service - Service đề xuất định khoản tự động
 * Sử dụng Vector Search (pgvector) để tìm định khoản tương tự
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import { determineProcessingStatus, calculateConfidenceScore } from './hitl.service.js';
import logger from '../utils/logger.js';

/**
 * Tìm định khoản tương tự dựa trên mô tả
 * @param {string} description - Mô tả giao dịch
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function findSimilarEntries(description, companyId) {
  try {
    // Tìm trong lịch sử định khoản (có thể dùng pgvector nếu có)
    const { rows } = await pool.query(
      `SELECT v.id, v.description, vd.account_code, vd.entry_type, vd.amount
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 
       AND v.description ILIKE $2
       AND v.is_posted = TRUE
       ORDER BY v.created_at DESC
       LIMIT 5`,
      [companyId, `%${description.substring(0, 20)}%`]
    );

    return rows;
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Error finding similar entries');
    return [];
  }
}

/**
 * Tạo đề xuất định khoản tự động
 * @param {Object} transaction - Thông tin giao dịch
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function generateAccountingProposal(transaction, companyId) {
  const { amount, description, partner_name, items } = transaction;

  // Tìm đối tác dựa trên tên
  let partnerId = null;
  if (partner_name) {
    const partnerRes = await pool.query(
      'SELECT id FROM partners WHERE company_id = $1 AND partner_name ILIKE $2 LIMIT 1',
      [companyId, `%${partner_name}%`]
    );
    partnerId = partnerRes.rows[0]?.id;
  }

  // Tìm định khoản tương tự
  const similarEntries = await findSimilarEntries(description, companyId);

  // Tạo đề xuất dựa trên lịch sử
  const entries = [];
  let totalDebit = 0;
  let totalCredit = 0;

  if (similarEntries.length > 0) {
    // Sử dụng định khoản tương tự
    for (const entry of similarEntries) {
      entries.push({
        accountCode: entry.account_code,
        entryType: entry.entry_type,
        amount: entry.amount,
        description: entry.description
      });
      if (entry.entry_type === 'DR') totalDebit += entry.amount;
      else totalCredit += entry.amount;
    }
  } else {
    // Đề xuất mặc định dựa trên loại giao dịch
    if (description?.toLowerCase().includes('thu')) {
      // Giao dịch thu
      entries.push({ accountCode: '131', entryType: 'DR', amount, description: 'Phải thu khách hàng' });
      entries.push({ accountCode: '112', entryType: 'CR', amount, description: 'Tiền ngân hàng' });
    } else if (description?.toLowerCase().includes('chi')) {
      // Giao dịch chi
      entries.push({ accountCode: '112', entryType: 'DR', amount, description: 'Tiền ngân hàng' });
      entries.push({ accountCode: '331', entryType: 'CR', amount, description: 'Phải trả ngân hàng' });
    }
    totalDebit = totalCredit = amount;
  }

  // Tính confidence score
  const confidenceScore = calculateConfidenceScore({
    vendor_tax_code: partnerId ? 'found' : null,
    items: items || [],
    entries
  });

  // Xác định trạng thái xử lý
  const processingStatus = determineProcessingStatus(confidenceScore, amount);

  const proposal = {
    entries,
    partner_id: partnerId,
    confidence_score: confidenceScore,
    processing_status: processingStatus,
    total_debit: totalDebit,
    total_credit: totalCredit
  };

  logger.info({ 
    companyId, 
    amount, 
    confidence: confidenceScore,
    status: processingStatus 
  }, 'AI proposal generated');

  return proposal;
}

/**
 * Lưu đề xuất vào HITL logs
 * @param {Object} proposal - Đề xuất
 * @param {string} companyId - ID công ty
 * @param {number} [voucherId] - ID voucher (nếu có)
 * @returns {Promise<Object>}
 */
export async function saveProposal(proposal, companyId, voucherId = null) {
  const { rows } = await pool.query(
    `INSERT INTO ai_hitl_logs (
      tenant_id, voucher_id, ai_confidence_score, original_ai_proposal,
      final_human_approved, is_modified, processing_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      companyId,
      voucherId,
      proposal.confidence_score,
      JSON.stringify(proposal),
      JSON.stringify(proposal),
      false,
      proposal.processing_status
    ]
  );

  return rows[0];
}

export default {
  findSimilarEntries,
  generateAccountingProposal,
  saveProposal
};