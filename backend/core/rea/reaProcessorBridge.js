/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * core/rea/reaProcessorBridge.js
 * ====================================================================
 * CẦU NỐI GIỮA EVENTS ROUTE VÀ DYNAMIC PROCESSOR ENGINE
 * ====================================================================
 * 
 * Bridge này đóng vai trò trung gian:
 *   events.js → reaProcessorBridge.js → { ReaProcessorEngine (ưu tiên) | EVENT_PROCESSORS (fallback) }
 * 
 * Nguyên tắc:
 * 1. Kiểm tra DB rea_event_processors trước (dynamic engine)
 * 2. Nếu không có config trong DB, fallback về EVENT_PROCESSORS hard-code cũ
 * 3. KHÔNG hard-code: mọi processor mới chỉ cần INSERT vào DB
 * ====================================================================
 */

import { ReaProcessorEngine } from './ReaProcessorEngine.js';
import { getEventProcessor as getLegacyProcessor, safeCall } from './reaEventMapper.js';
import { pool } from '../../config/db.js';

/**
 * Kiểm tra xem event type có config trong DB không
 */
async function hasDynamicConfig(eventType, companyId) {
  const config = await ReaProcessorEngine.getConfig(eventType, companyId);
  return config !== null;
}

/**
 * Tạo 1 dynamic processor wrapper từ config DB
 * Trả về object có dạng { validate, calculate, generateEntries }
 * để tương thích với interface của EVENT_PROCESSORS
 */
async function createDynamicProcessor(eventType, companyId) {
  const config = await ReaProcessorEngine.getConfig(eventType, companyId);
  if (!config) return null;

  return {
    validate: (data) => {
      const errors = ReaProcessorEngine.validate(config, data, companyId);
      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }
    },
    calculate: (data) => {
      return ReaProcessorEngine.calculate(config, data);
    },
    generateEntries: async (data) => {
      return await ReaProcessorEngine.generateEntries(config, data, companyId);
    }
  };
}

/**
 * Bridge function - thay thế getEventProcessor gốc
 * 
 * @param {string} eventType - Loại nghiệp vụ
 * @param {number} companyId - ID công ty
 * @returns {Promise<Object>} Processor object { validate, calculate, generateEntries }
 */
export async function getEventProcessorDynamic(eventType, companyId) {
  // 1. Thử lấy dynamic processor từ DB (ưu tiên)
  const dynamicProcessor = await createDynamicProcessor(eventType, companyId);
  if (dynamicProcessor) {
    return dynamicProcessor;
  }

  // 2. Fallback về legacy hard-code processor
  console.warn(`[Bridge] Không tìm thấy processor trong DB cho "${eventType}", dùng legacy fallback`);
  return getLegacyProcessor(eventType);
}

/**
 * Process 1 event hoàn chỉnh qua bridge
 * validate → calculate → generateEntries
 */
export async function processEvent(eventType, inputData, companyId) {
  // 1. Kiểm tra DB trước
  const hasDynamic = await hasDynamicConfig(eventType, companyId);
  
  if (hasDynamic) {
    // Dùng dynamic engine
    return await ReaProcessorEngine.process(eventType, inputData, companyId);
  }

  // 2. Fallback về legacy
  const processor = getLegacyProcessor(eventType);
  const validationResult = safeCall(processor.validate, inputData, companyId);
  if (validationResult && typeof validationResult.then === 'function') {
    await validationResult;
  }

  const calculated = safeCall(processor.calculate, inputData) || inputData;
  
  let entries = [];
  const entriesResult = processor.generateEntries(calculated);
  if (entriesResult && typeof entriesResult.then === 'function') {
    entries = await entriesResult;
  } else {
    entries = entriesResult;
  }

  return {
    validated: true,
    calculatedData: calculated,
    entries,
    configVersion: null // legacy fallback
  };
}

/**
 * Đồng bộ: kiểm tra nhanh 1 event type có dynamic config không
 */
export function hasDynamicConfigSync(eventType) {
  // Chỉ dùng cho cache check nhanh (sẽ sync khi khởi tạo)
  return false;
}