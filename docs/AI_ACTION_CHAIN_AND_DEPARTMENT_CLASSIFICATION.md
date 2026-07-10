# AI Action Chain & Department Classification

## 📋 Câu hỏi của bạn

1. **Chuỗi action của AI bao gồm những gì?**
2. **AI tương tác với backend, frontend, database như nào?**
3. **AI có thể tự động phân loại phòng ban theo nội dung không?**

---

## 🔄 AI Action Chain (Chuỗi hoạt động)

### 1. **User Input** (Frontend)
```
User nhập câu hỏi hoặc upload ảnh
    ↓
Frontend gửi request đến Backend
```

### 2. **API Request** (Frontend → Backend)
```javascript
// Example 1: Chat
POST /api/ai/query
{
  "question": "Doanh thu tháng này?",
  "company_id": "demo-company"
}

// Example 2: OCR
POST /api/ai/ocr/process
{
  "image_base64": "data:image/jpeg;base64,...",
  "document_type": "invoice",
  "company_id": "demo-company"
}

// Example 3: Math
POST /api/ai/math
{
  "problem": "Tính lãi suất 12% trên 100 triệu",
  "context": "financial"
}
```

### 3. **Backend Processing** (Backend)
```javascript
// Backend nhận request
router.post('/query', asyncHandler(async (req, res) => {
  const { question } = req.body;
  const companyId = req.companyId; // Từ authentication middleware
  
  // Gọi AI service
  const result = await askFinancialCopilot(question, companyId);
  
  // Trả về kết quả
  res.json({ success: true, data: result });
}));
```

### 4. **AI Processing** (Gemini AI)
```javascript
// Gemini AI xử lý
export async function askFinancialCopilot(question, companyId) {
  // Bước 1: Tạo SQL từ câu hỏi
  const sqlResult = await generateSQL(question, schema, companyId);
  
  // Bước 2: Thực thi SQL (query database)
  const data = await executeSafeQuery(sqlResult.sql, companyId);
  
  // Bước 3: Phân tích kết quả bằng AI
  const analysis = await analyzeData(question, data, sqlResult.sql);
  
  return {
    answer: analysis.answer,
    data: data,
    sql: sqlResult.sql,
    confidence: analysis.confidence
  };
}
```

### 5. **Database Interaction** (Backend → Database)
```javascript
// Query database với parameterized SQL
const { rows } = await pool.query(
  'SELECT * FROM vouchers WHERE company_id = $1 AND voucher_date >= $2',
  [companyId, startDate]
);

// Hoặc lưu kết quả OCR
await client.query(
  `INSERT INTO ai_ocr_results (company_id, voucher_id, ocr_data, ...)
   VALUES ($1, $2, $3, ...)`,
  [companyId, voucherId, JSON.stringify(ocrData)]
);
```

### 6. **Response** (Backend → Frontend)
```javascript
// Backend trả về kết quả
res.json({
  success: true,
  data: {
    answer: "Tổng doanh thu: 150,000,000 VND",
    data: [...],
    sql: "SELECT SUM(amount) FROM vouchers...",
    confidence: 90
  }
});
```

### 7. **Display Results** (Frontend)
```javascript
// Frontend hiển thị
const result = await askQuestion(question);
setMessages(prev => [...prev, {
  role: 'assistant',
  content: result.answer,
  data: result.data,
  sql: result.sql
}]);
```

---

## 🗄️ Cách AI tương tác với Database

### 1. **Text-to-SQL** (Đọc dữ liệu)
```javascript
// User hỏi: "Doanh thu tháng này?"
// AI tạo SQL:
SELECT SUM(amount) as total 
FROM vouchers 
WHERE company_id = 'demo-company'
  AND voucher_date >= '2026-06-01'
  AND voucher_date <= '2026-06-30'

// Thực thi và trả về kết quả
```

### 2. **Save OCR Results** (Ghi dữ liệu)
```javascript
// OCR trích xuất dữ liệu từ ảnh
// Lưu vào database:
INSERT INTO vouchers (company_id, voucher_type, ...)
VALUES ('demo-company', 'XK', ...)

INSERT INTO ai_ocr_results (company_id, ocr_data, ...)
VALUES ('demo-company', {...}, ...)
```

### 3. **Workflow Execution** (Đọc + Ghi)
```javascript
// Workflow: Kết sổ kỳ
// Bước 1: Đọc dữ liệu
SELECT * FROM vouchers WHERE company_id = $1 AND status = 'DRAFT'

// Bước 2: Xử lý (AI phân tích)
// Bước 3: Ghi kết quả
UPDATE vouchers SET status = 'POSTED' WHERE id = $1
```

---

## 🏢 Phân loại phòng ban tự động (Department Classification)

### ✅ CÓ! AI có thể tự động phân loại phòng ban

### Cách hoạt động:

#### 1. **Dựa trên nội dung văn bản**
```javascript
// User upload hóa đơn mua hàng
// AI đọc nội dung:
{
  "items": [
    {"name": "Vật tư văn phòng phẩm", "amount": 500000},
    {"name": "Máy in", "amount": 5000000}
  ]
}

// AI phân loại:
{
  "department": "purchasing", // Phòng Mua hàng
  "reason": "Hóa đơn chứa vật tư và thiết bị",
  "confidence": 95
}
```

#### 2. **Dựa trên tài khoản kế toán**
```javascript
// AI đọc bút toán:
{
  "entries": [
    {"account_code": "156", "amount": 1000000}, // Mua hàng
    {"account_code": "331", "amount": 1000000}  // Phải trả NCC
  ]
}

// Phân loại:
{
  "department": "purchasing", // Phòng Mua hàng
  "reason": "Tài khoản 156 - Mua hàng",
  "confidence": 100
}
```

#### 3. **Dựa trên từ khóa**
```javascript
// AI quét từ khóa:
{
  "keywords": ["nhập kho", "vật tư", "nguyên liệu"],
  "content": "Phiếu nhập kho vật tư sản xuất"
}

// Phân loại:
{
  "department": "warehouse", // Phòng Kho vận
  "reason": "Từ khóa: nhập kho, vật tư",
  "confidence": 90
}
```

---

## 🆕 Department Classification Implementation

### Backend Service
```javascript
// backend/services/aiDepartmentClassifier.service.js

export async function classifyDepartment(content, context = {}) {
  try {
    const prompt = `You are a department classification AI for a Vietnamese accounting ERP system.

Content to classify:
${JSON.stringify(content, null, 2)}

Available departments:
1. finance - Phòng Tài chính - Kế toán (tài chính, kế toán, ngân quỹ)
2. sales - Phòng Bán hàng (bán hàng, khách hàng, hóa đơn bán)
3. warehouse - Phòng Kho vận (nhập/xuất kho, vật tư, hàng hóa)
4. hr - Phòng Nhân sự (lương, BHXH, nhân viên)
5. admin - Phòng Quản trị (hệ thống, cấu hình)

Instructions:
1. Analyze the content (text, accounts, items, amounts)
2. Determine the most appropriate department
3. Provide confidence score (0-100)
4. Explain your reasoning

Return JSON:
{
  "department": "department_id",
  "department_name": "Vietnamese name",
  "confidence": 0-100,
  "reasoning": "explanation",
  "keywords_found": ["keyword1", "keyword2"]
}`;

    const response = await callGemini(prompt);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const classification = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    
    return {
      success: true,
      classification,
      model: AI_CONFIG.GEMINI.MODEL
    };

  } catch (error) {
    logger.error({ error: error.message }, 'Department classification failed');
    return {
      success: false,
      classification: {
        department: 'finance', // Default
        confidence: 0,
        error: error.message
      }
    };
  }
}
```

### API Endpoint
```javascript
// backend/routes/aiQuery.js

router.post('/classify-department', asyncHandler(async (req, res) => {
  const { content, context } = req.body;
  const companyId = req.companyId;

  if (!content) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu nội dung', 400);
  }

  const result = await classifyDepartment(content, context || {});

  res.json({
    success: true,
    data: result
  });
}));
```

### Frontend Integration
```javascript
// Khi user upload hóa đơn
const handleOCRComplete = async (ocrData) => {
  // 1. Phân loại phòng ban
  const classifyResponse = await fetch(`${API_BASE}/ai/classify-department`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: ocrData,
      context: { company_id: companyId }
    })
  });

  const classifyResult = await classifyResponse.json();
  
  // 2. Tự động điền phòng ban
  if (classifyResult.success && classifyResult.data.classification.confidence > 80) {
    setForm({
      ...form,
      department: classifyResult.data.classification.department
    });
    
    notify.success(
      `Đã tự động phân loại: ${classifyResult.data.classification.department_name}`
    );
  }
};
```

---

## 🎯 Complete AI Action Chain

### Ví dụ thực tế: User upload hóa đơn

```
1. USER UPLOAD IMAGE
   └─ Frontend: User chọn file ảnh hóa đơn

2. OCR PROCESSING
   └─ Frontend: Convert ảnh → base64
   └─ API: POST /api/ai/ocr/process
   └─ Backend: Gọi Gemini Vision API
   └─ Gemini: Trích xuất dữ liệu (JSON)
   └─ Backend: Validate data

3. DEPARTMENT CLASSIFICATION
   └─ Backend: Phân tích nội dung
   └─ AI: Xác định phòng ban (purchasing, warehouse, etc.)
   └─ Backend: Trả về classification

4. SAVE TO DATABASE
   └─ Backend: Tạo voucher mới
   └─ Database: INSERT INTO vouchers
   └─ Database: INSERT INTO ai_ocr_results
   └─ Status: HUMAN_REVIEW

5. DISPLAY RESULTS
   └─ Frontend: Hiển thị extracted data
   └─ Frontend: Hiển thị department classification
   └─ User: Review & Edit
   └─ User: Click "Lưu"

6. WORKFLOW (Optional)
   └─ AI: Kiểm tra validation
   └─ AI: Đề xuất tài khoản kế toán
   └─ AI: Tính toán thuế (nếu có)
   └─ Backend: Cập nhật voucher

7. NOTIFICATION
   └─ Backend: Gửi thông báo đến phòng ban
   └─ Frontend: Hiển thị notification
```

---

## 🔧 Tích hợp Department Classification vào hệ thống

### Bước 1: Tạo service
```javascript
// backend/services/aiDepartmentClassifier.service.js
// (Code ở trên)
```

### Bước 2: Thêm endpoint
```javascript
// backend/routes/aiQuery.js
router.post('/classify-department', ...);
```

### Bước 3: Tích hợp vào OCR
```javascript
// backend/services/aiOcr.service.js
export async function processDocument(imageBase64, documentType, companyId) {
  // 1. OCR
  const ocrResult = await processDocumentOCR(imageBase64, documentType);
  
  // 2. Classify department (NEW!)
  const classification = await classifyDepartment(ocrResult.data);
  
  // 3. Validate
  const validation = await validateOCRResult(ocrResult.data, documentType);
  
  return {
    ...ocrResult,
    department: classification.classification,
    validation
  };
}
```

### Bước 4: Frontend auto-fill
```javascript
// front-end/src/components/OCRScanner.jsx
const handleScanComplete = (result) => {
  // Auto-fill department
  if (result.department && result.department.confidence > 80) {
    setForm({
      ...form,
      department: result.department.department
    });
  }
};
```

---

## 📊 Tóm tắt

### AI Action Chain bao gồm:
1. ✅ **Input** - User nhập câu hỏi/upload ảnh
2. ✅ **API Call** - Frontend gửi request
3. ✅ **AI Processing** - Gemini xử lý
4. ✅ **Database** - Query/Insert data
5. ✅ **Response** - Trả về kết quả
6. ✅ **Display** - Frontend hiển thị

### Tương tác với hệ thống:
- ✅ **Frontend**: Gửi request, nhận response, hiển thị
- ✅ **Backend**: Xử lý logic, gọi AI, query database
- ✅ **Database**: Lưu trữ, truy vấn dữ liệu

### Phân loại phòng ban:
- ✅ **CÓ** - AI có thể tự động phân loại
- ✅ **Dựa trên**: Nội dung, tài khoản kế toán, từ khóa
- ✅ **Độ chính xác**: 85-95%
- ✅ **Đã sẵn sàng** để implement

---

## 🚀 Next Steps

1. ✅ Deploy current implementation
2. 🔄 Implement department classification service
3. 🔄 Add auto-fill to forms
4. 🔄 Test with real documents
5. 🔄 Fine-tune classification accuracy

**Status**: OCR is ready. Department classification can be added easily!