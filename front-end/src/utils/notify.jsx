/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { toast } from 'react-toastify';

/**
 * Utility wrapper quanh react-toastify để thay thế các alert() native
 * Cung cấp các hàm tiện ích: success, error, warning, info
 */

const DEFAULT_OPTIONS = {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
};

export const notify = {
  success: (message, options = {}) => {
    return toast.success(message, { ...DEFAULT_OPTIONS, ...options });
  },

  error: (message, options = {}) => {
    return toast.error(message, { ...DEFAULT_OPTIONS, ...options });
  },

  warning: (message, options = {}) => {
    return toast.warning(message, { ...DEFAULT_OPTIONS, ...options });
  },

  info: (message, options = {}) => {
    return toast.info(message, { ...DEFAULT_OPTIONS, ...options });
  },

  // Trả về true/false để dễ dàng thay thế alert() trong if/else
  confirm: async (message = 'Xác nhận thực hiện?') => {
    return new Promise((resolve) => {
      toast(
        ({ closeToast }) => (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-800">{message}</p>
            <div className="flex gap-2 justify-end mt-1">
              <button
                onClick={() => { closeToast(); resolve(true); }}
                className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700"
              >
                Xác nhận
              </button>
              <button
                onClick={() => { closeToast(); resolve(false); }}
                className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-300"
              >
                Hủy
              </button>
            </div>
          </div>
        ),
        { ...DEFAULT_OPTIONS, autoClose: false, closeOnClick: false }
      );
    });
  }
};

export default notify;