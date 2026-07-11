/**
 * AI Configuration Management - Admin UI
 * Manage departments, workflows, suggestions, and batch configs
 */

import { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Workflow,
  Lightbulb,
  Upload,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-react';

// API base URL - tự động normalize để đảm bảo có /api
const getApiBase = () => {
  const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
};
const API_BASE = getApiBase();

export default function AIConfigManagement() {
  const [activeTab, setActiveTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [suggestionRules, setSuggestionRules] = useState([]);
  const [batchConfigs, setBatchConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDepartments(),
        loadWorkflows(),
        loadSuggestionRules(),
        loadBatchConfigs()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/departments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) setDepartments(data.data);
  };

  const loadWorkflows = async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/workflows`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) setWorkflows(data.data);
  };

  const loadSuggestionRules = async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/suggestion-rules`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) setSuggestionRules(data.data);
  };

  const loadBatchConfigs = async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/batch-configs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (data.success) setBatchConfigs(data.data);
  };

  const tabs = [
    { id: 'departments', name: 'Phòng ban', icon: Users, count: departments.length },
    { id: 'workflows', name: 'Workflows', icon: Workflow, count: workflows.length },
    { id: 'suggestions', name: 'Suggestion Rules', icon: Lightbulb, count: suggestionRules.length },
    { id: 'batch', name: 'Batch Configs', icon: Upload, count: batchConfigs.length }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Settings className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Configuration Management</h1>
            <p className="text-sm text-gray-500">
              Quản lý cấu hình AI: departments, workflows, suggestions, batch processing
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'departments' && (
          <DepartmentsManager
            departments={departments}
            onRefresh={loadDepartments}
          />
        )}
        {activeTab === 'workflows' && (
          <WorkflowsManager
            workflows={workflows}
            onRefresh={loadWorkflows}
          />
        )}
        {activeTab === 'suggestions' && (
          <SuggestionsManager
            rules={suggestionRules}
            onRefresh={loadSuggestionRules}
          />
        )}
        {activeTab === 'batch' && (
          <BatchConfigsManager
            configs={batchConfigs}
            onRefresh={loadBatchConfigs}
          />
        )}
      </div>
    </div>
  );
}

// ==================== DEPARTMENTS MANAGER ====================
function DepartmentsManager({ departments, onRefresh }) {
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({
    department_code: '',
    department_name: '',
    keywords: [],
    account_codes: [],
    description: ''
  });

  const handleCreate = () => {
    setEditingDept(null);
    setFormData({
      department_code: '',
      department_name: '',
      keywords: [],
      account_codes: [],
      description: ''
    });
  };

  const handleEdit = (dept) => {
    setEditingDept(dept.id);
    setFormData({
      department_code: dept.department_code,
      department_name: dept.department_name,
      keywords: dept.keywords || [],
      account_codes: dept.account_codes || [],
      description: dept.description || ''
    });
  };

  const handleSave = async () => {
    try {
      const url = editingDept
        ? `${API_BASE}/ai/departments/${editingDept}`
        : `${API_BASE}/ai/departments`;
      
      const method = editingDept ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onRefresh();
        handleCreate();
      }
    } catch (error) {
      console.error('Failed to save department:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;

    try {
      const response = await fetch(`${API_BASE}/ai/departments/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to delete department:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Departments</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {/* Form */}
      {(editingDept || formData.department_code) && (
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-3">{editingDept ? 'Edit' : 'New'} Department</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <input
                type="text"
                value={formData.department_code}
                onChange={e => setFormData({ ...formData, department_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                disabled={editingDept}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.department_name}
                onChange={e => setFormData({ ...formData, department_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Keywords (comma-separated)</label>
              <input
                type="text"
                value={formData.keywords.join(', ')}
                onChange={e => setFormData({ ...formData, keywords: e.target.value.split(',').map(k => k.trim()) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Account Codes (comma-separated)</label>
              <input
                type="text"
                value={formData.account_codes.join(', ')}
                onChange={e => setFormData({ ...formData, account_codes: e.target.value.split(',').map(a => a.trim()) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {departments.map(dept => (
          <div key={dept.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{dept.department_name}</h3>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  {dept.department_code}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{dept.description}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  Keywords: {(dept.keywords || []).length}
                </span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  Accounts: {(dept.account_codes || []).length}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(dept)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(dept.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== WORKFLOWS MANAGER ====================
function WorkflowsManager({ workflows, onRefresh }) {
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    workflow_code: '',
    workflow_name: '',
    description: '',
    steps: [],
    conditions: {}
  });

  const resetForm = () => {
    setEditingWorkflow(null);
    setShowForm(false);
    setFormData({
      workflow_code: '',
      workflow_name: '',
      description: '',
      steps: [],
      conditions: {}
    });
  };

  const handleCreate = () => {
    setEditingWorkflow(null);
    setShowForm(true);
    setFormData({
      workflow_code: '',
      workflow_name: '',
      description: '',
      steps: [],
      conditions: {}
    });
  };

  const handleEdit = (workflow) => {
    setEditingWorkflow(workflow.id);
    setShowForm(true);
    setFormData({
      workflow_code: workflow.workflow_code,
      workflow_name: workflow.workflow_name,
      description: workflow.description || '',
      steps: workflow.steps || [],
      conditions: workflow.conditions || {}
    });
  };

  const handleSave = async () => {
    try {
      const url = editingWorkflow
        ? `${API_BASE}/ai/workflows/${editingWorkflow}`
        : `${API_BASE}/ai/workflows`;
      const method = editingWorkflow ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        onRefresh();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa workflow này?')) return;
    try {
      const response = await fetch(`${API_BASE}/ai/workflows/${id}`, { method: 'DELETE' });
      if (response.ok) onRefresh();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Workflows</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Add Workflow
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-3">{editingWorkflow ? 'Edit' : 'New'} Workflow</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <input
                type="text"
                value={formData.workflow_code}
                onChange={e => setFormData({ ...formData, workflow_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                disabled={editingWorkflow}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.workflow_name}
                onChange={e => setFormData({ ...formData, workflow_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="w-4 h-4" /> Save
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {workflows.map(workflow => (
          <div key={workflow.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{workflow.workflow_name}</h3>
                <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {workflow.workflow_code}
                  </span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {(workflow.steps || []).length} steps
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(workflow)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(workflow.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== SUGGESTIONS MANAGER ====================
function SuggestionsManager({ rules, onRefresh }) {
  const [editingRule, setEditingRule] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    rule_code: '',
    rule_name: '',
    priority: 1,
    conditions: {},
    action: ''
  });

  const resetForm = () => {
    setEditingRule(null);
    setShowForm(false);
    setFormData({
      rule_code: '',
      rule_name: '',
      priority: 1,
      conditions: {},
      action: ''
    });
  };

  const handleCreate = () => {
    setEditingRule(null);
    setShowForm(true);
    setFormData({
      rule_code: '',
      rule_name: '',
      priority: 1,
      conditions: {},
      action: ''
    });
  };

  const handleEdit = (rule) => {
    setEditingRule(rule.id);
    setShowForm(true);
    setFormData({
      rule_code: rule.rule_code,
      rule_name: rule.rule_name,
      priority: rule.priority || 1,
      conditions: rule.conditions || {},
      action: rule.action || ''
    });
  };

  const handleSave = async () => {
    try {
      const url = editingRule
        ? `${API_BASE}/ai/suggestion-rules/${editingRule}`
        : `${API_BASE}/ai/suggestion-rules`;
      const method = editingRule ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        onRefresh();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save suggestion rule:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa rule này?')) return;
    try {
      const response = await fetch(`${API_BASE}/ai/suggestion-rules/${id}`, { method: 'DELETE' });
      if (response.ok) onRefresh();
    } catch (error) {
      console.error('Failed to delete suggestion rule:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Suggestion Rules</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-3">{editingRule ? 'Edit' : 'New'} Suggestion Rule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <input
                type="text"
                value={formData.rule_code}
                onChange={e => setFormData({ ...formData, rule_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                disabled={editingRule}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.rule_name}
                onChange={e => setFormData({ ...formData, rule_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <input
                type="number"
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <input
                type="text"
                value={formData.action}
                onChange={e => setFormData({ ...formData, action: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Conditions (JSON)</label>
              <textarea
                value={JSON.stringify(formData.conditions, null, 2)}
                onChange={e => {
                  try { setFormData({ ...formData, conditions: JSON.parse(e.target.value) }); }
                  catch { /* allow editing */ }
                }}
                className="w-full border rounded-lg px-3 py-2 font-mono text-xs"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="w-4 h-4" /> Save
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{rule.rule_name}</h3>
                <p className="text-sm text-gray-500 mt-1">{rule.rule_code}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Priority: {rule.priority}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Used: {rule.usage_count} times
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    Success: {rule.success_rate}%
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(rule)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== BATCH CONFIGS MANAGER ====================
function BatchConfigsManager({ configs, onRefresh }) {
  const [editingConfig, setEditingConfig] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    config_code: '',
    config_name: '',
    max_batch_size: 50,
    parallel_workers: 2,
    confidence_threshold: 85,
    auto_approve_threshold: 95
  });

  const resetForm = () => {
    setEditingConfig(null);
    setShowForm(false);
    setFormData({
      config_code: '',
      config_name: '',
      max_batch_size: 50,
      parallel_workers: 2,
      confidence_threshold: 85,
      auto_approve_threshold: 95
    });
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setShowForm(true);
    setFormData({
      config_code: '',
      config_name: '',
      max_batch_size: 50,
      parallel_workers: 2,
      confidence_threshold: 85,
      auto_approve_threshold: 95
    });
  };

  const handleEdit = (config) => {
    setEditingConfig(config.id);
    setShowForm(true);
    setFormData({
      config_code: config.config_code,
      config_name: config.config_name,
      max_batch_size: config.max_batch_size || 50,
      parallel_workers: config.parallel_workers || 2,
      confidence_threshold: config.confidence_threshold || 85,
      auto_approve_threshold: config.auto_approve_threshold || 95
    });
  };

  const handleSave = async () => {
    try {
      const url = editingConfig
        ? `${API_BASE}/ai/batch-configs/${editingConfig}`
        : `${API_BASE}/ai/batch-configs`;
      const method = editingConfig ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        onRefresh();
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save batch config:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa config này?')) return;
    try {
      const response = await fetch(`${API_BASE}/ai/batch-configs/${id}`, { method: 'DELETE' });
      if (response.ok) onRefresh();
    } catch (error) {
      console.error('Failed to delete batch config:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Batch Configurations</h2>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Add Config
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-3">{editingConfig ? 'Edit' : 'New'} Batch Config</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Code</label>
              <input
                type="text"
                value={formData.config_code}
                onChange={e => setFormData({ ...formData, config_code: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                disabled={editingConfig}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.config_name}
                onChange={e => setFormData({ ...formData, config_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Batch Size</label>
              <input
                type="number"
                value={formData.max_batch_size}
                onChange={e => setFormData({ ...formData, max_batch_size: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Parallel Workers</label>
              <input
                type="number"
                value={formData.parallel_workers}
                onChange={e => setFormData({ ...formData, parallel_workers: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confidence Threshold (%)</label>
              <input
                type="number"
                value={formData.confidence_threshold}
                onChange={e => setFormData({ ...formData, confidence_threshold: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Auto-Approve Threshold (%)</label>
              <input
                type="number"
                value={formData.auto_approve_threshold}
                onChange={e => setFormData({ ...formData, auto_approve_threshold: Number(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="w-4 h-4" /> Save
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {configs.map(config => (
          <div key={config.id} className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{config.config_name}</h3>
                <p className="text-sm text-gray-500 mt-1">{config.config_code}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Max: {config.max_batch_size}
                  </span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Workers: {config.parallel_workers}
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Confidence: {config.confidence_threshold}%
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Auto-approve: {config.auto_approve_threshold}%
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(config)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
