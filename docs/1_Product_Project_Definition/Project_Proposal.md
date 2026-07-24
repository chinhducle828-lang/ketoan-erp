# Đề xuất Dự án (Project Proposal)
## KETOAN ERP - Hệ thống Kế toán Doanh nghiệp

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Tóm tắt Dự án

### 1.1. Tên dự án
**KETOAN ERP** — Hệ thống hoạch định nguồn lực doanh nghiệp tích hợp AI

### 1.2. Vấn đề cần giải quyết
- Doanh nghiệp SME Việt Nam gặp khó khăn trong việc quản lý kế toán thủ công
- Chi phí thuê kế toán viên và phần mềm kế toán truyền thống cao
- Sai sót trong hạch toán và báo cáo thuế
- Thiếu thông tin tài chính kịp thời để ra quyết định
- Quy trình khóa sổ cuối kỳ mất nhiều thời gian

### 1.3. Giải pháp đề xuất
Một hệ thống ERP kế toán SaaS toàn diện với:
- Kế toán kép đầy đủ theo chuẩn mực Việt Nam
- AI tự động hóa nhập liệu, phân loại, gợi ý hạch toán
- Giao diện bán hàng (Storefront) tích hợp sẵn
- Báo cáo tài chính theo thời gian thực
- Kiến trúc hiện đại, dễ mở rộng

---

## 2. Phạm vi Dự án

### 2.1. Trong phạm vi (In Scope)
1. **Hệ thống kế toán lõi**: Chứng từ, sổ sách, tài khoản, báo cáo
2. **AI Copilot tài chính**: Text-to-SQL, phân tích, gợi ý
3. **OCR hóa đơn**: Nhập liệu tự động từ hình ảnh hóa đơn
4. **Quản lý kho**: Nhập/xuất/tồn, tính giá xuất (AVCO/FIFO)
5. **Storefront bán hàng**: POS, đơn hàng, thanh toán
6. **Quản lý công nợ**: Phải thu, phải trả, đối chiếu
7. **Dự báo tài chính**: Dòng tiền, khóa sổ, lương
8. **Kiến trúc REA + CQRS**: Hướng sự kiện, tách biệt command/query
9. **Quản lý quy trình**: Workflow engine, phê duyệt
10. **Phân quyền RBAC**: Đa vai trò, đa công ty

### 2.2. Ngoài phạm vi (Out of Scope)
- Module sản xuất (Manufacturing)
- Module CRM cao cấp
- Mobile App (phát triển giai đoạn sau)
- Tích hợp với các phần mềm thuế (T-VAN, iHTKK) — API cho bên thứ 3
- Module quản lý dự án

---

## 3. Giải pháp Kỹ thuật

### 3.1. Kiến trúc
- **Frontend**: React 18 + Vite 5 (SPA, TailwindCSS)
- **Backend**: Node.js 20+ / Express.js (REST API + WebSocket)
- **Database**: PostgreSQL 16 (relational) + Redis (cache & queue)
- **AI Service**: Python 3.11+ / FastAPI
- **Real-time**: Socket.io 4
- **Deployment**: Railway (PaaS)

### 3.2. Tích hợp AI
- **Gemini AI**: Primary provider (Text-to-SQL, analysis)
- **Groq**: Fallback (chat, general queries)
- **DeepSeek**: Fallback (math, code)
- **Python AI Service**: OCR, NLP, TimeSeries, SelfFix
- **Cloudflare Proxy**: IP masking cho AI API calls

### 3.3. Bảo mật
- JWT authentication (access + refresh tokens)
- bcrypt password hashing
- CORS whitelist
- Rate limiting + WAF
- Audit logs
- Helmet security headers

---

## 4. Tài nguyên Dự án

### 4.1. Đội ngũ phát triển
| Vai trò | Số lượng | Kỹ năng yêu cầu |
|---------|----------|-----------------|
| Backend Developer (Node.js) | 2 | Express, PostgreSQL, Redis, BullMQ |
| Frontend Developer (React) | 2 | React, Vite, TailwindCSS, React Query |
| AI Engineer (Python) | 1 | FastAPI, NLP, OCR, ML |
| DevOps Engineer | 1 | Docker, Railway, CI/CD |
| Kế toán viên (Product Owner) | 1 | Kiến thức kế toán TT200/TT99 |
| QA Engineer | 1 | Jest, Supertest, Stryker |

### 4.2. Công nghệ & Dịch vụ
| Dịch vụ | Chi phí ước tính/tháng |
|---------|----------------------|
| Railway (Backend hosting) | $20-50 |
| Railway (AI Service) | $20-50 |
| PostgreSQL (Railway) | $10-30 |
| Redis (Railway/Upstash) | $5-15 |
| Gemini API (free tier) | $0 |
| Groq API (free tier) | $0 |
| DeepSeek API (free tier) | $0 |
| Cloudflare (Worker) | $0-5 |
| Domain | $10-20/năm |

### 4.3. Công cụ Phát triển
| Công cụ | Mục đích |
|---------|----------|
| Visual Studio Code | IDE |
| Git + GitHub | Version control |
| Railway | Hosting & deploy |
| Postman | API testing |
| pgAdmin/DBeaver | DB management |
| RedisInsight | Redis management |

---

## 5. Thời gian Thực hiện

### 5.1. Lộ trình Chi tiết

| Phase | Mô tả | Thời gian | Trạng thái |
|-------|-------|-----------|------------|
| **Phase 0** | Khởi tạo dự án (repo, CI/CD, database) | 2 tuần | ✅ Hoàn thành |
| **Phase 1** | Core Accounting (auth, vouchers, COA, posting) | 8 tuần | ✅ Hoàn thành |
| **Phase 2** | Inventory & Storefront | 6 tuần | ✅ Hoàn thành |
| **Phase 3** | AI Integration (Copilot, OCR, providers) | 6 tuần | ✅ Hoàn thành |
| **Phase 4** | REA Events, CQRS, Dynamic Posting | 4 tuần | ✅ Hoàn thành |
| **Phase 5** | Workflow Engine, HITL/RLHF, Reporting | 6 tuần | ✅ Hoàn thành |
| **Phase 6** | Mobile App (React Native) | 8 tuần | 🔜 Kế hoạch |
| **Phase 7** | Multi-currency, Internationalization | 4 tuần | 🔜 Kế hoạch |

### 5.2. Milestones
| Milestone | Mốc thời gian | Deliverable |
|-----------|--------------|-------------|
| M1: Core Accounting MVP | End of Phase 1 | Hệ thống kế toán cơ bản có thể sử dụng |
| M2: AI Integration | End of Phase 3 | AI Copilot, OCR hoạt động |
| M3: Full Enterprise | End of Phase 5 | Đầy đủ tính năng cho doanh nghiệp |
| M4: Mobile Launch | End of Phase 6 | Mobile app trên iOS/Android |
| M5: International | End of Phase 7 | Hỗ trợ đa ngôn ngữ, đa tiền tệ |

---

## 6. Dự toán Ngân sách

### 6.1. Chi phí Phát triển (ước tính)
| Khoản mục | Chi phí (VND) | Ghi chú |
|-----------|--------------|---------|
| Nhân công phát triển | 200,000,000 - 400,000,000 | 6 tháng x 2-4 devs |
| Chi phí hosting (12 tháng) | 15,000,000 - 30,000,000 | Railway + database |
| Domain & SSL | 500,000 - 1,000,000 | /năm |
| AI API keys | 0 - 5,000,000 | Tùy mức usage |
| Tổng cộng | 215,500,000 - 436,000,000 | |

### 6.2. Chi phí Vận hành Hàng tháng
| Khoản mục | Chi phí (VND) |
|-----------|--------------|
| Railway hosting | 500,000 - 1,500,000 |
| PostgreSQL | 250,000 - 750,000 |
| Redis | 150,000 - 400,000 |
| Domain | miễn phí sau khi mua |
| AI APIs | 0 - 200,000 |
| Tổng/tháng | 900,000 - 2,850,000 |

---

## 7. Phân tích Rủi ro

### 7.1. Rủi ro Kỹ thuật
| Rủi ro | Xác suất | Tác động | Giảm thiểu |
|--------|---------|---------|------------|
| AI API không ổn định | Cao | Trung bình | Multi-provider pool, circuit breaker |
| Performance issues | Trung bình | Cao | Redis caching, query optimization |
| Data integrity errors | Thấp | Rất cao | Transaction rollback, validation layers |
| Security breach | Thấp | Rất cao | Helmet, WAF, audit logs, encryption |

### 7.2. Rủi ro Kinh doanh
| Rủi ro | Xác suất | Tác động | Giảm thiểu |
|--------|---------|---------|------------|
| Thay đổi chính sách thuế | Cao | Trung bình | Configuration-driven rules |
| Cạnh tranh từ đối thủ | Trung bình | Cao | AI differentiation, pricing |
| Khó khăn tiếp cận khách hàng | Trung bình | Cao | Freemium model, partnerships |

---

## 8. Lợi ích Kỳ vọng

### 8.1. Lợi ích Định lượng
- **Giảm 70%** thời gian nhập liệu kế toán nhờ AI OCR
- **Giảm 50%** thời gian khóa sổ cuối kỳ
- **Tăng 30%** độ chính xác hạch toán
- **Tiết kiệm 40%** chi phí thuê kế toán cho SME

### 8.2. Lợi ích Định tính
- Báo cáo tài chính theo thời gian thực
- Tuân thủ pháp luật tự động
- Giảm stress cho đội ngũ kế toán
- Hỗ trợ ra quyết định nhanh chóng

---

## 9. Kết luận

Dự án KETOAN ERP là giải pháp toàn diện cho nhu cầu quản lý kế toán của doanh nghiệp SME Việt Nam. Với kiến trúc hiện đại, tích hợp AI mạnh mẽ, và chi phí vận hành thấp, hệ thống có tiềm năng lớn để trở thành nền tảng kế toán SaaS hàng đầu thị trường.

**Đề xuất**: Phê duyệt dự án và tiếp tục phát triển các tính năng Phase 6-7 theo roadmap.