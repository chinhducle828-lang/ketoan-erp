# 📊 KETOAN ERP SYSTEM

Hệ thống kế toán đa doanh nghiệp theo Thông Tư 200/2014/TT-BTC của Bộ Tài Chính Việt Nam.

---

## **🚀 QUICK START - Local Development**

### **Yêu Cầu**
- Node.js v18+
- PostgreSQL 12+
- Git

### **Setup Backend**

```bash
cd backend

# 1. Cài dependencies
npm install

# 2. Tạo file .env (copy từ .env.example)
cp .env.example .env

# 3. Cấu hình .env:
#    DATABASE_URL=postgresql://user:password@localhost:5432/ketoan
#    JWT_SECRET=your_secret_key
#    PORT=5000

# 4. Khởi tạo database schema
# (Import file schema.sql vào PostgreSQL qua pgAdmin hoặc psql)

# 5. Khởi động server
npm run dev
# Server chạy tại http://localhost:5000
```

### **Setup Frontend**

```bash
cd front-end

# 1. Cài dependencies
npm install

# 2. Tạo file .env (copy từ .env.example)
cp .env.example .env

# 3. Khởi động dev server
npm run dev
# Frontend chạy tại http://localhost:3000
```

### **Build Production**

```bash
cd front-end

# Build optimized version
npm run build

# Output: dist/
```

---

## **📁 Project Structure**

```
ketoan-erp/
├── backend/
│   ├── server.js           # Express server
│   ├── schema.sql          # Database schema
│   ├── package.json
│   ├── .env.example
│   └── node_modules/
│
├── front-end/
│   ├── src/
│   │   ├── main.jsx        # Entry point
│   │   ├── App.jsx
│   │   ├── components/     # React components
│   │   ├── views/          # Pages/Routes
│   │   ├── context/        # Auth, Voucher contexts
│   │   └── utils/          # API client, helpers
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   ├── .env.example
│   ├── .env.production
│   └── node_modules/
│
├── DEPLOY_GUIDE.md         # Hướng dẫn deploy online
├── README.md               # File này
└── .gitignore
```

---

## **🔐 Default Admin Account**

Sau khi khởi tạo database, bạn cần tạo tài khoản Admin:

1. Vào `/api/auth/register-admin` (chỉ lần đầu):
```bash
curl -X POST http://localhost:5000/api/auth/register-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}'
```

2. Hoặc INSERT trực tiếp vào database:
```sql
INSERT INTO users (username, password, role) 
VALUES ('admin', crypt('password', gen_salt('bf')), 'admin');
```

---

## **📚 API Endpoints**

### **Authentication**
- `POST /api/auth/register-admin` - Tạo tài khoản Admin (lần đầu)
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/assign-company` - Gán công ty cho user

### **Users Management**
- `GET /api/users` - Lấy danh sách users
- `POST /api/users` - Tạo user mới
- `DELETE /api/users/:id` - Xóa user

### **Companies Management**
- `GET /api/companies` - Lấy danh sách công ty
- `POST /api/companies` - Tạo công ty mới
- `DELETE /api/companies/:id` - Xóa công ty

### **Vouchers (Chứng từ)**
- `GET /api/vouchers` - Lấy danh sách chứng từ
- `POST /api/vouchers` - Tạo chứng từ mới
- `DELETE /api/vouchers/:id` - Xóa chứng từ

### **Opening Balances**
- `GET /api/opening-balances` - Lấy số dư đầu kỳ
- `POST /api/opening-balances` - Nhập số dư đầu kỳ

---

## **🛠️ Tech Stack**

### **Backend**
- Express.js - HTTP server
- PostgreSQL - Database
- JWT - Authentication
- bcryptjs - Password hashing
- CORS - Cross-origin requests

### **Frontend**
- React 18 - UI framework
- Vite - Build tool
- Tailwind CSS - Styling
- Axios - HTTP client
- Lucide React - Icons

---

## **🔗 DEPLOY ONLINE**

Chi tiết hướng dẫn deploy trên Railway.app, xem file: **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)**

TL;DR:
1. Push code lên Github
2. Connect Github vào Railway.app
3. Setup PostgreSQL trên Railway
4. Deploy Backend
5. Deploy Frontend
6. Khởi tạo database
7. Done! ✅

---

## **🐛 Troubleshooting**

### **Backend error: Cannot find module 'dotenv'**
```bash
cd backend && npm install dotenv
```

### **Frontend error: VITE_API_URL undefined**
```bash
# Tạo file .env
echo "VITE_API_URL=http://localhost:5000" > front-end/.env
```

### **PostgreSQL connection refused**
```bash
# Kiểm tra PostgreSQL đang chạy
# macOS: brew services list
# Windows: Kiểm tra Services -> PostgreSQL
# Linux: sudo systemctl status postgresql
```

### **Port 5000 already in use**
```bash
# Kill process trên port 5000
# Windows: netstat -ano | findstr :5000
# Linux: lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill
```

---

## **📞 Support**

Gặp vấn đề? 
- Kiểm tra browser DevTools (F12) - Console tab
- Kiểm tra backend logs
- Review file `.env` - các biến environment đã set đúng?

---

## **📝 License**

MIT - Feel free to use and modify!

---

**Made with ❤️ for Vietnamese Accounting**
