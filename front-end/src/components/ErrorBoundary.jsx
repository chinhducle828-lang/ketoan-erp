/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Error Boundary - Ngăn chặn crash toàn bộ ứng dụng khi có lỗi render
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
          <div className="text-center p-8 bg-white rounded-2xl shadow-soft max-w-lg w-full">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {this.props.title || 'Đã xảy ra lỗi'}
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              {this.props.message || 'Ứng dụng gặp sự cố. Vui lòng thử lại hoặc liên hệ quản trị viên.'}
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="text-left mb-4 bg-slate-100 rounded-lg p-3">
                <summary className="text-xs font-mono text-slate-500 cursor-pointer">
                  Chi tiết lỗi (development only)
                </summary>
                <pre className="text-xs font-mono text-red-600 mt-2 whitespace-pre-wrap overflow-auto max-h-32">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Thử lại
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 transition-colors"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}