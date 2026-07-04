export function buildOrderNumber(prefix = 'WEB') {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${stamp}-${random}`;
}

export function calculateTaxAmount(amount, taxRate = 0.1) {
  return Number((amount * taxRate).toFixed(2));
}

export function buildAccountingEntries({ amount, costAmount, taxAmount }) {
  return [
    { accountCode: '131', entryType: 'DR', amount: Number(amount) },
    { accountCode: '511', entryType: 'CR', amount: Number(amount - taxAmount) },
    { accountCode: '3331', entryType: 'CR', amount: Number(taxAmount) },
    { accountCode: '632', entryType: 'DR', amount: Number(costAmount) },
    { accountCode: '156', entryType: 'CR', amount: Number(costAmount) },
  ];
}
