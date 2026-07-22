/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * DynamicEntity.jsx - Wrapper component cho Dynamic Entity
 * Kết hợp DynamicGrid (list view) và DynamicForm (form view)
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DynamicGrid from './DynamicGrid';
import DynamicForm from './DynamicForm';
import SchemaBuilder from './SchemaBuilder';
import { metaApi } from './MetaApiClient';
import { notify } from '../utils/notify';
import { Layout, Plus, Settings, X } from 'lucide-react';

export default function DynamicEntity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const entityType = searchParams.get('entityType') || '';
  const recordId = searchParams.get('id');
  
  const [view, setView] = useState(recordId ? 'form' : 'list');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [entities, setEntities] = useState([]);
  const [showSchemaBuilder, setShowSchemaBuilder] = useState(false);

  // Load danh sách entity types từ API (không hard-coded)
  useEffect(() => {
    if (!activeCompany?.id) return;
    metaApi.listEntities(activeCompany.id)
      .then(list => {
        setEntities(list);
        // Nếu chưa có entityType, chọn entity đầu tiên
        if (!entityType && list.length > 0) {
          setSearchParams({ entityType: list[0].entity_type });
        }
      })
      .catch(() => {});
  }, [activeCompany?.id]);

  // Update view when URL params change
  useEffect(() => {
    if (recordId) {
      setSelectedRecord(recordId);
      setView('form');
    } else {
      setView('list');
      setSelectedRecord(null);
    }
  }, [recordId]);

  // Handle entity type change
  const handleEntityChange = (e) => {
    const val = e.target.value;
    if (val === '__schema_builder__') {
      setShowSchemaBuilder(true);
      return;
    }
    setSearchParams({ entityType: val });
    setSelectedRecord(null);
    setView('list');
    setRefreshKey(prev => prev + 1);
  };

  const handleRowClick = (row) => {
    setSelectedRecord(row.id);
    setSearchParams({ entityType, id: row.id });
    setView('form');
  };

  const handleEdit = (row) => {
    setSelectedRecord(row.id);
    setSearchParams({ entityType, id: row.id });
    setView('form');
  };

  const handleDelete = async (rowId) => {
    setRefreshKey(prev => prev + 1);
  };

  const handleFormSuccess = () => {
    setSearchParams({ entityType });
    setRefreshKey(prev => prev + 1);
    notify.success('Lưu thành công!');
  };

  const handleCancel = () => {
    setSearchParams({ entityType });
    setSelectedRecord(null);
    setView('list');
  };

  const handleCreateNew = () => {
    setSelectedRecord(null);
    setView('form');
  };

  const handleSchemaComplete = () => {
    setShowSchemaBuilder(false);
    if (activeCompany?.id) {
      metaApi.listEntities(activeCompany.id).then(setEntities).catch(() => {});
    }
  };

  // If no entities exist, show SchemaBuilder or empty state
  if (entities.length === 0 && !showSchemaBuilder) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Layout size={48} className="mx-auto text-slate-300 mb-4" />
          <h2 className="text-lg font-bold text-slate-700">Chưa có Dynamic Entity nào</h2>
          <p className="text-sm text-slate-500 mt-2">
            Tạo entity config đầu tiên để bắt đầu sử dụng Server-Driven UI
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowSchemaBuilder(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
            >
              Tạo Entity Config
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Schema Builder Modal */}
      {showSchemaBuilder && (
        <div className="fixed inset-0 bg-black/50 animate-fade-in flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl my-8 animate-scale-in">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-800">Tạo Dynamic Entity Config</h2>
              <button onClick={() => setShowSchemaBuilder(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <SchemaBuilder onComplete={handleSchemaComplete} />
            </div>
          </div>
        </div>
      )}

      {/* Header với Entity Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slide-up">
        <div className="flex items-center gap-3">
          <select
            value={entityType}
            onChange={handleEntityChange}
            className="text-2xl font-bold text-slate-800 bg-transparent border-b-2 border-slate-200 pb-1 pr-8 cursor-pointer focus:border-blue-500 focus:outline-none"
          >
            {entities.map(e => (
              <option key={e.entity_type} value={e.entity_type}>
                {e.title || e.entity_type.replace(/_/g, ' ').toUpperCase()}
              </option>
            ))}
            {isAdmin && <option value="__schema_builder__" className="text-blue-600">─── Tạo entity mới ───</option>}
          </select>
          {isAdmin && (
            <button
              onClick={() => setShowSchemaBuilder(true)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Tạo entity config mới"
            >
              <Settings size={16} />
            </button>
          )}
        </div>
        
        {view === 'list' && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-bold"
          >
            <Plus size={16} />
            Tạo mới
          </button>
        )}
      </div>

      {/* View: List */}
      {view === 'list' && (
        <div key={refreshKey} className="animate-card">
          <DynamicGrid
            entityType={entityType}
            onRowClick={handleRowClick}
            onEdit={handleEdit}
            onDelete={handleDelete}
            companyId={activeCompany?.id}
          />
        </div>
      )}

      {/* View: Form */}
      {view === 'form' && entityType && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">
              {selectedRecord ? 'Chi tiết' : 'Tạo mới'}
            </h2>
            <button
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
            >
              ← Quay lại
            </button>
          </div>
          
          <DynamicForm
            entityType={entityType}
            recordId={selectedRecord}
            companyId={activeCompany?.id}
            onSubmit={handleFormSuccess}
            onCancel={handleCancel}
          />
        </div>
      )}
    </div>
  );
}
