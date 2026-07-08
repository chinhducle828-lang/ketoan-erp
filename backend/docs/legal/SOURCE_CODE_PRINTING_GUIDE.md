# HƯỚNG DẪN IN MÃ NGUỒN ĐĂNG KÝ BẢN QUYỀN
## Theo Thông tư 08/2026/TT-BVHTTDL - Cục Bản quyền tác giả

**Phiên bản:** 1.0  
**Ngày hiệu lực:** [NGÀY_HIỆU_LỰC]  
**Đơn vị:** [TÊN DOANH NGHIỆP]  
**Mã số thuế:** [MÃ SỐ THUẾ]

---

## 1. CĂN CỨ PHÁP LÝ

- **Thông tư số 08/2026/TT-BVHTTDL** (ngày 15/01/2026) — quy định hệ thống biểu mẫu, tờ khai phục vụ nộp hồ sơ xin cấp Giấy chứng nhận bản quyền phần mềm.
- **Luật Sở hữu trí tuệ số 50/2005/QH11** (đã sửa đổi, bổ sung) — bảo hộ chương trình máy tính dưới hình thức quyền tác giả.
- **Nghị định số 17/2023/NĐ-CP** (Cập nhật Dự thảo sửa đổi năm 2026) — hướng dẫn thi hành Luật Sở hữu trí tuệ về quyền tác giả.

### Yêu cầu chính của Thông tư 08/2026/TT-BVHTTDL:
1. **Tờ khai đăng ký quyền tác giả** (theo mẫu của Cục Bản quyền tác giả)
2. **Bản in mã nguồn (source code printout)** — in ra giấy hoặc file PDF
3. **Bản mô tả phần mềm** — tên, phiên bản, chức năng, công nghệ
4. **Bản sao CMND/CCCD** của tác giả và chủ sở hữu
5. **Hợp đồng chuyển giao quyền SHTT** nếu tác giả là nhân viên

---

## 2. TỔNG QUAN

### Mục đích
- **Chứng minh quyền sở hữu:** Bản in mã nguồn là bằng chứng pháp lý chứng minh bạn là chủ sở hữu phần mềm.
- **Bảo vệ bản quyền:** Đăng ký bản quyền giúp bảo vệ quyền sở hữu trí tuệ trước các hành vi sao chép trái phép.
- **Hỗ trợ tố tụng:** Giấy chứng nhận bản quyền là bằng chứng mạnh nhất trong các vụ kiện vi phạm bản quyền.

### Phạm vi áp dụng
- Phần mềm, ứng dụng, website, mobile app
- Thư viện, framework, plugin, extension
- Script, automation tool, CI/CD pipeline
- Thuật toán, logic nghiệp vụ độc quyền

### Thời hạn bảo hộ
- **Quyền tác giả:** Bảo hộ **suốt đời tác giả + 50 năm** sau khi tác giả chết.
- **Bí mật kinh doanh:** Bảo hộ **không thời hạn** miễn là thông tin vẫn là bí mật.

---

## 3. CHUẨN BỊ MÃ NGUỒN

### 3.1. Kiểm kê toàn bộ mã nguồn

1. **Liệt kê tất cả các file:**
   - Frontend: `.js`, `.jsx`, `.ts`, `.tsx`, `.vue`, `.css`, `.scss`
   - Backend: `.js`, `.ts`, `.py`, `.java`, `.go`
   - Database: `.sql`, migration scripts
   - Config: `.json`, `.yaml`, `.env.example`
   - Docs: `.md`, `.txt`

2. **Tạo danh sách file:** Tên file, đường dẫn, số dòng, ngôn ngữ, tác giả.

3. **Sắp xếp:** Thư mục gốc trước, alphabetically hoặc theo cấu trúc thư mục.

### 3.2. Loại bỏ thông tin nhạy cảm

Trước khi in, cần thay thế các thông tin sau:

| Loại | Xử lý |
|------|-------|
| API keys, tokens, passwords | Thay bằng `[REDACTED]` |
| Thông tin cá nhân | Xóa hoặc thay bằng placeholder |
| Internal server IP | Thay bằng `[REDACTED]` |
| Database credentials | Xóa hoặc thay bằng `[REDACTED]` |
| Third-party code (node_modules, vendor) | Không in, chỉ in proprietary code |

### 3.3. Cài đặt in ấn

| Thông số | Giá trị |
|----------|---------|
| Font | Consolas, Monaco, Courier New |
| Font size | 10-12pt |
| Page size | A4 |
| Margins | 2cm (tất cả các cạnh) |
| Header | Tên công ty, tên phần mềm, phiên bản |
| Footer | Số trang (Page X of Y), đường dẫn file, ngày in |

---

## 4. QUY TRÌNH IN MÃ NGUỒN

### Bước 1: Tạo danh sách file

```bash
# Tạo danh sách tất cả các file mã nguồn
# Loại trừ node_modules, .git, dist, build
find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" \
  -o -name "*.tsx" -o -name "*.py" -o -name "*.sql" \) \
  ! -path "./node_modules/*" ! -path "./.git/*" > source_files.txt
```

### Bước 2: Loại bỏ thông tin nhạy cảm

```bash
# Copy mã nguồn vào thư mục tạm để làm sạch
mkdir -p temp_source_code
cp -r src/ backend/ temp_source_code/
rm -f temp_source_code/.env
# Thay thế secrets
sed -i 's/YOUR_API_KEY/[REDACTED]/g' temp_source_code/**/*.js
```

### Bước 3: In mã nguồn (3 cách)

**Cách 1: VS Code + Extension "PrintCode"**
1. Cài extension "PrintCode" hoặc "Code Printer"
2. Mở thư mục mã nguồn → chọn tất cả file (Ctrl+A)
3. Right-click → "Print Code" → Chọn định dạng PDF
4. Cài đặt header/footer, font, line spacing → In

**Cách 2: Script Python**

```python
#!/usr/bin/env python3
# print_source_code.py
import os
from datetime import datetime

def print_source_code(source_dir, output_file):
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"SOURCE CODE PRINTOUT\n")
        f.write(f"Company: [TÊN DOANH NGHIỆP]\n")
        f.write(f"Software: [TÊN PHẦN MỀM]\n")
        f.write(f"Date: {datetime.now().strftime('%Y-%m-%d')}\n")
        f.write("=" * 80 + "\n\n")

        for root, dirs, files in os.walk(source_dir):
            # Loại bỏ thư mục không cần in
            dirs[:] = [d for d in dirs if d not in
                       ['node_modules', '.git', 'dist', 'build']]
            for file in files:
                if not file.endswith(('.js','.jsx','.ts','.tsx','.py','.sql')):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, source_dir)
                f.write(f"\n\n{'='*80}\n")
                f.write(f"--- FILE: {rel_path} ---\n")
                with open(file_path, 'r', encoding='utf-8') as cf:
                    content = cf.read()
                    f.write(content)
    print(f"Source code printed to: {output_file}")

if __name__ == "__main__":
    print_source_code("./temp_source_code", "./source_code_printout.txt")
```

**Cách 3: Công cụ online**
- https://www.sourcecodeonline.com/
- Upload zip file → Chọn PDF → Tải về

### Bước 4: Chọn trang đầu và trang cuối

Theo Thông tư 08/2026/TT-BVHTTDL, cần đánh dấu trang đầu và trang cuối của mỗi file:

```
============================================================
--- FIRST PAGE OF FILE: src/controllers/auth.js ---

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
...

--- LAST PAGE OF FILE: src/controllers/auth.js ---

module.exports = { login, register, logout };
============================================================
```

---

## 5. MÃ HÓA VÀ LÀM RỐI THUẬT TOÁN LÕI

### 5.1. Khi nào cần mã hóa/làm rối
Theo Thông tư 08/2026/TT-BVHTTDL, bạn có thể mã hóa hoặc làm rối các thuật toán lõi để bảo vệ bí mật kinh doanh, **nhưng vẫn đăng ký bản quyền được**.

### 5.2. Thuật toán lõi là gì?
- Thuật toán tính giá, chiết khấu, thuế
- Thuật toán đề xuất sản phẩm
- Thuật toán phát hiện gian lận
- Công thức tính lương, thưởng độc quyền

### 5.3. Mã hóa thuật toán lõi (Encryption - AES-256-GCM)

**Quy trình:**
1. Xác định thuật toán lõi cần mã hóa
2. Mã hóa bằng AES-256-GCM với khóa bí mật
3. Lưu khóa ở nơi an toàn
4. In phần mã đã mã hóa vào bản in
5. Ghi chú: "Đã mã hóa theo Thông tư 08/2026/TT-BVHTTDL"

**Ví dụ (trước khi mã hóa - bản gốc):**
```javascript
function calculateDiscount(price, customerLevel) {
  if (customerLevel === 'VIP') return price * 0.8;
  if (customerLevel === 'GOLD') return price * 0.9;
  return price;
}
```

**Ví dụ (sau khi mã hóa - in vào hồ sơ):**
```
// ENCRYPTED_CORE_ALGORITHM
// Algorithm: calculateDiscount (AES-256-GCM encrypted)
// Key: [LƯU TRỮ AN TOÀN]
// Encrypted: a2V5PWFhYTI1NmdjbQ==...
```

### 5.4. Làm rối mã nguồn (Obfuscation)

**Công cụ gợi ý:**
- JavaScript: https://obfuscator.io/
- Java: ProGuard
- .NET: ConfuserEx
- Python: PyArmor

**Ví dụ:**
```javascript
// TRƯỚC KHI LÀM RỐI (dễ đọc)
function calculateTax(amount, rate) {
  return amount * rate;
}

// SAU KHI LÀM RỐI (khó đọc)
var _0xabc=['\x63\x61\x6c\x63\x75\x6c\x61\x74\x65\x54\x61\x78'];
// ... (code đã obfuscate, vẫn chạy được)
```

**Lưu ý:** Làm rối mã nguồn không làm mất giá trị pháp lý của bản quyền.

---

## 6. NỘP HỒ SƠ ĐĂNG KÝ BẢN QUYỀN

### 6.1. Hồ sơ cần chuẩn bị
1. **Tờ khai đăng ký quyền tác giả** (theo mẫu của Cục Bản quyền tác giả)
2. **Bản in mã nguồn** (source code printout) — 2 bản
3. **Bản mô tả phần mềm:** tên, phiên bản, chức năng, công nghệ
4. **Bản sao CMND/CCCD** của tác giả
5. **Bản sao CMND/CCCD** của chủ sở hữu (nếu khác tác giả)
6. **IP Assignment Agreement** (nếu tác giả là nhân viên)
7. **Giấy phép đăng ký kinh doanh** (bản sao)

### 6.2. Nơi nộp hồ sơ
- **Trực tiếp:** Cục Bản quyền tác giả - Bộ Văn hóa, Thể thao và Du lịch
  - Địa chỉ: Số 1, Đào Duy Anh, Hà Nội
  - Điện thoại: 024.38260011
- **Trực tuyến:** Cổng dịch vụ công của Bộ VH-TT-DL

### 6.3. Thời gian xử lý
- **Thời gian:** 15-30 ngày làm việc kể từ ngày nhận hồ sơ hợp lệ.
- **Phí đăng ký:** [PHÍ ĐĂNG KÝ] VNĐ (theo quy định hiện hành).

### 6.4. Sau khi được cấp Giấy chứng nhận
- Lưu trữ giấy chứng nhận tại nơi an toàn (safe deposit box hoặc cloud storage có mã hóa).
- Gia hạn theo quy định (nếu cần).
- Sử dụng để bảo vệ quyền sở hữu khi có tranh chấp.

---

## 7. BẢO QUẢN VÀ LƯU TRỮ

### 7.1. Lưu trữ bản in mã nguồn
- Lưu file PDF gốc trên cloud storage có mã hóa (Google Drive, Dropbox, OneDrive với mã hóa AES-256).
- In thêm 1 bản giấy và lưu tại két sắt công ty.
- Ghi nhật ký lưu trữ: ngày in, người in, người kiểm tra.

### 7.2. Lưu trữ khóa mã hóa
- Khóa mã hóa thuật toán lõi phải được lưu trữ riêng biệt với mã nguồn.
- Sử dụng password manager (Bitwarden, 1Password) hoặc safe deposit box.
- Chỉ người có thẩm quyền (CTO, CEO) mới được truy cập khóa.

### 7.3. Lưu trữ bản mô tả phần mềm
- Lưu cùng với bản in mã nguồn.
- Cập nhật phiên bản mỗi khi có thay đổi lớn.
- Ghi rõ ngày cập nhật và lý do cập nhật.

---

## 8. FAQ - CÂU HỎI THƯỜNG GẶP

**Q: Có cần in toàn bộ mã nguồn không?**
A: Có. Theo Thông tư 08/2026/TT-BVHTTDL, cần in toàn bộ mã nguồn. Tuy nhiên, có thể loại bỏ thư viện bên thứ ba (node_modules, vendor) và mã nguồn open-source.

**Q: Có thể đăng ký bản quyền cho website/mobile app không?**
A: Có. Phần mềm (software/program) được bảo hộ bất kể hình thức (website, mobile app, desktop app, API).

**Q: Bản in mã nguồn có cần đóng dấu không?**
A: Không bắt buộc. Nhưng nên đóng dấu công ty và ký tên người đại diện để tăng giá trị pháp lý.

**Q: Thời gian bảo hộ là bao lâu?**
A: Suốt đời tác giả + 50 năm. Đối với chương trình máy tính, thời hạn bảo hộ là 50 năm kể từ lần đầu tiên công bố.

**Q: Có thể sửa đổi mã nguồn sau khi đăng ký không?**
A: Có. Bạn có thể đăng ký bổ sung cho các phiên bản mới của phần mềm.

**Q: Đăng ký ở Việt Nam có bảo hộ quốc tế không?**
A: Việt Nam là thành viên Hiệp định Berne. Bản quyền đăng ký tại Việt Nam được công nhận ở 179 quốc gia thành viên.

---

## 9. CHECKLIST CHUẨN BỊ

### Trước khi in:
- [ ] Đã kiểm kê toàn bộ file mã nguồn (danh sách file)
- [ ] Đã loại bỏ thông tin nhạy cảm (API keys, passwords, IP)
- [ ] Đã loại bỏ code bên thứ ba (node_modules, vendor)
- [ ] Đã mã hóa/làm rối thuật toán lõi (nếu cần)
- [ ] Đã chuẩn bị môi trường in ấn (font, header, footer)

### Trong khi in:
- [ ] Đã đánh dấu trang đầu và trang cuối của mỗi file
- [ ] Đã in đủ 2 bản (1 cho Cục, 1 lưu trữ)
- [ ] Đã kiểm tra chất lượng in (có bị mất dòng, mất trang không)

### Sau khi in:
- [ ] Đã lưu file PDF vào cloud storage có mã hóa
- [ ] Đã lưu bản giấy vào két sắt công ty
- [ ] Đã ghi nhật ký lưu trữ (ngày in, người in)
- [ ] Đã chuẩn bị hồ sơ đăng ký đầy đủ
- [ ] Đã nộp hồ sơ tại Cục Bản quyền tác giả

---

## 10. CÁC VĂN BẢN PHÁP LUẬT LIÊN QUAN

1. **Luật Sở hữu trí tuệ số 50/2005/QH11** — bảo hộ chương trình máy tính
2. **Nghị định 17/2023/NĐ-CP** — hướng dẫn thi hành Luật SHTT về quyền tác giả
3. **Thông tư 08/2026/TT-BVHTTDL** — biểu mẫu, tờ khai đăng ký bản quyền phần mềm
4. **Bộ luật Dân sự 91/2015/QH13** — bồi thường thiệt hại, hợp đồng
5. **Bộ luật Hình sự 100/2015/QH13** — tội vi phạm quyền tác giả (Điều 289)
6. **Hiệp định Berne** — bảo hộ bản quyền quốc tế

---

*Tài liệu này được xây dựng theo Thông tư 08/2026/TT-BVHTTDL. Phiên bản mới nhất được cập nhật tại [WEBSITE]/legal/source-code-printing.*

**Tài liệu đính kèm:**
- Mẫu tờ khai đăng ký quyền tác giả (Phụ lục 1 - Thông tư 08/2026)
- Mẫu hợp đồng chuyển giao quyền SHTT: INTERNAL_IP_ASSIGNMENT.md
- Hướng dẫn in mã nguồn script Python: Section 4 - Step 3