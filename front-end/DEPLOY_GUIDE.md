# HƯỚNG DẪN DEPLOY HỆ THỐNG LÊN RAILWAY.APP

## **BƯỚC 1: Chuẩn bị Github Repository**

1. Tạo tài khoản trên [github.com](https://github.com)
2. Tạo repository mới: `ketoan-erp`
3. Clone repository về máy:
   ```bash
   git clone https://github.com/USERNAME/ketoan-erp.git
   cd ketoan-erp
   ```

4. Copy toàn bộ code vào folder này:
   - Copy folder `backend/` vào root
   - Copy folder `front-end/` vào root
   
5. Tạo file `.gitignore`:
   ```
   node_modules/
   .env
   .env.local
   .DS_Store
   *.log
   dist/
   ```

6. Commit và push:
   ```bash
   git add .
   git commit -m "Initial commit: KETOAN ERP system"
   git push -u origin main
   ```

---

## **BƯỚC 2: Setup PostgreSQL Database trên Railway**

1. Truy cập [railway.app](https://railway.app)
2. Đăng ký hoặc đăng nhập
3. Click **"Create New"** → **"Database"** → **"PostgreSQL"**
4. Railway sẽ tự động tạo PostgreSQL instance
5. Vào tab **"Connect"** → Copy **Database URL** (dạng: `postgresql://user:password@host:port/database`)
6. **Lưu Database URL này - cần dùng để setup Backend**

---

## **BƯỚC 3: Setup Backend trên Railway**

### **Option A: Deploy từ Github**

1. Vào [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Chọn repository `ketoan-erp` của bạn
4. Cấu hình:
   - **Root Directory**: `backend`
   - **Framework**: Node.js
5. Vào tab **Variables** (Biến môi trường):
   - Thêm `DATABASE_URL` = (Database URL từ Bước 2)
   - Thêm `JWT_SECRET` = (một chuỗi bí mật dài, ví dụ: `your_super_secret_key_12345_change_this`)
   - Thêm `PORT` = `5000`
6. Click **"Deploy"**
7. Đợi khoảng 2-3 phút để build xong
8. Vào tab **"Deployments"** → Copy **Public URL** (dạng: `https://ketoan-backend-production-xxxx.railway.app`)
9. **Lưu URL Backend này - cần dùng cho Frontend**

### **Option B: Deploy thủ công (Advanced)**

Bỏ qua nếu chọn Option A.

---

## **BƯỚC 4: Setup Frontend trên Railway**

1. Click **"New Service"** trên cùng project Railway
2. Chọn **"Deploy from GitHub repo"** → Chọn `ketoan-erp`
3. Cấu hình:
   - **Root Directory**: `front-end`
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Start Command**: (để trống hoặc `npm run preview`)
4. Vào tab **Variables**:
   - Thêm `VITE_API_URL` = (URL Backend từ Bước 3, ví dụ: `https://ketoan-backend-production-xxxx.railway.app`)
5. Click **"Deploy"**
6. Đợi build xong (khoảng 5-10 phút lần đầu)
7. Vào tab **"Deployments"** → Copy **Public URL** (dạng: `https://ketoan-erp-production-xxxx.railway.app`)
8. **Đây là URL hệ thống của bạn**

---

## **BƯỚC 5: Khởi tạo Database Schema**

### **Cách 1: Dùng pgAdmin (Dễ nhất)**

1. Vào [pgAdmin](https://www.pgadmin.org/download/) hoặc dùng **DBeaver** (miễn phí)
2. Kết nối với database URL từ Railway
3. Tạo database mới (nếu chưa có)
4. Copy nội dung từ file `backend/schema.sql`
5. Chạy SQL script để tạo bảng

### **Cách 2: Dùng Railway CLI**

```bash
# Cài đặt Railway CLI
npm install -g @railway/cli

# Login
railway login

# Kết nối project
railway link

# Chạy SQL file trên database
railway run psql < backend/schema.sql
```

### **Cách 3: Thêm init script vào backend**

Tạo file `backend/init-db.js`:
```javascript
import pool from './db.js';
import fs from 'fs';

async function initDB() {
  const schema = fs.readFileSync('./schema.sql', 'utf-8');
  try {
    await pool.query(schema);
    console.log('✅ Database initialized!');
  } catch (err) {
    console.error('❌ Database init error:', err);
  }
}

initDB();
```

---

## **BƯỚC 6: Test Hệ Thống Online**

1. Truy cập URL Frontend: `https://ketoan-erp-production-xxxx.railway.app`
2. Đăng ký tài khoản Admin:
   - Username: `admin`
   - Password: (tự đặt)
3. Thử các chức năng chính
4. Kiểm tra Backend logs trong Railway console

---

## **BƯỚC 7: Mua Domain (Optional)**

Nếu muốn có domain riêng thay vì URL Railway dài:

1. Mua domain trên [Namecheap](https://namecheap.com), [Godaddy](https://godaddy.com), hoặc nhà cung cấp Việt Nam
2. Trên Railway:
   - Vào **Settings** của project
   - Tab **"Custom Domain"**
   - Thêm domain của bạn (ví dụ: `ketoan.yourdomain.com`)
   - Railway sẽ cung cấp **DNS records**
3. Vào DNS settings của domain provider
4. Thêm DNS records Railway cung cấp
5. Đợi 10-30 phút để DNS cập nhật

---

## **BƯỚC 8: Setup HTTPS & SSL**

Railway tự động setup **HTTPS + SSL certificate** miễn phí (Let's Encrypt).

Bạn không cần làm gì thêm - mọi thứ đã bảo mật!

---

## **TROUBLESHOOTING**

### **Backend không khởi động**
- Kiểm tra logs trong Railway: Click service → View Logs
- Đảm bảo `DATABASE_URL` được set đúng
- Kiểm tra `JWT_SECRET` có được set không

### **Frontend không kết nối được Backend**
- Kiểm tra `VITE_API_URL` có đúng không
- Kiểm tra Backend đã deploy thành công chưa
- Mở **Browser DevTools** → **Network** → kiểm tra requests

### **Database connection error**
- Kiểm tra PostgreSQL instance đang chạy trên Railway
- Test kết nối: Dùng pgAdmin kết nối với Database URL

### **Build fail**
- Kiểm tra logs: Click service → View Logs
- Đảm bảo `package.json` có script `start` cho Node.js
- Đảm bảo `package.json` có script `build` cho Vite

---

## **LINKS HỮUDUỤNG**

- Railway.app: https://railway.app
- Github: https://github.com
- Namecheap (Domain): https://namecheap.com
- pgAdmin: https://www.pgadmin.org
- DBeaver (Database client): https://dbeaver.io

---

## **NGÂN SÁCH ƯỚC TÍNH**

- **Railway.app**: $5-15/tháng (tùy traffic)
- **Domain**: $1-10/năm
- **Total**: ~$5-25/tháng là OK cho 1 doanh nghiệp nhỏ

---

## **NEXT STEPS**

1. ✅ Push code lên Github
2. ✅ Setup PostgreSQL trên Railway
3. ✅ Deploy Backend
4. ✅ Deploy Frontend
5. ✅ Init Database
6. ✅ Test toàn hệ thống
7. ✅ (Optional) Mua domain riêng
8. ✅ Setup email notifications (nếu cần)

Bạn cần giúp với bước nào? Hãy cho tôi biết! 🚀
