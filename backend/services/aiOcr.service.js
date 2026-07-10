/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiOcr.service - OCR Service using Gemini Vision
 * Document scanning and data extraction
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { processDocumentOCR, validateOCRResult, isGeminiAvailable } from './geminiClient.js';

/**
 * Process uploaded document with OCR
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} documentType - Type of document (invoice, voucher)
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} OCR result
 */
export async function processDocument(imageBase64, documentType, companyId) {
  try {
    if (!isGeminiAvailable()) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI OCR service không khả dụng', 503);
    }

    // Process OCR with Gemini Vision
    const ocrResult = await processDocumentOCR(imageBase64, documentType);
    
    // Validate the extracted data
    const validation = await validateOCRResult(ocrResult.data, documentType);

    logger.info({
      companyId,
      documentType,
      confidence: ocrResult.confidence,
      isValid: validation.validation.is_valid
    }, 'Document OCR processed');

    return {
      success: true,
      data: ocrResult.data,
      validation: validation.validation,
      confidence: ocrResult.confidence,
      model: ocrResult.model
    };

  } catch (error) {
    logger.error({ error: error.message, documentType, companyId }, 'OCR processing failed');
    throw error;
  }
}

/**
 * Save OCR result to database
 * @param {Object} ocrResult - OCR result
 * @param {string} companyId - Company ID
 * @param {string} documentType - Type of document
 * @returns {Promise<Object>} Saved record
 */
export async function saveOCRResult(ocrResult, companyId, documentType = 'invoice') {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    let voucherId;
    let voucherNumber;

    if (documentType === 'invoice') {
      // Create voucher from invoice OCR
      voucherNumber = ocrResult.data.invoice_number || `OCR-${Date.now()}`;
      
      const voucherResult = await client.query(
        `INSERT INTO vouchers (
          company_id, voucher_type, voucher_date, description,
          currency, exchange_rate, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          companyId,
          'XK', // Xuất kho
          ocrResult.data.invoice_date || new Date().toISOString().split('T')[0],
          `Hóa đơn từ AI OCR: ${ocrResult.data.seller_name || 'Unknown'}`,
          ocrResult.data.currency || 'VND',
          1,
          'HUMAN_REVIEW', // Luôn cần duyệt khi OCR
          0 // System user
        ]
      );

      voucherId = voucherResult.rows[0].id;

      // Save voucher details (entries)
      if (ocrResult.data.items && Array.isArray(ocrResult.data.items)) {
        for (const item of ocrResult.data.items) {
          await client.query(
            `INSERT INTO voucher_details (
              voucher_id, account_code, entry_type, amount, description
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              voucherId,
              '511', // Default revenue account
              'DR',
              item.amount || 0,
              item.name || 'Hàng hóa/dịch vụ'
            ]
          );
        }
      }

      // Save total amount
      if (ocrResult.data.total_amount) {
        await client.query(
          `INSERT INTO voucher_details (
            voucher_id, account_code, entry_type, amount, description
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            voucherId,
            '331', // Accounts payable
            'CR',
            ocrResult.data.total_amount,
            'Tổng tiền hóa đơn'
          ]
        );
      }

    } else if (documentType === 'voucher') {
      // Create voucher from accounting voucher OCR
      voucherNumber = ocrResult.data.voucher_number || `OCR-${Date.now()}`;
      
      const voucherResult = await client.query(
        `INSERT INTO vouchers (
          company_id, voucher_type, voucher_date, description,
          currency, exchange_rate, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          companyId,
          'XK',
          ocrResult.data.voucher_date || new Date().toISOString().split('T')[0],
          ocrResult.data.description || 'Chứng từ từ AI OCR',
          'VND',
          1,
          'HUMAN_REVIEW',
          0
        ]
      );

      voucherId = voucherResult.rows[0].id;

      // Save entries
      if (ocrResult.data.entries && Array.isArray(ocrResult.data.entries)) {
        for (const entry of ocrResult.data.entries) {
          await client.query(
            `INSERT INTO voucher_details (
              voucher_id, account_code, entry_type, amount, description
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              voucherId,
              entry.account_code || '511',
              entry.debit > 0 ? 'DR' : 'CR',
              entry.debit || entry.credit || 0,
              entry.description || ''
            ]
          );
        }
      }
    }

    // Save OCR metadata
    await client.query(
      `INSERT INTO ai_ocr_results (
        company_id, voucher_id, document_type, ocr_data,
        confidence_score, validation_result, processed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        companyId,
        voucherId,
        documentType,
        JSON.stringify(ocrResult.data),
        ocrResult.confidence,
        JSON.stringify(ocrResult.validation),
        'gemini_vision'
      ]
    );

    await client.query('COMMIT');

    return {
      voucherId,
      voucherNumber,
      data: ocrResult.data,
      validation: ocrResult.validation,
      confidence: ocrResult.confidence
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message }, 'Failed to save OCR result');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get pending OCR invoices for review
 * @param {string} companyId - Company ID
 * @returns {Promise<Array>} Pending invoices
 */
export async function getPendingOCRInvoices(companyId) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        o.id,
        o.voucher_id,
        o.document_type,
        o.ocr_data,
        o.confidence_score,
        o.validation_result,
        o.created_at,
        v.voucher_number,
        v.voucher_date,
        v.description
      FROM ai_ocr_results o
      LEFT JOIN vouchers v ON o.voucher_id = v.id
      WHERE o.company_id = $1
        AND v.status = 'HUMAN_REVIEW'
      ORDER BY o.created_at DESC
      LIMIT 50`,
      [companyId]
    );

    return rows;
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Failed to get pending OCR invoices');
    throw error;
  }
}

/**
 * Approve OCR result and update voucher
 * @param {number} ocrId - OCR result ID
 * @param {string} companyId - Company ID
 * @param {Object} corrections - Optional corrections
 * @returns {Promise<Object>} Updated voucher
 */
export async function approveOCRResult(ocrId, companyId, corrections = {}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get OCR result
    const ocrResult = await client.query(
      'SELECT * FROM ai_ocr_results WHERE id = $1 AND company_id = $2',
      [ocrId, companyId]
    );

    if (ocrResult.rows.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Không tìm thấy kết quả OCR', 404);
    }

    const ocr = ocrResult.rows[0];
    const data = corrections.data || ocr.ocr_data;

    // Update voucher status to POSTED
    await client.query(
      'UPDATE vouchers SET status = $1, updated_at = NOW() WHERE id = $2',
      ['POSTED', ocr.voucher_id]
    );

    // Update OCR result
    await client.query(
      `UPDATE ai_ocr_results 
       SET approved = true, approved_at = NOW(), corrections = $3
       WHERE id = $1`,
      [ocrId, JSON.stringify(corrections)]
    );

    await client.query('COMMIT');

    return {
      success: true,
      voucherId: ocr.voucher_id,
      message: 'Đã duyệt kết quả OCR'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message, ocrId }, 'Failed to approve OCR result');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reject OCR result
 * @param {number} ocrId - OCR result ID
 * @param {string} companyId - Company ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Result
 */
export async function rejectOCRResult(ocrId, companyId, reason) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get OCR result
    const ocrResult = await client.query(
      'SELECT * FROM ai_ocr_results WHERE id = $1 AND company_id = $2',
      [ocrId, companyId]
    );

    if (ocrResult.rows.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Không tìm thấy kết quả OCR', 404);
    }

    const ocr = ocrResult.rows[0];

    // Update voucher status to CANCELLED
    await client.query(
      'UPDATE vouchers SET status = $1, updated_at = NOW() WHERE id = $2',
      ['CANCELLED', ocr.voucher_id]
    );

    // Update OCR result
    await client.query(
      `UPDATE ai_ocr_results 
       SET rejected = true, rejected_at = NOW(), rejection_reason = $3
       WHERE id = $1`,
      [ocrId, reason]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Đã từ chối kết quả OCR'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error: error.message, ocrId }, 'Failed to reject OCR result');
    throw error;
  } finally {
    client.release();
  }
}

export default {
  processDocument,
  saveOCRResult,
  getPendingOCRInvoices,
  approveOCRResult,
  rejectOCRResult
};