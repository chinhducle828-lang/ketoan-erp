/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * orderIngestionAI.service - Wrapper tích hợp AI vào orderIngestion
 * Tự động tạo voucher từ đơn hàng với AI proposal
 */

import { generateAccountingProposal, saveProposal } from './aiProposal.service.js';
import { enqueueAIJob } from './aiQueue.service.js';
import { determineProcessingStatus } from './hitl.service.js';
import { VoucherRepository } from '../repositories/voucher.repository.js';
import { UnitOfWork } from '../utils/unitOfWork.js';
import logger from '../utils/logger.js';

/**
 * Xử lý đơn hàng với AI đề xuất
 * @param {Object} order - Đơn hàng
 * @param {string} companyId - ID công ty
 * @param {string} [traceId] - Trace ID
 * @returns {Promise<Object>}
 */
export async function processOrderWithAI(order, companyId, traceId = null) {
  const { total_amount, description, customer_name, items } = order;

  // Tạo đề xuất AI
  const proposal = await generateAccountingProposal({
    amount: total_amount,
    description,
    partner_name: customer_name,
    items
  }, companyId);

  // Xác định trạng thái
  const status = determineProcessingStatus(
    proposal.confidence_score, 
    total_amount
  );

  // Tạo voucher trong transaction
  const result = await UnitOfWork.transaction(async (client) => {
    // Tạo voucher
    const voucher = await VoucherRepository.create({
      company_id: companyId,
      voucher_number: `ORDER-${order.id}`,
      voucher_date: new Date().toISOString().split('T')[0],
      voucher_type: 'XK',
      description: `Đơn hàng ${order.order_number || order.id}`,
      currency: 'VND',
      exchange_rate: 1,
      created_by: null,
      is_posted: status === 'AUTO_POSTED'
    }, client);

    // Tạo chi tiết
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
        proposal.confidence_score,
        JSON.stringify(proposal),
        JSON.stringify(proposal),
        false,
        status
      ]
    );

    return { voucher, proposal, status };
  }, traceId);

  // Nếu cần duyệt, đưa vào queue
  if (status !== 'AUTO_POSTED') {
    await enqueueAIJob('review', {
      voucher_id: result.voucher.id,
      company_id: companyId,
      proposal: result.proposal
    }, traceId);
  }

  logger.info({ 
    orderId: order.id,
    voucherId: result.voucher.id,
    status,
    confidence: proposal.confidence_score
  }, 'Order processed with AI');

  return result;
}

export default {
  processOrderWithAI
};