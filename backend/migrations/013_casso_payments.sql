-- ====================================================================
-- TÍCH HỢP THANH TOÁN ONLINE QUA CASSO (OPEN BANKING)
-- ====================================================================

-- Bảng lưu cấu hình webhook đã đăng ký trên Casso
CREATE TABLE IF NOT EXISTS casso_webhooks (
    id SERIAL PRIMARY KEY,
    casso_webhook_id VARCHAR(100),          -- ID webhook do Casso trả về
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    secure_token VARCHAR(255) NOT NULL,     -- Token bí mật dùng xác thực webhook
    webhook_url TEXT NOT NULL,              -- URL callback của hệ thống
    bank_account_id VARCHAR(100),           -- ID tài khoản ngân hàng trên Casso
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casso_webhooks_company ON casso_webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_casso_webhooks_casso_id ON casso_webhooks(casso_webhook_id);

-- Bảng lưu giao dịch nhận từ webhook Casso
CREATE TABLE IF NOT EXISTS casso_transactions (
    id SERIAL PRIMARY KEY,
    casso_tx_id VARCHAR(100) UNIQUE NOT NULL, -- ID giao dịch duy nhất từ Casso
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    webhook_id INT REFERENCES casso_webhooks(id) ON DELETE SET NULL,
    bank_sub_acc_id VARCHAR(100),
    amount NUMERIC(15,2) NOT NULL,
    description TEXT,
    transaction_date TIMESTAMP,
    credit BOOLEAN DEFAULT TRUE,             -- TRUE: tiền vào, FALSE: tiền ra
    order_number VARCHAR(100),               -- Mã đơn hàng parse từ description
    order_id INT,                            -- voucher XK tương ứng (nếu có)
    voucher_id INT,                          -- Phiếu thu (PT) được tạo tự động
    status VARCHAR(20) DEFAULT 'pending',    -- pending | matched | reconciled | ignored
    raw_data JSONB,                          -- Toàn bộ payload gốc từ Casso
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casso_tx_company ON casso_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_casso_tx_status ON casso_transactions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_casso_tx_order ON casso_transactions(order_number);
CREATE INDEX IF NOT EXISTS idx_casso_tx_casso_id ON casso_transactions(casso_tx_id);