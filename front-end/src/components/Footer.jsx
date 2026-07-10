/**
 * Footer Component (ERP)
 * 
 * Hiển thị các liên kết pháp lý công khai theo:
 * - NĐ 248/2026/NĐ-CP Điều 4: Công khai thông tin doanh nghiệp
 * - Luật BV dữ liệu cá nhân 2025: Quyền được thông tin
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';

export default function Footer({ companyId }) {
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [docs, setDocs] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);

  useEffect(() => {
    // Load danh sách tài liệu
    api.get('/public/legal/documents')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setDocs(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const openDocument = async (type, title) => {
    try {
      const res = await api.get(`/public/legal/documents/${type}`);
      if (res.data?.success) {
        setModalTitle(title);
        setModalContent(res.data.data.content);
        setShowModal(true);
      }
    } catch {
      setModalTitle('Lỗi');
      setModalContent('Không thể tải nội dung tài liệu. Vui lòng thử lại sau.');
      setShowModal(true);
    }
  };

  return (
    <>
      <footer className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
            {docs.map((doc) => (
              <button
                key={doc.type}
                onClick={() => openDocument(doc.type, doc.title)}
                className="hover:text-indigo-600 hover:underline transition-colors"
              >
                {doc.title}
              </button>
            ))}
            {businessInfo && (
              <button
                onClick={() => {
                  setModalTitle('Thông tin doanh nghiệp');
                  setModalContent(`
Tên doanh nghiệp: ${businessInfo.legal_name || businessInfo.name || 'Chưa cập nhật'}
Mã số thuế: ${businessInfo.tax_code || 'Chưa cập nhật'}
Địa chỉ: ${businessInfo.address || 'Chưa cập nhật'}
Email: ${businessInfo.email || 'Chưa cập nhật'}
Hotline: ${businessInfo.hotline || 'Chưa cập nhật'}
Website: ${businessInfo.website || 'Chưa cập nhật'}
${businessInfo.dpo_name ? `\nDPO: ${businessInfo.dpo_name} (${businessInfo.dpo_email || ''})` : ''}
                  `.trim());
                  setShowModal(true);
                }}
                className="hover:text-indigo-600 hover:underline transition-colors"
              >
                Thông tin doanh nghiệp
              </button>
            )}
            <span className="text-slate-300">|</span>
            <span>© {new Date().getFullYear()} [TÊN DOANH NGHIỆP].</span>
          </div>
        </div>
      </footer>

      {/* Modal xem nội dung */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div
            className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{modalTitle}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {modalContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}