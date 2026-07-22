/**
 * System Configs Admin Page
 * ====================================================================
 * Trang quản lý system configs cho admin
 * ====================================================================
 */

import { useState, useEffect } from 'react';
import { systemConfigApi } from '../../utils/systemConfigApi';
import ConfigModal from '../../components/ConfigModal';

const CATEGORIES = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'TAX_RATES', label: 'Tax Rates' },
  { value: 'FINANCIAL_THRESHOLDS', label: 'Financial Thresholds' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'CLOSING', label: 'Closing' },
  { value: 'VOUCHER', label: 'Voucher' },
  { value: 'NOTIFICATION', label: 'Notification' }
];

export default function SystemConfigs() {
  const [configs, setConfigs] = useState([]);
  const [filteredConfigs, setFilteredConfigs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConfig, setEditingConfig] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Fetch configs
  const loadConfigs = async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: pagination.limit
      };

      if (selectedCategory !== 'ALL') {
        params.category = selectedCategory;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      const result = await systemConfigApi.getConfigs(params);

      if (result.success) {
        const filtered = result.data.filter(config => config.category !== 'AI_CONFIG');
        setConfigs(filtered);
        setFilteredConfigs(filtered);
        setPagination(result.pagination);
      }
    } catch (err) {
      console.error('Error loading configs:', err);
      setError('Failed to load configs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadConfigs(1);
  }, [selectedCategory, searchQuery]);

  // Filter configs by category and search
  useEffect(() => {
    let filtered = configs;

    if (selectedCategory !== 'ALL') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.config_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredConfigs(filtered);
  }, [configs, selectedCategory, searchQuery]);

  // CRUD operations
  const handleCreate = async (configData) => {
    try {
      const result = await systemConfigApi.createConfig(configData);

      if (result.success) {
        alert('Config created successfully!');
        setIsModalOpen(false);
        setEditingConfig(null);
        loadConfigs(pagination.page);
      }
    } catch (err) {
      console.error('Error creating config:', err);
      throw err;
    }
  };

  const handleUpdate = async (key, updates) => {
    try {
      const result = await systemConfigApi.updateConfig(key, updates);

      if (result.success) {
        alert('Config updated successfully!');
        setIsModalOpen(false);
        setEditingConfig(null);
        loadConfigs(pagination.page);
      }
    } catch (err) {
      console.error('Error updating config:', err);
      throw err;
    }
  };

  const handleDelete = async (key) => {
    if (!window.confirm(`Are you sure you want to delete config "${key}"?`)) {
      return;
    }

    try {
      const result = await systemConfigApi.deleteConfig(key);

      if (result.success) {
        alert('Config deleted successfully!');
        loadConfigs(pagination.page);
      }
    } catch (err) {
      console.error('Error deleting config:', err);
      alert('Failed to delete config: ' + err.response?.data?.message || err.message);
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingConfig(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingConfig(null);
  };

  const handleSave = async (formData) => {
    if (editingConfig) {
      // Update existing
      const { config_key, ...updates } = formData;
      await handleUpdate(config_key, updates);
    } else {
      // Create new
      await handleCreate(formData);
    }
  };

  const handleExport = async () => {
    try {
      const result = await systemConfigApi.exportConfigs();

      if (result.success) {
        // Create JSON file and download
        const dataStr = JSON.stringify(result.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `system-configs-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`Exported ${result.data.length} configs successfully!`);
      }
    } catch (err) {
      console.error('Error exporting configs:', err);
      alert('Failed to export configs: ' + err.response?.data?.message || err.message);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const configs = JSON.parse(text);

      if (!Array.isArray(configs)) {
        alert('Invalid JSON format. Expected an array of configs.');
        return;
      }

      if (!window.confirm(`Import ${configs.length} configs? This will update existing configs.`)) {
        return;
      }

      const result = await systemConfigApi.importConfigs(configs);

      if (result.success) {
        alert(`Import completed: ${result.data.success} success, ${result.data.failed} failed`);
        loadConfigs(pagination.page);
      }
    } catch (err) {
      console.error('Error importing configs:', err);
      alert('Failed to import configs: ' + err.response?.data?.message || err.message);
    }

    // Reset file input
    e.target.value = null;
  };

  const handlePageChange = (newPage) => {
    loadConfigs(newPage);
  };

  // Get category badge color
  const getCategoryBadgeColor = (category) => {
    const colors = {
      TAX_RATES: 'bg-blue-100 text-blue-800',
      FINANCIAL_THRESHOLDS: 'bg-green-100 text-green-800',
      SECURITY: 'bg-red-100 text-red-800',
      AI_CONFIG: 'bg-purple-100 text-purple-800',
      INVENTORY: 'bg-yellow-100 text-yellow-800',
      CLOSING: 'bg-indigo-100 text-indigo-800',
      VOUCHER: 'bg-pink-100 text-pink-800',
      NOTIFICATION: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Get value type badge color
  const getValueTypeBadgeColor = (valueType) => {
    const colors = {
      string: 'bg-gray-100 text-gray-800',
      number: 'bg-blue-100 text-blue-800',
      boolean: 'bg-green-100 text-green-800',
      json: 'bg-purple-100 text-purple-800',
      array: 'bg-yellow-100 text-yellow-800'
    };
    return colors[valueType] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">System Configuration</h1>
          <p className="mt-2 text-gray-600">
            Manage system-wide configuration settings. Changes take effect immediately.
          </p>
        </div>

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 flex-1">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              {/* Search */}
              <input
                type="text"
                placeholder="Search configs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                + Add Config
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Export JSON
              </button>
              <label className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 cursor-pointer">
                Import JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Configs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading configs...</p>
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No configs found. {searchQuery && 'Try adjusting your search.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Config Key
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredConfigs.map((config) => (
                      <tr key={config.config_key} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {config.config_key}
                          </div>
                          {config.is_sensitive && (
                            <span className="text-xs text-red-600">Sensitive</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {config.config_value}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getValueTypeBadgeColor(config.value_type)}`}>
                            {config.value_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(config.category)}`}>
                            {config.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {config.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(config)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(config.config_key)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing{' '}
                          <span className="font-medium">
                            {(pagination.page - 1) * pagination.limit + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-medium">
                            {Math.min(pagination.page * pagination.limit, pagination.total)}
                          </span>{' '}
                          of <span className="font-medium">{pagination.total}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            let pageNum;
                            if (pagination.totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                              pageNum = i + 1;
                            } else if (pagination.page >= pagination.totalPages - 2) {
                              pageNum = pagination.totalPages - 4 + i;
                            } else {
                              pageNum = pagination.page - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  pagination.page === pageNum
                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Configs</div>
            <div className="text-2xl font-bold text-gray-900">{pagination.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Categories</div>
            <div className="text-2xl font-bold text-gray-900">
              {new Set(configs.map(c => c.category)).size}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Sensitive Configs</div>
            <div className="text-2xl font-bold text-red-600">
              {configs.filter(c => c.is_sensitive).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Editable Configs</div>
            <div className="text-2xl font-bold text-green-600">
              {configs.filter(c => c.is_editable).length}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <ConfigModal
          config={editingConfig}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}