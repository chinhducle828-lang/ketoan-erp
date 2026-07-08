/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * cassoAI.service - AI đối chiếu giao dịch ngân hàng
 * Tự động gán partner_id, tạo voucher thu/chi
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import { generateAccountingProposal } from './aiProposal.service.js';
import { determineProcessingStatus } from './hitl.service.js';
import { VoucherRepository } from '../repositories/voucher.repository.js';
import { UnitOfWork } from '../utils/unitOfWork.js';
import logger from '../utils/logger.js';

/**
 * Đối chiếu giao dịch Casso với đơn hàng
 * @param {Object} transaction - Giao dịch ngân hàng
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function matchTransactionToOrder(transaction, companyId) {
  const { amount, description, transaction_date, reference } = transaction;

  // Tìm đối tác dựa trên tên/mô tả
  const { rows: partners } = await pool.query(
    `SELECT id, partner_name, partner_code 
     FROM partners 
     WHERE company_id = $1 
     AND (partner_name ILIKE $2 OR partner_code ILIKE $3)
     LIMIT 5`,
    [companyId, `%${description}%`, `%${reference}%`]
  );

  // Tìm đơn hàng gần đúng
  const { rows: orders } = await pool.query(
    `SELECT id, order_number, total_amount, customer_name
     FROM orders 
     WHERE company_id = $1 
     AND ABS(total_amount - $2) < 1000
     AND created_at >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY created_at DESC
     LIMIT 5`,
    [companyId, amount]
  );

  // Tính confidence dựa trên độ khớp
  let confidence = 50;
  let matchedPartner = null;
  let matchedOrder = null;

  if (partners.length > 0) {
    confidence += 20;
    matchedPartner = partners[0];
  }

  if (orders.length > 0) {
    confidence += 30;
    matchedOrder = orders[0];
  }

  return {
    confidence,
    matched_partner: matchedPartner,
    matched_order: matchedOrder,
    needs_review: confidence < 80
  };
}

/**
 * Tạo voucher thu/chi tự động từ giao dịch
 * @param {Object} transaction - Giao dịch
 * @param {string} companyId - ID công ty
 * @returns {Promise<Object>}
 */
export async function createVoucherFromTransaction(transaction, companyId) {
  const { amount, description, transaction_date, reference } = transaction;

  // Đối chiếu
  const match = await matchTransactionToOrder(transaction, companyId);

  // Xác định loại thu/chi
  const isReceipt = description?.toLowerCase().includes('thu') || 
                    description?.toLowerCase().includes('nhận') ||
                    amount > 0;

  // Tạo đề xuất
  const proposal = await generateAccountingProposal({
    amount: Math.abs(amount),
    description,
    partner_name: match.matched_partner?.partner_name,
    items: []
  }, companyId);

  // Xác định trạng thái
  const status = determineProcessingStatus(
    match.confidence,
    Math.abs(amount)
  );

  // Tạo voucher
  const result = await UnitOfWork.transaction(async (client) => {
    const voucher = await VoucherRepository.create({
      company_id: companyId,
      voucher_number: `BANK-${transaction.id || Date.now()}`,
      voucher_date: transaction_date,
      voucher_type: isReceipt ? 'TH' : 'CH',
      description: `Giao dịch ngân hàng: ${description}`,
      currency: 'VND',
      exchange_rate: 1,
      created_by: null,
      is_posted: status === 'AUTO_POSTED'
    }, client);

    await VoucherRepository.createDetails(voucher.id, proposal.entries, client);

    // Lưu HITL log
    await client.query(
      `INSERT INTO ai_hitl_logs (
        tenant_id, voucher_id, ai_confidence_score, original_ai_proposal,
        final_human_approved, is_modified, processing_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        companyId,
        voucher.id,
        match.confidence,
        JSON.stringify({ ...proposal, match }),
        JSON.stringify({ ...proposal, match }),
        false,
        status
      ]
    );

    return { voucher, proposal, match, status };
  });

  logger.info({ 
    transactionId: transaction.id,
    voucherId: result.voucher.id,
    status,
    confidence: match.confidence
  }, 'Bank transaction processed with AI');

  return result;
}

/**
 * Lấy danh sách giao dịch cần đối chiếu
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function getUnmatchedTransactions(companyId) {
  const { rows } = await pool.query(
    `SELECT ct.*, c.company_name
    FROM casso_transactions ct
    JOIN casso_company_accounts c ON ct.company_account_id = c.id
    WHERE c.company_id = $1
    AND ct.matched_voucher_id IS NULL
    AND ct.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY ct.transaction_date DESC
    LIMIT 50`,
    [companyId]
  );

  return rows;
}

export default {
  matchTransactionToOrder,
  createVoucherFromTransaction,
  getUnmatchedTransactions
};