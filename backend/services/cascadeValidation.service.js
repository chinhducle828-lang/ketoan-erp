/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { pool } from '../config/db.js';

const toInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const uniqueIntIds = (values) => {
  const ids = values
    .map((value) => toInt(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  return [...new Set(ids)];
};

const getDbClient = (client) => client || pool;

export async function assertCompanyOperational(companyId, options = {}) {
  const { client = null } = options;
  const db = getDbClient(client);
  const normalizedCompanyId = toInt(companyId);
  if (!normalizedCompanyId) {
    throw new Error('CompanyId không hợp lệ cho kiểm tra tính toàn vẹn.');
  }

  const companyRes = await db.query(
    'SELECT id, is_active FROM companies WHERE id = $1',
    [normalizedCompanyId]
  );

  if (companyRes.rows.length === 0) {
    throw new Error('Doanh nghiệp không tồn tại trong hệ thống.');
  }

  if (companyRes.rows[0].is_active === false) {
    throw new Error('Doanh nghiệp đang ngừng hoạt động. Không thể thực hiện thao tác ghi dữ liệu.');
  }

  return companyRes.rows[0];
}

export async function validateVoucherDetailReferences(options = {}) {
  const {
    client = null,
    companyId,
    details = []
  } = options;

  if (!Array.isArray(details) || details.length === 0) {
    return;
  }

  const db = getDbClient(client);
  const normalizedCompanyId = toInt(companyId);
  if (!normalizedCompanyId) {
    throw new Error('Thiếu companyId để xác thực liên kết dữ liệu chứng từ.');
  }

  const partnerIds = uniqueIntIds(details.map((item) => item?.partnerId ?? item?.partner_id));
  const itemIds = uniqueIntIds(details.map((item) => item?.itemId ?? item?.item_id));

  if (partnerIds.length > 0) {
    const partnerRes = await db.query(
      `SELECT id
       FROM partners
       WHERE company_id = $1
         AND is_active = TRUE
         AND id = ANY($2::int[])`,
      [normalizedCompanyId, partnerIds]
    );

    const validPartnerIds = new Set(partnerRes.rows.map((row) => row.id));
    const invalidPartnerIds = partnerIds.filter((id) => !validPartnerIds.has(id));
    if (invalidPartnerIds.length > 0) {
      throw new Error(`Đối tác không hợp lệ hoặc khác công ty: ${invalidPartnerIds.join(', ')}`);
    }
  }

  if (itemIds.length > 0) {
    const itemRes = await db.query(
      `SELECT id
       FROM items
       WHERE company_id = $1
         AND id = ANY($2::int[])`,
      [normalizedCompanyId, itemIds]
    );

    const validItemIds = new Set(itemRes.rows.map((row) => row.id));
    const invalidItemIds = itemIds.filter((id) => !validItemIds.has(id));
    if (invalidItemIds.length > 0) {
      throw new Error(`Vật tư không hợp lệ hoặc khác công ty: ${invalidItemIds.join(', ')}`);
    }
  }
}

export async function assertItemCanBeDeleted(options = {}) {
  const {
    client = null,
    companyId,
    itemCode
  } = options;

  const db = getDbClient(client);
  const normalizedCompanyId = toInt(companyId);
  if (!normalizedCompanyId || !itemCode) {
    throw new Error('Thiếu thông tin để kiểm tra xóa vật tư.');
  }

  const itemRes = await db.query(
    `SELECT id
     FROM items
     WHERE company_id = $1
       AND (code = $2 OR item_code = $2)
     LIMIT 1`,
    [normalizedCompanyId, itemCode]
  );

  if (itemRes.rows.length === 0) {
    return;
  }

  const itemId = itemRes.rows[0].id;
  const usageRes = await db.query(
    `SELECT COUNT(*)::int AS ref_count
     FROM voucher_details vd
     JOIN vouchers v ON v.id = vd.voucher_id
     WHERE v.company_id = $1
       AND vd.item_id = $2`,
    [normalizedCompanyId, itemId]
  );

  const refCount = usageRes.rows[0]?.ref_count || 0;
  if (refCount > 0) {
    throw new Error(`Không thể xóa vật tư vì đã phát sinh ${refCount} bút toán liên quan.`);
  }
}

export async function validateOrderPayloadReferences(options = {}) {
  const {
    client = null,
    companyId,
    customerId = null,
    items = []
  } = options;

  const normalizedCompanyId = toInt(companyId);
  if (!normalizedCompanyId) {
    throw new Error('Thiếu companyId để xác thực đơn hàng bán.');
  }

  if (customerId) {
    await validateVoucherDetailReferences({
      client,
      companyId: normalizedCompanyId,
      details: [{ partner_id: customerId }]
    });
  }

  if (Array.isArray(items) && items.length > 0) {
    await validateVoucherDetailReferences({
      client,
      companyId: normalizedCompanyId,
      details: items.map((item) => ({ item_id: item?.item_id ?? item?.itemId }))
    });
  }
}
