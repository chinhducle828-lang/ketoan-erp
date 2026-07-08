# TÀI LIỆU PHÁP LÝ NỀN TẢNG SaaS ERP KẾ TOÁN

Thư mục này chứa bộ tài liệu pháp lý tuân thủ quy định Việt Nam (có hiệu lực 2025–2026) cho nền tảng SaaS ERP Kế toán.

---

## NHÓM 1: VĂN BẢN CÔNG KHAI TRÊN WEBSITE (Nộp Bộ Công Thương)

| File | Tên văn bản | Căn cứ pháp lý chính |
|------|-------------|----------------------|
| `CHINH_SACH_BAO_MAT.md` | Chính sách bảo mật thông tin khách hàng (v2.0) | Luật BV dữ liệu cá nhân 2025 (91/2025/QH15); NĐ 356/2025/NĐ-CP; Luật ATTTM & ANM |
| `DIEU_KHOAN_SU_DUNG.md` | Điều khoản sử dụng dịch vụ - SLA/ToS (v2.0) | Luật TMĐT 2025 (122/2025/QH15); NĐ 248/2026/NĐ-CP; Luật Giao dịch điện tử; Luật BV quyền lợi NTD |
| `QUY_TRINH_THANH_TOAN.md` | Quy trình thanh toán (v2.0) | NĐ 248/2026/NĐ-CP (Điều 14); NĐ 254/2026/NĐ-CP (hóa đơn điện tử); Luật các TCTD & NHNN |
| `CHINH_SACH_HOAN_TIEN_HUY_GOI.md` | Chính sách hoàn tiền & hủy gói (v2.0) | NĐ 248/2026/NĐ-CP (Điều 14); Luật Dân sự & Luật Thương mại; Luật BV dữ liệu cá nhân 2025 |

---

## NHÓM 2: TÀI LIỆU AN TOÀN NỘI BỘ (Chống rò rỉ từ bên trong)

| File | Tên văn bản | Mục đích |
|------|-------------|----------|
| `INTERNAL_NDA_TEMPLATE.md` | Thỏa thuận bảo mật thông tin (NDA) cho Lập trình viên | Ràng buộc bảo mật mã nguồn, dữ liệu khách hàng, bí mật kinh doanh |
| `INTERNAL_IP_ASSIGNMENT.md` | Điều khoản chuyển giao quyền SHTT (IP Assignment) | Chuyển giao toàn bộ quyền sở hữu trí tuệ về công ty |
| `INTERNAL_EMPLOYMENT_DATA_PROTECTION_ADDENDUM.md` | Điều khoản bảo vệ dữ liệu trong HĐLĐ | Bảo vệ dữ liệu cá nhân của nhân viên & khách hàng |

---

## NHÓM 3: TÀI LIỆU ĐĂNG KÝ BẢN QUYỀN (Nộp Cục Bản quyền tác giả)

| File | Tên văn bản | Căn cứ pháp lý |
|------|-------------|-----------------|
| `SOURCE_CODE_PRINTING_GUIDE.md` | Hướng dẫn in mã nguồn đăng ký bản quyền | Thông tư 08/2026/TT-BVHTTDL; Luật SHTT; NĐ 17/2023/NĐ-CP |

---

## CÁC ENDPOINT LIÊN QUAN ĐÃ TRIỂN KHAI

- `GET /api/public/legal/business-info` — công khai thông tin doanh nghiệp (NĐ 248 Đ4)
- `POST /api/public/complaints` — tiếp nhận khiếu nại trực tuyến (NĐ 248)
- `GET /api/users/me/export-data` — quyền truy cập/xuất dữ liệu cá nhân (Luật BV dữ liệu cá nhân)
- `DELETE /api/users/me` — quyền xóa/ẩn danh hóa dữ liệu (quyền bị lãng quên)
- `POST /api/auth/consent` — ghi nhận sự đồng ý (click-wrap, NĐ 48/2024)
- `GET /api/e-invoices/:id` — tra cứu hóa đơn điện tử (NĐ 254/2026)
- `POST /api/refunds`, `GET /api/refunds`, `POST /api/refunds/:id/approve` — hoàn tiền (NĐ 248 Đ14)

---

## DANH SÁCH PLACEHOLDER CẦN ĐIỀN

Trước khi công bố, tìm và thay thế các placeholder sau trong toàn bộ thư mục `legal/`:

| Placeholder | Ý nghĩa | Ví dụ |
|-------------|---------|-------|
| `[TÊN DOANH NGHIỆP]` | Tên pháp lý công ty | CÔNG TY TNHH KẾ TOÁN ABC |
| `[MÃ SỐ THUẾ]` | MST doanh nghiệp | 0101234567 |
| `[ĐỊA CHỈ]` | Trụ sở chính | Số 1, đường A, Q.1, TP.HCM |
| `[EMAIL DPO]` | Email DPO | dpo@company.vn |
| `[TÊN DPO]` | Tên DPO | Nguyễn Văn A |
| `[SỐ ĐIỆN THOẠI DPO]` | Số điện thoại DPO | 090xxxxxxx |
| `[WEBSITE]` | Tên miền nền tảng | https://ketoan.example.vn |
| `[HOTLINE]` | Số điện thoại hỗ trợ | 1900xxxx |
| `[EMAIL_HOTRO]` | Email hỗ trợ | hotro@company.vn |
| `[GIẤY_PHÉP]` | Số giấy phép kinh doanh | 01xxxxx / GPKD |
| `[NGƯỜI_DAI_DIỆN]` | Người đại diện pháp luật | Nguyễn Văn B |
| `[CHỨC_VỤ]` | Chức vụ người đại diện | Giám đốc |
| `[SLA_UPTIME]` | Cam kết uptime | 99.9 |
| `[THOI_GIAN_PHAN_HOI]` | Thời gian phản hồi hỗ trợ | 4 |
| `[THOI_HAN_XU_LY_KHIEU_NAI]` | Số ngày xử lý khiếu nại | 5 |
| `[THOI_HAN_THONG_BAO]` | Số ngày báo trước thay đổi | 7 |
| `[SO_NGAY_QUA_HAN]` | Số ngày quá hạn thanh toán | 15 |
| `[SO_NGAY_DUNG_THU]` | Số ngày dùng thử | 14 |
| `[THOI_HAN_KHAC_PHUC]` | Số ngày khắc phục lỗi | 10 |
| `[THOI_HAN_YEU_CAU_HOAN_TIEN]` | Thời hạn gửi yêu cầu hoàn tiền | 30 |
| `[THOI_HAN_XU_LY_HOAN_TIEN]` | Số ngày xử lý hoàn tiền | 7 |
| `[THOI_GIAN_HOAN_TIEN]` | Số ngày hoàn tiền | 5–10 |
| `[THOI_GIAN_GIAN_DOAN_TOI_DA]` | Số giờ gián đoạn tối đa | 4 |
| `[THOI_HAN_SU_DUNG_CREDIT]` | Thời hạn sử dụng tín dụng | 365 |
| `[GIOI_HAN_GIAO_DICH]` | Hạn mức giao dịch cá nhân | 50,000,000 |
| `[GIOI_HAN_GIAO_DICH_DOANH_NGHIEP]` | Hạn mức giao dịch doanh nghiệp | 500,000,000 |
| `[BEN_CHIU_PHI_CONG_THANH_TOAN]` | Bên chịu phí cổng thanh toán | [TÊN DOANH NGHIỆP] |
| `[DATA_RETENTION_DAYS]` | Thời hạn lưu giữ dữ liệu | 3650 |
| `[REFRESH_TOKEN_EXPIRE_DAYS]` | Hạn cookie refresh token | 30 |
| `[NGÀY_HIỆU_LỰC]` | Ngày văn bản có hiệu lực | 01/07/2026 |
| `[THỜI_GIAN_HỖ_TRỢ]` | Thời gian hỗ trợ | 8:00-17:00 |
| `[EMAIL HR]` | Email phòng Nhân sự | hr@company.vn |
| `[SỐ ĐIỆN THOẠI HR]` | Số điện thoại HR | 090xxxxxxx |
| `[PHÍ ĐĂNG KÝ]` | Phí đăng ký bản quyền | 100,000 |

---

## GHI CHÚ CHO DEVELOPER

- Các bảng DB hỗ trợ: `consents`, `company_profiles`, `complaints`, `e_invoices`, `refund_requests` (xem `backend/schema.sql` và `backend/migrations/`).
- WAF, rate limiter, mã hóa (AES-256-GCM), RBAC, audit log đã được kích hoạt/mở rộng để phục vụ tuân thủ.
- Không commit file chứa thông tin thật (MST, email, token) lên repository công khai; dùng biến môi trường `.env`.
- Tất cả tài liệu nội bộ (NDA, IP Assignment, HĐLĐ Addendum) cần được ký bởi nhân viên trước khi cấp quyền truy cập repository.
- Tài liệu in mã nguồn (SOURCE_CODE_PRINTING_GUIDE.md) cần được thực hiện trước khi nộp hồ sơ đăng ký bản quyền tại Cục Bản quyền tác giả.