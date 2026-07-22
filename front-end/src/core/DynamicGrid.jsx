/**
 * DynamicGrid.jsx - Data Grid động
 * Đọc cấu hình cột từ backend, tự động render table
 * Hỗ trợ: search, pagination, export CSV
 */

import { useState, useEffect, useCallback } from 'react';
import { metaApi } from './MetaApiClient';
import { useAuth } from '../context/AuthContext';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { notify } from '../utils/notify';

const PAGE_SIZE = 20;

export default function DynamicGrid({ entityType, data: propData, onRowClick, onEdit, onDelete, columns: propColumns, companyId: propCompanyId }) {
  const { activeCompany } = useAuth();
  const companyId = propCompanyId || activeCompany?.id;

  const [columns, setColumns] = useState(propColumns || []);
  const [loading, setLoading] = useState(!propColumns);
  const [rows, setRows] = useState(propData || []);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Load grid columns from API
  useEffect(() => {
    if (propColumns) {
      setColumns(propColumns);
      setLoading(false);
      return;
    }
    if (!entityType || !companyId) return;
    setLoading(true);
    metaApi
      .getGridColumns(entityType, companyId)
      .then(cols => setColumns(cols))
      .catch(() => {
        setColumns([
          { key: 'id', title: 'Mã', sortable: true, width: 80 },
          { key: 'description', title: 'Diễn giải', sortable: true },
          { key: 'status', title: 'Trạng thái', type: 'BADGE', sortable: true },
          { key: 'created_at', title: 'Ngày tạo', type: 'DATE', sortable: true }
        ]);
      })
      .finally(() => setLoading(false));
  }, [entityType, companyId, propColumns]);

  // Fetch data from API
  const fetchData = useCallback(async (search = searchTerm, pageNum = page) => {
    if (!entityType || !companyId || propData) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        company_id: companyId,
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE
      });
      if (search) params.append('search', search);

      const res = await fetch(`/api/dynamic/${entityType}?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setRows(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, companyId, propData, searchTerm, page]);

  useEffect(() => {
    if (!propData) fetchData();
    else setRows(propData);
  }, [entityType, companyId, propData]);

  // Search with debounce
  useEffect(() => {
    if (propData) return;
    const timer = setTimeout(() => {
      setPage(0);
      fetchData(searchTerm, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const handlePrevPage = () => {
    if (page > 0) {
      const newPage = page - 1;
      setPage(newPage);
      fetchData(searchTerm, newPage);
    }
  };
  const handleNextPage = () => {
    if (page < totalPages - 1) {
      const newPage = page + 1;
      setPage(newPage);
      fetchData(searchTerm, newPage);
    }
  };

  // Export CSV
  const handleExport = () => {
    let csv = '\uFEFF';
    csv += columns.map(c => c.title).join(',') + '\n';
    rows.forEach(row => {
      csv += columns.map(c => {
        const val = row[c.key];
        const str = val === null || val === undefined ? '' : String(val).replace(/,/g, ';').replace(/"/g, '""');
        return `"${str}"`;
      }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleDelete = async (row) => {
    if (!entityType || !companyId) return;
    try {
      const res = await fetch(`/api/dynamic/${entityType}/${row.id}?company_id=${companyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const json = await res.json();
      if (json.success) {
        notify.success('Đã xóa!');
        setDeleteConfirm(null);
        // Refresh list
        if (onDelete) onDelete(row.id);
        else fetchData(searchTerm, page);
      } else {
        notify.error(json.error || 'Không thể xóa');
      }
    } catch (err) {
      notify.error('Lỗi kết nối');
    }
  };

  // Render cell
  const renderCell = (row, col) => {
    const value = row[col.key];
    if (value === null || value === undefined) return '—';
    switch (col.type) {
      case 'CURRENCY':
        return Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
      case 'DATE':
        return new Date(value).toLocaleDateString('vi-VN');
      case 'BADGE': {
        let color = 'bg-slate-100 text-slate-700';
        if (['completed', 'approved', 'done', 'active'].includes(String(value).toLowerCase())) {
          color = 'bg-green-100 text-green-700';
        } else if (['pending', 'draft', 'processing'].includes(String(value).toLowerCase())) {
          color = 'bg-yellow-100 text-yellow-700';
        } else if (['failed', 'cancelled', 'rejected'].includes(String(value).toLowerCase())) {
          color = 'bg-red-100 text-red-700';
        }
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
            {value}
          </span>
        );
      }
      default:
        return String(value);
    }
  };

  if (loading && rows.length === 0) {
    return <div className="animate-pulse h-48 bg-slate-100 rounded-xl" />;
  }

  if (!columns.length) {
    return <div className="text-slate-400 text-sm p-4">Không có cấu hình cột</div>;
  }

  const hasActions = !!(onEdit || onDelete);

  return (
    <div className="space-y-3">
      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-600 mb-6">
              Bạn có chắc chắn muốn xóa bản ghi này? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Export Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
          title="Export CSV"
        >
          <Download size={14} />
          Export
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto premium-card animate-card">
        <table className="w-full text-sm animate-stagger-rows premium-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="p-3 text-left font-semibold text-slate-600"
                  style={{ width: col.width || 'auto', minWidth: col.minWidth || 80 }}
                >
                  <div className="flex items-center gap-1">
                    {col.title}
                    {col.sortable && <span className="text-slate-300">↕</span>}
                  </div>
                </th>
              ))}
              {hasActions && (
                <th className="p-3 text-right font-semibold text-slate-600 w-24">
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)} className="p-8 text-center text-slate-400">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  {columns.map(col => (
                    <td key={col.key} className="p-3 text-slate-700">
                      {renderCell(row, col)}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Sửa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => setDeleteConfirm(row)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            title="Xóa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Tổng: {total} bản ghi</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page === 0}
              className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={page >= totalPages - 1}
              className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
