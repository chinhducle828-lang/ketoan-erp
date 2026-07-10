/**
 * OCR Scanner Component
 * Reusable document scanning component using Gemini Vision API
 */

import { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Eye,
  Edit3,
  Save,
  X,
  Camera
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function OCRScanner({ 
  onScanComplete, 
  documentType = 'invoice',
  companyId = 'demo-company',
  showPreview = true 
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File ảnh không được vượt quá 10MB');
      return;
    }

    setError(null);
    setScanResult(null);
    setValidation(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);

    // Convert to base64 and process
    const base64Reader = new FileReader();
    base64Reader.onload = async (e) => {
      const base64 = e.target.result;
      await processOCR(base64);
    };
    base64Reader.readAsDataURL(file);
  };

  const processOCR = async (imageBase64) => {
    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/ai/ocr/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          document_type: documentType,
          company_id: companyId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'OCR processing failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setScanResult(data.data);
        setEditedData(data.data.data);
        setValidation(data.data.validation);
        
        // Call parent callback
        if (onScanComplete) {
          onScanComplete(data.data);
        }
      } else {
        throw new Error('OCR processing failed');
      }

    } catch (error) {
      setError(error.message);
      logger.error('OCR error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!scanResult) return;

    try {
      const response = await fetch(`${API_BASE}/ai/ocr/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ocr_result: editedData,
          document_type: documentType,
          company_id: companyId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save OCR result');
      }

      const data = await response.json();
      
      if (data.success) {
        alert('Đã lưu kết quả OCR thành công!');
        // Reset or redirect
        handleReset();
      }

    } catch (error) {
      setError(error.message);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setValidation(null);
    setError(null);
    setPreviewUrl(null);
    setIsEditing(false);
    setEditedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 90) return 'text-green-600 bg-green-50';
    if (confidence >= 75) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 90) return 'Cao';
    if (confidence >= 75) return 'Trung bình';
    return 'Thấp';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {documentType === 'invoice' ? 'OCR Hóa Đơn' : 'OCR Chứng Từ'}
            </h3>
            <p className="text-sm text-gray-500">
              Quét và trích xuất dữ liệu từ tài liệu
            </p>
          </div>
        </div>
        
        {scanResult && (
          <button
            onClick={handleReset}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Area */}
      {!scanResult && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="ocr-upload"
          />
          
          <label htmlFor="ocr-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-blue-50 rounded-full">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Nhấp để tải ảnh lên hoặc kéo thả vào đây
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Hỗ trợ: JPG, PNG, PDF (tối đa 10MB)
                </p>
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Scanning Indicator */}
      {isScanning && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-sm text-gray-600">Đang quét tài liệu...</p>
          <p className="text-xs text-gray-500 mt-1">Vui lòng đợi trong giây lát</p>
        </div>
      )}

      {/* Results */}
      {scanResult && !isScanning && (
        <div className="space-y-4">
          {/* Confidence Score */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">
                Độ tin cậy: {scanResult.confidence}%
              </span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(scanResult.confidence)}`}>
              {getConfidenceLabel(scanResult.confidence)}
            </span>
          </div>

          {/* Validation Results */}
          {validation && (
            <div className={`p-4 rounded-lg border ${
              validation.is_valid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start gap-3">
                {validation.is_valid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {validation.is_valid ? 'Dữ liệu hợp lệ' : 'Cần kiểm tra lại'}
                  </p>
                  {validation.missing_fields && validation.missing_fields.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700">Thiếu thông tin:</p>
                      <ul className="mt-1 list-disc list-inside text-xs text-gray-600">
                        {validation.missing_fields.map((field, idx) => (
                          <li key={idx}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {validation.suggestions && validation.suggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700">Gợi ý:</p>
                      <ul className="mt-1 list-disc list-inside text-xs text-gray-600">
                        {validation.suggestions.map((suggestion, idx) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image Preview */}
            {showPreview && previewUrl && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Ảnh gốc</h4>
                <img
                  src={previewUrl}
                  alt="Document preview"
                  className="w-full h-64 object-contain bg-gray-50 rounded"
                />
              </div>
            )}

            {/* Extracted Data */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">
                  Dữ liệu trích xuất
                </h4>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditing ? 'Xem' : 'Chỉnh sửa'}
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.entries(editedData || {}).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {key}
                      </label>
                      {Array.isArray(value) ? (
                        <textarea
                          value={JSON.stringify(value, null, 2)}
                          onChange={(e) => setEditedData({ ...editedData, [key]: JSON.parse(e.target.value) })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                          rows={4}
                        />
                      ) : (
                        <input
                          type="text"
                          value={value || ''}
                          onChange={(e) => setEditedData({ ...editedData, [key]: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.entries(scanResult.data || {}).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="text-xs font-medium text-gray-600 min-w-[120px]">
                        {key}:
                      </span>
                      <span className="text-xs text-gray-900 flex-1">
                        {Array.isArray(value) 
                          ? `${value.length} items` 
                          : String(value || '-')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Lưu vào hệ thống
            </button>
          </div>
        </div>
      )}
    </div>
  );
}