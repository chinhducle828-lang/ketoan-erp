import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Đã xảy ra lỗi
              </h1>
              <p className="text-slate-600 mb-6">
                Hệ thống gặp sự cố không mong muốn. Vui lòng thử lại hoặc liên hệ quản trị viên.
              </p>
              
              <details className="text-left bg-slate-50 rounded-lg p-4 mb-6">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700 mb-2">
                  Chi tiết lỗi (Dev Mode)
                </summary>
                <pre className="text-xs text-red-600 overflow-auto max-h-64 whitespace-pre-wrap">
                  {this.state.error?.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                    window.location.reload();
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition"
                >
                  Tải lại trang
                </button>
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }}
                  className="px-6 py-2 border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition"
                >
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;