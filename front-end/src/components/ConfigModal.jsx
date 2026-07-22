/**
 * Config Modal Component
 * ====================================================================
 * Modal form để thêm/sửa system configs
 * ====================================================================
 */

import { useState, useEffect } from 'react';

const CATEGORIES = [
  { value: 'TAX_RATES', label: 'Tax Rates' },
  { value: 'FINANCIAL_THRESHOLDS', label: 'Financial Thresholds' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'AI_CONFIG', label: 'AI Configuration' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'CLOSING', label: 'Closing' },
  { value: 'VOUCHER', label: 'Voucher' },
  { value: 'NOTIFICATION', label: 'Notification' }
];

const VALUE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' },
  { value: 'array', label: 'Array' }
];

export default function ConfigModal({ config, onClose, onSave, fixedCategory }) {
  const [formData, setFormData] = useState({
    config_key: '',
    config_value: '',
    value_type: 'string',
    category: fixedCategory || 'TAX_RATES',
    description: '',
    is_sensitive: false,
    is_editable: true,
    company_id: null
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when editing or fixedCategory changes
  useEffect(() => {
    if (config) {
      setFormData({
        config_key: config.config_key || '',
        config_value: config.config_value || '',
        value_type: config.value_type || 'string',
        category: config.category || fixedCategory || 'TAX_RATES',
        description: config.description || '',
        is_sensitive: config.is_sensitive || false,
        is_editable: config.is_editable !== false,
        company_id: config.company_id || null
      });
    } else {
      setFormData(prev => ({
        ...prev,
        category: fixedCategory || prev.category
      }));
    }
  }, [config, fixedCategory]);

  const validateForm = () => {
    const newErrors = {};

    // Config key validation
    if (!formData.config_key) {
      newErrors.config_key = 'Config key is required';
    } else if (formData.config_key.length < 3) {
      newErrors.config_key = 'Config key must be at least 3 characters';
    } else if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(formData.config_key)) {
      newErrors.config_key = 'Format: category.name (lowercase, dots, no spaces)';
    }

    // Config value validation
    if (!formData.config_value && formData.config_value !== '0') {
      newErrors.config_value = 'Config value is required';
    } else if (formData.config_value.length > 10000) {
      newErrors.config_value = 'Config value must not exceed 10000 characters';
    }

    // Category validation
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    // Value type validation
    if (!formData.value_type) {
      newErrors.value_type = 'Value type is required';
    }

    // Validate value based on type
    if (formData.config_value) {
      if (formData.value_type === 'number') {
        const num = Number(formData.config_value);
        if (!Number.isFinite(num)) {
          newErrors.config_value = 'Value must be a valid number';
        }
      } else if (formData.value_type === 'boolean') {
        if (formData.config_value !== 'true' && formData.config_value !== 'false') {
          newErrors.config_value = 'Boolean value must be "true" or "false"';
        }
      } else if (formData.value_type === 'json') {
        try {
          JSON.parse(formData.config_value);
        } catch (e) {
          newErrors.config_value = 'Value must be valid JSON';
        }
      } else if (formData.value_type === 'array') {
        try {
          const parsed = JSON.parse(formData.config_value);
          if (!Array.isArray(parsed)) {
            newErrors.config_value = 'Value must be a JSON array';
          }
        } catch (e) {
          newErrors.config_value = 'Value must be a valid JSON array';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave(formData);
    } catch (err) {
      console.error('Error saving config:', err);
      setErrors({
        submit: err.response?.data?.message || 'Failed to save config'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{config ? 'Edit Config' : 'Add New Config'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="config_key">Config Key *</label>
            <input
              type="text"
              id="config_key"
              name="config_key"
              value={formData.config_key}
              onChange={handleChange}
              disabled={!!config} // Disable when editing
              placeholder="e.g., tax.standard_vat_rate"
              className={errors.config_key ? 'error' : ''}
            />
            {errors.config_key && <span className="error-text">{errors.config_key}</span>}
            {!config && (
              <small className="help-text">
                Format: category.name (lowercase, dots, no spaces)
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="config_value">Config Value *</label>
            <textarea
              id="config_value"
              name="config_value"
              value={formData.config_value}
              onChange={handleChange}
              placeholder="Enter config value"
              rows={4}
              className={errors.config_value ? 'error' : ''}
            />
            {errors.config_value && <span className="error-text">{errors.config_value}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="value_type">Value Type *</label>
              <select
                id="value_type"
                name="value_type"
                value={formData.value_type}
                onChange={handleChange}
                disabled={!!config}
              >
                {VALUE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={!!config || Boolean(fixedCategory)}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of this config"
              maxLength={500}
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_sensitive"
                checked={formData.is_sensitive}
                onChange={handleChange}
              />
              <span>Sensitive (encrypt in database)</span>
            </label>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_editable"
                checked={formData.is_editable}
                onChange={handleChange}
              />
              <span>Editable (allow changes via UI)</span>
            </label>
          </div>

          {errors.submit && (
            <div className="error-message">
              {errors.submit}
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (config ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}