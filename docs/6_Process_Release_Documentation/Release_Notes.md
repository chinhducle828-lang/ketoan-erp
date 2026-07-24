# Ghi chú Phát hành (Release Notes)
## KETOAN ERP - Version History

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## v1.0.0 (2026-07-23) - Initial Release

### Tính năng Mới

#### Core Accounting
- ✅ Hệ thống tài khoản kế toán (COA) theo TT200/TT99
- ✅ Quản lý chứng từ: Phiếu thu (PT), Phiếu chi (PC), Nhập kho (NK), Xuất kho (XK)
- ✅ Nhật ký chung với giao diện nhập liệu trực quan
- ✅ Sổ cái và sổ chi tiết tài khoản
- ✅ Số dư đầu kỳ cho nhiều năm tài chính
- ✅ Kết chuyển cuối kỳ tự động
- ✅ Bút toán đảo (reversing entries)
- ✅ Hạch toán đa tiền tệ (VND/USD)

#### AI & Tự động hóa
- ✅ AI Financial Copilot (Text-to-SQL + RAG)
- ✅ Multi-provider AI Pool: Gemini, Groq, DeepSeek
- ✅ AI Gợi ý hạch toán thông minh
- ✅ AI Phân loại chứng từ tự động
- ✅ AI OCR Hóa đơn (Python FastAPI)
- ✅ AI Self-Fix với RLHF (Human-in-the-Loop)
- ✅ Cloudflare Proxy cho AI API calls
- ✅ Circuit breaker cho AI providers

#### Inventory & Kho
- ✅ Quản lý danh mục hàng hóa
- ✅ Phiếu nhập kho / xuất kho
- ✅ Tính giá xuất kho (AVCO/FIFO)
- ✅ Kiểm kê kho và điều chỉnh chênh lệch
- ✅ Costing layers cho quản lý giá vốn

#### Storefront (Bán hàng)
- ✅ Giao diện POS bán hàng
- ✅ Quản lý đơn hàng
- ✅ Thanh toán COD và chuyển khoản
- ✅ Kết nối realtime với ERP
- ✅ Quản lý xe giao hàng

#### Công nợ
- ✅ Quản lý đối tác (khách hàng/nhà cung cấp)
- ✅ Theo dõi công nợ phải thu / phải trả
- ✅ Đối chiếu công nợ tự động
- ✅ Bù trừ công nợ

#### Kiến trúc Hệ thống
- ✅ Kiến trúc REA (Resources-Events-Agents)
- ✅ CQRS Projection Engine
- ✅ WebSocket real-time updates
- ✅ Workflow Engine (user-defined)
- ✅ Dynamic Posting Rules
- ✅ Event Store cho audit
- ✅ Idempotency keys
- ✅ Multi-tenant (đa công ty)

#### Báo cáo
- ✅ Bảng cân đối kế toán
- ✅ Báo cáo kết quả kinh doanh
- ✅ Bảng cân đối tài khoản (Trial Balance)
- ✅ Báo cáo lưu chuyển tiền tệ
- ✅ Báo cáo thuế GTGT
- ✅ Xuất Excel tất cả báo cáo
- ✅ Dashboard tổng quan

#### Bảo mật & Quản trị
- ✅ JWT Authentication (access + refresh tokens)
- ✅ RBAC với 6 vai trò
- ✅ WAF (Web Application Firewall)
- ✅ Rate Limiting
- ✅ Audit Logs đầy đủ
- ✅ Push Notifications (Web Push)
- ✅ OTP Signing cho chứng từ quan trọng
- ✅ SSO Integration

#### Tích hợp
- ✅ Casso Open Banking
- ✅ Hóa đơn điện tử (E-invoice)
- ✅ External API Registry
- ✅ Import/Export Excel

### Lỗi đã Sửa
- Không có (phiên bản đầu tiên)

### Thay đổi Phá vỡ (Breaking Changes)
- Không có

### Nâng cấp Khuyến nghị
- Node.js >= 18.0.0 (khuyến nghị 20.x LTS)
- PostgreSQL >= 14
- Redis >= 6.x

---

## Roadmap Tương lai

### v1.1.0 (Dự kiến Q3 2026)
- Mobile App (React Native)
- Push notifications nâng cao
- Cải thiện AI accuracy
- Multi-language support (English)

### v1.2.0 (Dự kiến Q4 2026)
- Module sản xuất (Manufacturing)
- CRM nâng cao
- API Public Documentation (Swagger)
- Performance optimization