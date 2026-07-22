/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * TransactionClassifier.jsx - Smart auto-suggest component for transaction classification
 */

import React, { useState, useEffect, useCallback } from 'react';
import { classifyTransaction, recordClassificationFeedback } from '../services/transactionClassification.js';

/**
 * TransactionClassifier Component
 * Provides smart auto-suggest for account codes and entry types based on description
 */
const TransactionClassifier = ({ 
  description, 
  amount, 
  partnerId, 
  onClassificationChange,
  disabled = false 
}) => {
  const [classification, setClassification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced classification
  const fetchClassification = useCallback(async (content) => {
    if (!content || !content.description) {
      setClassification(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await classifyTransaction(content);
      setClassification(result);
      
      if (onClassificationChange && result.success) {
        onClassificationChange(result.classification);
      }
    } catch (err) {
      setError(err.message || 'Classification failed');
      setClassification(null);
    } finally {
      setLoading(false);
    }
  }, [onClassificationChange]);

  // Auto-classify when description changes
  useEffect(() => {
    if (disabled) return;
    
    const timer = setTimeout(() => {
      fetchClassification({
        description,
        amount,
        partner_id: partnerId
      });
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [description, amount, partnerId, fetchClassification, disabled]);

  // Handle user feedback
  const handleFeedback = async (isAccepted) => {
    if (!classification?.data?.id) return;
    
    try {
      await recordClassificationFeedback(classification.data.id, isAccepted);
    } catch (err) {
      console.error('Failed to record feedback:', err);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get layer badge color
  const getLayerBadgeColor = (layer) => {
    switch (layer) {
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-purple-100 text-purple-800';
      case 3: return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!description || disabled) {
    return null;
  }

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
      {loading && (
        <div className="flex items-center text-sm text-gray-500">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Đang phân loại giao dịch...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600">
          Lỗi phân loại: {error}
        </div>
      )}

      {classification && classification.success && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Gợi ý phân loại:</span>
            <span className={`text-xs px-2 py-1 rounded-full ${getLayerBadgeColor(classification.layer_used)}`}>
              Layer {classification.layer_used}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {classification.classification.account_code && (
              <div>
                <span className="text-gray-500">Tài khoản:</span>
                <span className="ml-2 font-medium text-blue-600">
                  {classification.classification.account_code}
                </span>
              </div>
            )}

            {classification.classification.entry_type && (
              <div>
                <span className="text-gray-500">Bút toán:</span>
                <span className={`ml-2 font-medium ${
                  classification.classification.entry_type === 'DR' ? 'text-red-600' : 'text-green-600'
                }`}>
                  {classification.classification.entry_type === 'DR' ? 'Nợ' : 'Có'}
                </span>
              </div>
            )}

            {classification.classification.department_code && (
              <div>
                <span className="text-gray-500">Phòng ban:</span>
                <span className="ml-2 font-medium text-purple-600">
                  {classification.classification.department_code}
                </span>
              </div>
            )}

            <div>
              <span className="text-gray-500">Độ tin cậy:</span>
              <span className={`ml-2 font-medium ${getConfidenceColor(classification.classification.confidence)}`}>
                {classification.classification.confidence}%
              </span>
            </div>
          </div>

          {classification.classification.reasoning && (
            <div className="text-xs text-gray-600 mt-1">
              <span className="font-medium">Lý do:</span> {classification.classification.reasoning}
            </div>
          )}

          {classification.classification.matched_keywords && classification.classification.matched_keywords.length > 0 && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Từ khóa khớp:</span> {classification.classification.matched_keywords.join(', ')}
            </div>
          )}

          {/* Feedback buttons */}
          <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500">Phản hồi:</span>
            <button
              onClick={() => handleFeedback(true)}
              className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
            >
              Đúng
            </button>
            <button
              onClick={() => handleFeedback(false)}
              className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Sai
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionClassifier;