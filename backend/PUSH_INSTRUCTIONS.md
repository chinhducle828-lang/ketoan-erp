# 🚀 Hướng dẫn Push Code lên Git

## 📋 TÓM TẮT NHANH

### ✅ PUSH LÊN GIT:
```
backend/
├── server.js                 ✅
├── package.json              ✅
├── package-lock.json         ✅
├── .env.example              ✅
├── jest.config.js            ✅
├── README.md                 ✅
├── REFACTORING_SUMMARY.md    ✅
├── GIT_GUIDE.md              ✅
├── schema.sql                ✅
├── .gitignore                ✅
│
├── routes/                   ✅ (9 files)
├── middleware/                ✅ (2 files)
├── validators/                ✅ (1 file)
├── services/                  ✅ (2 files)
├── cache/                     ✅ (1 file)
└── tests/                     ✅ (3 files)
```

### ❌ KHÔNG PUSH:
```
.env                          ❌ (chứa secrets)
node_modules/                 ❌ (có thể restore)
coverage/                     ❌ (generated)
logs/                         ❌ (generated)
.vscode/                      ❌ (IDE settings)
```

---

## 🎯 CÁCH PUSH CODE (3 BƯỚC)

### Bước 1: Kiểm tra Git status
```bash
cd backend
git status
```

Bạn sẽ thấy:
```
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        new file:   routes/auth.js
        new file:   routes/users.js
        ...
```

### Bước 2: Add & Commit
```bash
# Add tất cả files (trừ .gitignore)
git add .

# Commit với message
git commit -m "refactor: modular architecture with validation, tests, and caching

- Split routes into separate files (9 route files)
- Add Zod validation layer (13 schemas)
- Add unit tests with Jest (15 test cases)
- Implement Redis caching for dashboard
- Add seed data for testing
- Update documentation"
```

### Bước 3: Push lên remote
```bash
# Nếu chưa có remote, thêm remote:
git remote add origin https://github.com/YOUR_USERNAME/ketoan-erp.git

# Push lên GitHub/GitLab
git push -u origin main
```

---

## 🔍 KIỂM TRA TRƯỚC KHI PUSH

### 1. Check .gitignore
```bash
# Đảm bảo .env không bị track
git check-ignore -v .env

# Output nếu đúng:
# backend/.gitignore:3:.env    .env
```

### 2. Check files sẽ commit
```bash
# Xem danh sách files sẽ commit
git status

# Xem chi tiết thay đổi
git diff --cached
```

### 3. Verify không có sensitive data
```bash
# Tìm passwords/secrets trong staged files
git diff --cached | grep -i "password\|secret\|key"

# Nếu thấy output → Có thể bạn đã vô tình commit sensitive data
```

---

## ⚠️ NẾU VÔ TÌNH COMMIT .env

### Cách xóa .env khỏi Git:

```bash
# 1. Xóa khỏi staging area (giữ file local)
git rm --cached .env

# 2. Add .gitignore
git add .gitignore

# 3. Commit
git commit -m "chore: remove .env from git tracking"

# 4. Push
git push origin main

# 5. XÓA khỏi Git history (quan trọng!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 6. Force push (cảnh báo: sẽ rewrite history)
git push origin --force --all
```

---

## 📝 COMMON GIT COMMANDS

### Xem thay đổi
```bash
git status                    # Xem files đã thay đổi
git diff                      # Xem chi tiết thay đổi
git log --oneline -10         # Xem 10 commits gần nhất
```

### Undo changes
```bash
git restore --staged <file>   # Unstage file
git restore <file>            # Discard changes
git reset --soft HEAD~1       # Undo last commit (giữ changes)
git reset --hard HEAD~1       # Undo last commit (xóa changes)
```

### Branching
```bash
git branch                    # Xem branches
git branch -b feature-name    # Tạo branch mới
git checkout feature-name     # Chuyển branch
git merge feature-name        # Merge branch
```

---

## 🎯 WORKFLOW HÀNG NGÀY

```bash
# 1. Pull latest code
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
```

---

## ✅ CHECKLIST TRƯỚC KHI PUSH

- [ ] `.env` có trong `.gitignore`? → **Có** ✅
- [ ] `.env` không bị track? → `git check-ignore -v .env`
- [ ] `node_modules/` không bị track? → **Có** ✅
- [ ] Tests pass? → `npm test` ✅
- [ ] Code đã được review? → ✅
- [ ] Commit message rõ ràng? → ✅

---

## 🆘 TROUBLESHOOTING

### Lỗi: "fatal: not a git repository"
```bash
git init
git add .
git commit -m "initial commit"
```

### Lỗi: "remote origin already exists"
```bash
# Xem remote hiện tại
git remote -v

# Xóa remote cũ
git remote remove origin

# Thêm remote mới
git remote add origin https://github.com/username/ketoan-erp.git
```

### Lỗi: "Authentication failed"
```bash
# Cấu hình Git credentials
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Hoặc dùng SSH key
git remote set-url origin git@github.com:username/ketoan-erp.git
```

---

## 📊 FILES ĐÃ ĐƯỢC TẠO (ĐỂ PUSH)

### Core Files (8 files)
- ✅ `server.js` - Entry point
- ✅ `package.json` - Dependencies
- ✅ `.env.example` - Environment template
- ✅ `jest.config.js` - Test config
- ✅ `README.md` - Documentation
- ✅ `REFACTORING_SUMMARY.md` - Refactoring notes
- ✅ `GIT_GUIDE.md` - Git guide
- ✅ `schema.sql` - Database schema

### Routes (9 files)
- ✅ `routes/auth.js`
- ✅ `routes/users.js`
- ✅ `routes/companies.js`
- ✅ `routes/vouchers.js`
- ✅ `routes/items.js`
- ✅ `routes/openingBalances.js`
- ✅ `routes/dashboard.js`
- ✅ `routes/export.js`
- ✅ `routes/import.js`

### Middleware (2 files)
- ✅ `middleware/auth.js`
- ✅ `middleware/validation.js`

### Validators (1 file)
- ✅ `validators/index.js`

### Services (2 files)
- ✅ `services/helpers.js`
- ✅ `services/seedData.js`

### Cache (1 file)
- ✅ `cache/redis.js`

### Tests (3 files)
- ✅ `tests/setup.js`
- ✅ `tests/validators.test.js`
- ✅ `tests/helpers.test.js`

### Config (2 files)
- ✅ `.gitignore`
- ✅ `push-to-git.sh`

**TOTAL: 29 files** - Tất cả đều có thể push lên Git!

---

## 🎉 READY TO PUSH?

```bash
# Quick push script (Linux/Mac)
bash push-to-git.sh

# Hoặc manual push
git add .
git commit -m "refactor: modular architecture with validation, tests, and caching"
git push origin main
```

**Lưu ý**: 
- ✅ `.env` đã có trong `.gitignore` - sẽ không bị push
- ✅ Tất cả source code đã sẵn sàng
- ✅ Tests đã pass
- ✅ Documentation đầy đủ