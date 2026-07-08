/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useMemo, useCallback } from 'react';
import { useRealTime } from '../hooks/useRealTime';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { formatCurrency, formatNumber, getAlignmentClass } from '../utils/format.js';

// Virtual scrolling table component
export default function VirtualTable({ 
  data = [], 
  columns = [], 
  rowHeight = 50,
  headerHeight = 40,
  visibleRows = 10,
  onRowClick,
  searchable = true
}) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState({ key: null, direction: 'asc' });

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];
    
    // Search filter
    if (searchTerm) {
      result = result.filter(row => 
        columns.some(col => 
          String(row[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        return sortConfig.direction === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    
    return result;
  }, [data, searchTerm, sortConfig, columns]);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight));
  const endIndex = Math.min(
    processedData.length - 1,
    startIndex + visibleRows
  );

  // Get visible rows
  const visibleData = useMemo(() => {
    return processedData.slice(startIndex, endIndex + 1);
  }, [processedData, startIndex, endIndex]);

  // Handle scroll
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  // Handle sort
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Render cell
  const renderCell = (row, column) => {
    const value = row[column.key];
    if (column.render) {
      return column.render(value, row);
    }
    
    // Auto-format currency/numeric columns
    if (column.type === 'currency') {
      return formatCurrency(value, { currency: column.currency || 'VND' });
    }
    if (column.type === 'number') {
      return formatNumber(value, column.decimals);
    }
    
    return value;
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Search bar */}
      {searchable && (
        <div className="p-3 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm"
            />
          </div>
        </div>
      )}

      {/* Table header */}
      <div className="bg-slate-50 border-b" style={{ height: headerHeight }}>
        <div className="flex">
          {columns.map(column => (
            <div
              key={column.key}
              className="px-3 font-semibold text-xs text-slate-600 flex items-center cursor-pointer hover:bg-slate-100"
              style={{ width: column.width || 'auto', flex: column.flex || 1 }}
              onClick={() => column.sortable && handleSort(column.key)}
            >
              {column.label}
              {column.sortable && sortConfig.key === column.key && (
                <span className="ml-1 text-slate-400">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Virtual body */}
      <div 
        className="overflow-y-auto" 
        style={{ height: rowHeight * visibleRows }}
        onScroll={handleScroll}
      >
        <div style={{ height: processedData.length * rowHeight, position: 'relative' }}>
          {visibleData.map((row, index) => (
            <div
              key={row.id || index}
              className="absolute w-full flex border-b hover:bg-slate-50 cursor-pointer"
              style={{ 
                height: rowHeight,
                top: (startIndex + index) * rowHeight
              }}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map(column => (
                <div
                  key={column.key}
                  className={`px-3 text-sm flex items-center ${getAlignmentClass(column.type)}`}
                  style={{ width: column.width || 'auto', flex: column.flex || 1 }}
                >
                  {renderCell(row, column)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination info */}
      <div className="p-3 border-t text-xs text-slate-500 flex justify-between items-center">
        <span>
          Hiển thị {startIndex + 1} - {Math.min(endIndex + 1, processedData.length)} / {processedData.length}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setScrollTop(Math.max(0, scrollTop - rowHeight * visibleRows))}
            disabled={startIndex === 0}
            className="p-1 rounded disabled:opacity-50"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setScrollTop(Math.min(
              (processedData.length - visibleRows) * rowHeight,
              scrollTop + rowHeight * visibleRows
            ))}
            disabled={endIndex >= processedData.length - 1}
            className="p-1 rounded disabled:opacity-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}