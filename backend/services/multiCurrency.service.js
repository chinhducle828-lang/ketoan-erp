export function buildMultiCurrencyDetail(detail, exchangeRate = 1) {
  const amountOrigin = Number(detail?.amountOrigin ?? detail?.amount_origin ?? 0) || 0;
  const currencyOrigin = detail?.currencyOrigin || detail?.currency_origin || 'VND';
  const normalizedExchangeRate = Number(exchangeRate ?? 1) || 1;

  const amount = currencyOrigin === 'VND'
    ? amountOrigin
    : amountOrigin * normalizedExchangeRate;

  return {
    ...detail,
    amount,
    amountOrigin,
    currencyOrigin,
  };
}

export async function getForeignCurrencyReport(companyId, year, month) {
  const query = `
    SELECT 
      vd.currency_origin,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount_origin ELSE 0 END) as total_debit_origin,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount_origin ELSE 0 END) as total_credit_origin,
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit_vnd,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit_vnd
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1
      AND vd.currency_origin != 'VND'
      AND EXTRACT(YEAR FROM v.voucher_date) = $2
      AND EXTRACT(MONTH FROM v.voucher_date) = $3
    GROUP BY vd.currency_origin
  `;

  const { rows } = await pool.query(query, [companyId, year, month]);
  return rows;
}
