# Tài liệu Yêu cầu Sản phẩm (PRD)
## KETOAN ERP - Hệ thống Kế toán Doanh nghiệp

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  
**Trạng thái:** Đang phát triển  

---

## 1. Tổng quan Sản phẩm

### 1.1. Tên sản phẩm
**KETOAN ERP** — Hệ thống hoạch định nguồn lực doanh nghiệp tích hợp kế toán kép theo Thông tư 200/2014/TT-BTC và Thông tư 99/2025/TT-BTC.

### 1.2. Tầm nhìn
Trở thành nền tảng kế toán SaaS hàng đầu cho doanh nghiệp vừa và nhỏ tại Việt Nam, tích hợp trí tuệ nhân tạo (AI) để tự động hóa hoàn toàn quy trình kế toán — từ nhập liệu, phân loại chứng từ, hạch toán, đến lập báo cáo tài chính.

### 1.3. Sứ mệnh
- **Đơn giản hóa** công tác kế toán cho doanh nghiệp Việt Nam
- **Tự động hóa** bằng AI các tác vụ thủ công, tốn thời gian
- **Đảm bảo tuân thủ** pháp luật thuế và kế toán mới nhất
- **Cung cấp thông tin tài chính** theo thời gian thực để hỗ trợ ra quyết định

### 1.4. Mục tiêu sản phẩm
1. Hệ thống kế toán kép đầy đủ theo chuẩn mực Việt Nam (TT200 & TT99)
2. AI Copilot tài chính với khả năng Text-to-SQL, phân tích dữ liệu
3. Xử lý OCR hóa đơn tự động
4. Tự động hóa quy trình khóa sổ cuối kỳ
5. Quản lý kho, bán hàng (Storefront), công nợ, dòng tiền
6. Hỗ trợ đa công ty, đa chi nhánh
7. Kiến trúc hướng sự kiện (Event-Driven / REA)
8. Báo cáo tài chính động

---

## 2. Đối tượng Người dùng

| Vai trò | Mô tả | Quyền chính |
|---------|-------|-------------|
| **admin** | Quản trị hệ thống | Toàn quyền, audit logs, cấu hình |
| **ktt** | Kế toán trưởng | Phê duyệt, kiểm tra, khóa sổ |
| **nv** | Nhân viên kế toán | Nhập chứng từ, hạch toán |
| **nv_banhang** | Nhân viên bán hàng | Lập đơn hàng, xuất hóa đơn |
| **nv_kho** | Thủ kho | Nhập/xuất kho, kiểm kê |
| **gd_kinhdoanh** | Giám đốc kinh doanh | Dashboard, báo cáo doanh thu |

### 2.1. Phân cấp doanh nghiệp mục tiêu
- SME (Small & Medium Enterprises): 10-500 nhân viên
- Doanh nghiệp có nhiều chi nhánh/công ty con
- Công ty thương mại, sản xuất nhẹ, dịch vụ

---

## 3. Tính năng Sản phẩm (Epics & Features)

### 3.1. Epic 1: Kế toán Tổng hợp (Core Accounting)

| Tính năng | Mức độ ưu tiên | Mô tả |
|-----------|---------------|-------|
| Hệ thống tài khoản (COA) | P0 | Danh mục tài khoản kế toán theo TT200/TT99 |
| Nhật ký chung | P0 | Ghi nhận bút toán kế toán kép |
| Sổ cái / Sổ chi tiết | P0 | Sổ cái tài khoản, sổ chi tiết đối tượng |
| Chứng từ gốc (PT, PC, NK, XK) | P0 | Phiếu thu, chi, nhập, xuất |
| Hạch toán đa tiền tệ | P1 | Hỗ trợ ngoại tệ, tỷ giá quy đổi |
| Bút toán đảo | P1 | Đảo ngược bút toán cuối kỳ |
| Kết chuyển cuối kỳ | P0 | Tự động kết chuyển doanh thu, chi phí |
| Số dư đầu kỳ | P0 | Nhập và quản lý số dư đầu kỳ |

### 3.2. Epic 2: Công nợ & Thanh toán

| Tính năng | Mức độ ưu tiên | Mô tả |
|-----------|---------------|-------|
| Quản lý nhà cung cấp & khách hàng | P0 | Danh sách đối tác, mã số thuế |
| Công nợ phải thu | P0 | Theo dõi khoản phải thu khách hàng |
| Công nợ phải trả | P0 | Theo dõi khoản phải trả nhà cung cấp |
| Đối chiếu công nợ tự động | P1 | Tự động đối chiếu chênh lệch |
| Bù trừ công nợ | P1 | Bù trừ công nợ nội bộ/liên công ty |
| Tích hợp ngân hàng Casso | P1 | Đồng bộ giao dịch ngân hàng tự động |

### 3.3. Epic 3: Kho & Hàng hóa

| Tính năng | Mức độ ưu tiên | Mô tả |
|-----------|---------------|-------|
| Danh mục hàng hóa | P0 | Quản lý items, mã vạch, đơn vị tính |
| Nhập kho | P0 | Phiếu nhập kho, giá vốn |
| Xuất kho | P0 | Phiếu xuất kho, tính giá xuất |
| Tính giá xuất kho (AVCO/FIFO) | P0 | Bình quân gia quyền hoặc nhập trước xuất trước |
| Kiểm kê kho | P0 | Kiểm kê thực tế, điều chỉnh chênh lệch |
| Tồn kho an toàn | P2 | Cảnh báo tồn kho thấp/cao |

### 3.4. Epic 4: AI & Tự động hóa

| Tính năng | Mức độ ưu tiên | Mô tả |
|-----------|---------------|-------|
| AI Financial Copilot | P0 | Trợ lý tài chính thông minh (Text-to-SQL) |
| AI OCR Hóa đơn | P0 | Quét và nhập liệu hóa đơn tự động |
| AI Phân loại chứng từ | P1 | Tự động phân loại chứng từ theo nội dung |
| AI Gợi ý hạch toán | P0 | Đề xuất bút toán dựa trên AI |
| AI Dự báo dòng tiền | P1 | Dự báo thu/chi trong tương lai |
| AI Dự báo khóa sổ | P1 | Dự báo bút toán kết chuyển cuối kỳ |
| AI Self-Fix (RLHF) | P1 | AI tự sửa lỗi dựa trên phản hồi người dùng |
| AI Phát hiện gian lận | P2 | Phát hiện hóa đơn/chứng từ bất thường |
| Multi-AI Provider Pool | P0 | Gemini, Groq, DeepSeek với load balancing |

### 3.5. Epic 5: Bán hàng (Storefront)

| Tính năng | Mức độ ưu tiên | Mô tả |
|-----------|---------------|-------|
| Giao diện bán hàng | P0 | POS đơn giản cho người bán hàng |
| Quản lý đơn hàng | P0 | Tạo, sửa, hủy đơn hàng |
| Giỏ hàng | P0 | Chọn sản phẩm, số lượng |
| Thanh toán (COD/Banking) | P0 | Nhiều phương thức thanh toán |
| Kết nối realtime với ERP | P0 | Đồng bộ đơn hàng vào kế toán |
| Xe giao hàng | P1 | Quản lý xe và lộ trình giao hàng |

### 3.6. Epic 6: Báo cáo & Phân tích

| Tính năng | Mức độ ưu tiên | Mô tả |
|-----------|---------------|-------|
| Bảng cân đối kế toán | P0 | Báo cáo tài chính chuẩn |
| Báo cáo kết quả kinh doanh | P0 | BC KQKD theo TT200/TT99 |
| Báo cáo lưu chuyển tiền tệ | P1 | Dòng tiền gián tiếp/trực tiếp |
| Sổ nhật ký chung | P0 | In sổ sách kế toán |
| Bảng cân đối tài khoản | P0 | Trial Balance |
| Báo cáo thuế | P1 | Báo cáo thuế GTGT, TNDN |
| Xuất Excel | P0 | Xuất báo cáo ra Excel |
| Dashboard động | P0 | Biểu đồ, chỉ số KPI |

### 3.7. Epic 7: Kiến trúc Hệ thống

| Tính năng | Mức độ ưu tiên | Mô tả |
|-----------|---------------|-------|
| Multi-tenant (đa công ty) | P0 | Mỗi công ty là một tenant riêng |
| Phân quyền RBAC | P0 | Role-based access control |
| Audit Logs | P0 | Ghi lại mọi thay đổi |
| REA Event-Driven | P0 | Kiến trúc hướng sự kiện |
| CQRS Projection | P1 | Tách biệt command/query |
| Workflow Engine | P1 | Quy trình phê duyệt tùy chỉnh |
| WebSocket Real-time | P0 | Cập nhật thời gian thực |
| RESTful API | P0 | API đầy đủ cho tích hợp |

---

## 4. User Stories

### 4.1. Kế toán viên
> "Là một kế toán viên, tôi muốn nhập chứng từ kế toán nhanh chóng để tiết kiệm thời gian và giảm sai sót."

**Acceptance Criteria:**
- Tạo chứng từ thu/chi/nhập/xuất trong < 30 giây
- AI gợi ý tài khoản hạch toán phù hợp
- Tự động kiểm tra cân đối Nợ/Có
- Xem trước và in chứng từ

### 4.2. Kế toán trưởng
> "Là một kế toán trưởng, tôi muốn kiểm tra và phê duyệt chứng từ để đảm bảo tính chính xác trước khi khóa sổ."

**Acceptance Criteria:**
- Xem bảng tổng hợp chứng từ chờ duyệt
- So sánh AI proposal với bút toán thực tế
- Phê duyệt/từ chối hàng loạt
- Khóa sổ cuối kỳ với kiểm tra tự động

### 4.3. Giám đốc kinh doanh
> "Là một giám đốc kinh doanh, tôi muốn xem báo cáo doanh thu và lợi nhuận theo thời gian thực để ra quyết định kịp thời."

**Acceptance Criteria:**
- Dashboard tổng quan tài chính
- Biểu đồ doanh thu theo ngày/tuần/tháng
- So sánh với kỳ trước
- Xuất báo cáo PDF/Excel

### 4.4. Quản trị viên hệ thống
> "Là một quản trị viên, tôi muốn quản lý người dùng và phân quyền để đảm bảo an toàn dữ liệu."

**Acceptance Criteria:**
- CRUD người dùng
- Phân quyền theo vai trò và công ty
- Xem audit logs
- Cấu hình hệ thống

---

## 5. Yêu cầu Phi chức năng (NFRs)

| Loại | Yêu cầu | Mục tiêu |
|------|---------|----------|
| **Hiệu suất** | Thời gian phản hồi API | < 200ms (95th percentile) |
| | Xử lý chứng từ hàng loạt | 1000 chứng từ/phút |
| | Kết xuất báo cáo | < 5 giây cho 1 năm dữ liệu |
| | Thời gian khởi động server | < 10 giây |
| **Bảo mật** | Mã hóa mật khẩu | bcrypt, salt rounds ≥ 10 |
| | JWT Authentication | Access token 15 phút, Refresh token 30 ngày |
| | CORS | Chỉ cho phép origin đã cấu hình |
| | Rate Limiting | 100 req/phút/IP |
| | Helmet security headers | Đầy đủ HTTP security headers |
| **Khả dụng** | Uptime | 99.9% (SLA) |
| | Database backup | Tự động hàng ngày |
| | Graceful degradation | Hoạt động khi mất kết nối AI |
| **Mở rộng** | Horizontal scaling | Support Railway deployment |
| | Database connection pool | 50 connections mặc định |
| | Redis caching | Cache báo cáo, số dư tài khoản |
| **Tuân thủ** | TT200/2014/TT-BTC | Đầy đủ chuẩn mực kế toán |
| | TT99/2025/TT-BTC | Chuẩn mực mới nhất |
| | NĐ 48/2024/NĐ-CP | Bảo vệ dữ liệu cá nhân |
| | NĐ 254/2026/NĐ-CP | Hóa đơn điện tử |
| **Khả năng bảo trì** | Kiến trúc module | Các service độc lập |
| | Logging | Pino logger với correlation ID |
| | Monitoring | Health check endpoints |
| | Testing coverage | ≥ 80% code coverage |

---

## 6. KPIs & Thành công

| KPI | Mục tiêu | Cách đo |
|-----|---------|---------|
| Số chứng từ xử lý/ngày | > 500 | Backend metrics |
| Tỷ lệ AI tự động posted | > 60% | ai_hitl_logs |
| Độ chính xác AI | > 90% | Human review feedback |
| Thời gian khóa sổ | < 1 ngày | closing_entries timestamps |
| API uptime | > 99.9% | Health check pings |
| Lỗi production | < 5/tháng | Error tracking |

---

## 7. Lộ trình Phát triển (Roadmap)

| Phase | Mô tả | Timeline |
|-------|-------|----------|
| **Phase 1** | Core Accounting + Auth | Đã hoàn thành |
| **Phase 2** | Inventory + Storefront | Đã hoàn thành |
| **Phase 3** | AI Integration (Copilot, OCR) | Đã hoàn thành |
| **Phase 4** | REA + CQRS + Dynamic Posting | Đã hoàn thành |
| **Phase 5** | Workflow Engine + HITL/RLHF | Đã hoàn thành |
| **Phase 6** | Reporting + Analytics | Đang phát triển |
| **Phase 7** | Mobile App + Push Notifications | Kế hoạch |
| **Phase 8** | Multi-currency + International | Kế hoạch |

---

## 8. Ràng buộc & Giả định

### Ràng buộc
- Backend bắt buộc chạy Node.js ≥ 18.0.0
- Database PostgreSQL (không hỗ trợ MySQL/SQLite cho production)
- Frontend yêu cầu React ≥ 18.2.0
- AI Service yêu cầu Python 3.11+
- Redis yêu cầu cho caching và queue
- Deploy trên Railway (PaaS hiện tại)

### Giả định
- Người dùng có kiến thức kế toán cơ bản
- Doanh nghiệp đã có mã số thuế và đăng ký kinh doanh
- Internet ổn định (ứng dụng web SaaS)
- API keys AI được cung cấp riêng (Gemini, Groq, DeepSeek)

---

## 9. Rủi ro & Giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|--------|--------|------------|
| Thay đổi chính sách thuế | Cao | Cập nhật schema linh hoạt, configuration-driven |
| API AI không khả dụng | Trung bình | Multi-provider pool, circuit breaker, fallback |
| Mất kết nối database | Cao | Connection pool, retry, health check |
| Lỗi dữ liệu kế toán | Cao | Audit trail, transaction rollback, validation layers |
| Performance bottleneck | Trung bình | Redis caching, database indexing, query optimization |

---

## 10. Phụ lục

### 10.1. Công nghệ sử dụng

| Thành phần | Công nghệ |
|-----------|-----------|
| **Backend** | Node.js 20+, Express 4.x |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis (ioredis) |
| **ORM** | pg (native driver) |
| **Validation** | Zod 4.x |
| **Auth** | JWT (jsonwebtoken) |
| **AI Backend** | Python/FastAPI |
| **AI Providers** | Google Gemini, Groq, DeepSeek |
| **Frontend** | React 18, Vite 5 |
| **Styling** | TailwindCSS 3 |
| **Real-time** | Socket.io 4 |
| **Queue** | BullMQ |
| **Logging** | Pino |
| **Testing** | Jest 30, Stryker, Vitest |
| **Deploy** | Railway (PaaS) |

### 10.2. Chuẩn mực Kế toán
- Thông tư 200/2014/TT-BTC: Chế độ kế toán doanh nghiệp
- Thông tư 99/2025/TT-BTC: Sửa đổi, bổ sung TT200
- Chuẩn mực kế toán Việt Nam (VAS)
- Hệ thống tài khoản thống nhất

### 10.3. Danh sách Tài khoản Kế toán (mặc định)
(file `backend/schema.sql` — mục INSERT INTO chart_of_accounts)