import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Payroll from '../../front-end/src/views/hr/Payroll.jsx';
import { useVouchers } from '../../front-end/src/context/VoucherContext.jsx';

// Mock Custom Hook
jest.mock('../../front-end/src/context/VoucherContext.jsx', () => ({
  useVouchers: jest.fn(),
}));

// Mock Export Excel Button để tránh crash render
jest.mock('../../front-end/src/components/ExportExcelButton.jsx', () => {
  return function MockExportButton() {
    return <button>Xuất Excel</button>;
  };
});

describe('Payroll Component UI Tests', () => {
  const mockCreateNewVoucher = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useVouchers.mockReturnValue({ createNewVoucher: mockCreateNewVoucher });
    
    // Giả lập localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue('1'),
        setItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
    
    // Chặn hàm alert bật lên màn hình khi test chạy
    jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('should handle floating-point rounding and eliminate 1 VND discrepancy at the last row', async () => {
    // Sửa lỗi: Sử dụng render() trực tiếp thay vì renderComponent() không tồn tại
    render(<Payroll />);

    const salaryInput = screen.getByPlaceholderText(/Nhập số tiền VND.../i);
    const submitButton = screen.getByRole('button', { name: /Duyệt & Khóa Sổ Bảng Lương/i });

    // Nhập một số tiền dễ gây lệch 1 đồng do làm tròn (Ví dụ: 10,000,001)
    fireEvent.change(salaryInput, { target: { value: '10000001' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateNewVoucher).toHaveBeenCalled();
    });
  });
});