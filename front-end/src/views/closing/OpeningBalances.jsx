import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { CHART_OF_ACCOUNTS } from '../../utils/constants.js';
import api from '../../utils/api.js';
import { Coins, Save } from 'lucide-react';

export default function OpeningBalances() {
  const { activeCompany } = useAuth();
  const [balances, setBalances] = useState({});

  useEffect(() => {
    if (activeCompany) loadOpeningBalances();
  }, [activeCompany]);

  const loadOpeningBalances = async () => {
    try {
      const res = await api.get(`/api/opening-balances?company_id=${activeCompany}`);
      const initial = {};
      res.data.forEach(b => {
        initial[b.account_code] = { dr: b.debit_balance, cr: b.credit_balance };
      });
      setBalances(initial);
    } catch (err) { console.error(err); }
  };

  const handleInputChange = (code, field, val) => {
    setBalances({
      ...balances,
      [code]: { ...balances[code], [field]: val }
    });
  };

  const handleSave = async () => {
    try {
      const res = await api.post('/api/opening-balances', { companyId: activeCompany, balances });
      if (res.data.success) alert('Lưu số dư đầu kỳ thành công!');
    } catch { alert('Lỗi hệ thống'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Coins className="text-amber-500" size={24} /> KHAI BÁO SỐ DƯ ĐẦU KỲ HỆ THỐNG TÀI KHOẢN TT200</h1>
        <button onClick={handleSave} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"><Save size={16} /> Lưu bảng cân đối số dư</button>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 font-bold border-b"><th className="p-3 w-32">Mã tài khoản</th><th className="p-3">Tên tài khoản Thông tư 200</th><th className="p-3 text-center">Dư Nợ đầu kỳ</th><th className="p-3 text-center">Dư Có đầu kỳ</th></tr>
          </thead>
          <tbody className="divide-y">
            {CHART_OF_ACCOUNTS.map(acc => (
              <tr key={acc.code}>
                <td className="p-3 font-mono font-bold text-slate-600">{acc.code}</td>
                <td className="p-3 text-slate-700 font-medium">{acc.name}</td>
                <td className="p-3"><input type="number" placeholder="0" value={balances[acc.code]?.dr || ''} onChange={e => handleInputChange(acc.code, 'dr', e.target.value)} className="w-full p-2 bg-slate-50 border text-xs rounded-lg font-mono text-right" /></td>
                <td className="p-3"><input type="number" placeholder="0" value={balances[acc.code]?.cr || ''} onChange={e => handleInputChange(acc.code, 'cr', e.target.value)} className="w-full p-2 bg-slate-50 border text-xs rounded-lg font-mono text-right" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}