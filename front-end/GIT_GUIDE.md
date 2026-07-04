# Git Guide - Những gì nên push lên Git

## ✅ NÊN PUSH (Commit & Push)

### Source Code
```
backend/
├── server.js                 ✅ Entry point
├── package.json              ✅ Dependencies
├── package-lock.json         ✅ Lock file
├── .env.example              ✅ Template cho env vars
├── jest.config.js            ✅ Test config
├── README.md                 ✅ Documentation
├── REFACTORING_SUMMARY.md    ✅ Refactoring notes
├── schema.sql                ✅ Database schema
│
├── routes/                   ✅ TẤT CẢ route files
├── middleware/                ✅ TẤT CẢ middleware
├── validators/                ✅ TẤT CẢ validators
├── services/                  ✅ TẤT CẢ services (trừ seedData nếu muốn)
├── cache/                     ✅ TẤT CẢ cache logic
└── tests/                     ✅ TẤT CẢ unit tests
```

### Giải thích:
- **Source code**: Tất cả files `.js` bạn đã viết
- **Config files**: `package.json`, `jest.config.js`, `.env.example`
- **Documentation**: `README.md`, `REFACTORING_SUMMARY.md`
- **Tests**: Toàn bộ thư mục `tests/`

## ❌ KHÔNG NÊN PUSH (Đã có trong .gitignore)

### Sensitive Data
```
.env                 ❌ Chứa database credentials, JWT secrets
.env.local           ❌ Local overrides
.env.*.local         ❌ Local environment files
```

### Dependencies
```
node_modules/        ❌ Dependencies (có thể restore bằng npm install)
package-lock.json    ✅ NÊN push (để đảm bảo version consistency)
```

### Build & Cache
```
coverage/            ❌ Test coverage reports
dist/                ❌ Build outputs
build/               ❌ Build outputs
.cache/              ❌ Cache files
```

### Logs
```
logs/                ❌ Log files
*.log                ❌ Log files
npm-debug.log*       ❌ Debug logs
```

### IDE & OS
```
.vscode/             ❌ IDE settings
.idea/               ❌ IDE settings
.DS_Store            ❌ macOS files
Thumbs.db            ❌ Windows files
```

## 🔒 Bảo mật - Tuyệt đối KHÔNG push:

### ❌ .env (File chứa sensitive data)
```env
# .env - KHÔNG BAO GIỜ push file này
DATABASE_URL=postgresql://user:password@host:5432/db  ❌
JWT_SECRET=your-secret-key-here  ❌
REDIS_URL=redis://localhost:6379  ❌
```

### ✅ .env.example (Template - Có thể push)
```env
# .env.example - CÓ THỂ push (không có real values)
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/ketoan_db
JWT_SECRET=your-secret-key-here
REDIS_URL=redis://localhost:6379
SEED_DATABASE=false
FRONTEND_URL=http://localhost:3000
```

## 📝 Git Workflow:

### 1. Kiểm tra những gì sẽ commit
```bash
git status
git diff
```

### 2. Add files
```bash
# Add TẤT CẢ files được track (trừ những cái trong .gitignore)
git add .

# Hoặc add từng file
git add backend/server.js
git add backend/routes/
git add backend/validators/
```

### 3. Commit
```bash
git commit -m "refactor: split routes into separate files, add validation and tests"
```

### 4. Push
```bash
git push origin main
```

## 🚀 Checklist trước khi push:

- [ ] `.env` có trong `.gitignore`? → **Có** ✅
- [ ] `node_modules/` có trong `.gitignore`? → **Có** ✅
- [ ] `coverage/` có trong `.gitignore`? → **Có** ✅
- [ ] `.env.example` đã được push? → **Push để người khác biết config**
- [ ] `package.json` đã được push? → **Có** ✅
- [ ] Tất cả source code đã được push? → **Có** ✅
- [ ] Tests pass? → Chạy `npm test` ✅

## ⚠️ Lưu ý quan trọng:

### 1. **TUYỆT ĐỐI KHÔNG push:**
- ❌ `.env` - Chứa database credentials, JWT secrets
- ❌ `node_modules/` - Có thể restore bằng `npm install`
- ❌ `coverage/` - Generated files

### 2. **CÓ THỂ push:**
- ✅ `.env.example` - Template (không có real values)
- ✅ `package-lock.json` - Đảm bảo version consistency
- ✅ `tests/` - Unit tests
- ✅ `seedData.js` - Có thể push (không chứa sensitive data)

### 3. **Nếu vô tình push .env:**
```bash
# 1. Xóa khỏi git tracking (giữ file local)
git rm --cached .env

# 2. Add vào .gitignore
echo ".env" >> .gitignore

# 3. Commit
git add .gitignore
git commit -m "chore: remove .env from tracking"

# 4. Push
git push

# 5. XÓA file khỏi git history (quan trọng!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 6. Force push (cảnh báo: sẽ rewrite history)
git push origin --force --all
```

## 📊 Tóm tắt:

| Category | Push? | Reason |
|----------|-------|--------|
| Source code (.js files) | ✅ YES | Core application |
| Config files | ✅ YES | Needed for setup |
| Tests | ✅ YES | Quality assurance |
| Documentation | ✅ YES | Helpful for team |
| `.env.example` | ✅ YES | Template (no secrets) |
| `.env` | ❌ NO | Contains secrets |
| `node_modules/` | ❌ NO | Can be restored |
| `coverage/` | ❌ NO | Generated files |
| `logs/` | ❌ NO | Generated files |

## 🎯 Command để push lần đầu:

```bash
# 1. Initialize git (nếu chưa có)
git init

# 2. Add all files (respecting .gitignore)
git add .

# 3. Check what will be committed
git status

# 4. Commit
git commit -m "feat: refactor backend with modular architecture, validation, tests, and caching"

# 5. Add remote
git remote add origin https://github.com/username/ketoan-erp.git

# 6. Push
git push -u origin main
```

## 🔄 Workflow hàng ngày:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Make changes
# ... code code code ...

# 3. Run tests
npm test

# 4. Stage changes
git add .

# 5. Commit
git commit -m "feat: add new feature"

# 6. Push
git push origin main