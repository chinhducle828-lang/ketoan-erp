# Gemini AI Integration Guide

## Overview

This document describes the complete Gemini AI integration for the Ketoan ERP system, replacing all mock AI endpoints with real Google Gemini 2.5 Flash API calls.

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React + Vite)         │
│  ┌───────────────────────────────────┐  │
│  │   AI Financial Copilot            │  │
│  │  - Chat Interface                 │  │
│  │  - Math Calculator                │  │
│  │  - Workflow Analyzer              │  │
│  │  - Cross-Module Insights          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────┐
│      Backend (Node.js + Express)        │
│  ┌───────────────────────────────────┐  │
│  │   AI Orchestrator Service         │  │
│  │  - Cross-Module Communication     │  │
│  │  - Workflow Management            │  │
│  │  - Context Sharing                │  │
│  └───────────────────────────────────┘  │
│  ┌─────────┐  ┌────────────────────┐   │
│  │ Gemini  │  │  AI Copilot        │   │
│  │ Client  │  │  Service           │   │
│  │ Service │  │  (text-to-SQL)     │   │
│  └─────────┘  └────────────────────┘   │
│  ┌─────────┐  ┌────────────────────┐   │
│  │ Math    │  │  Other AI          │   │
│  │ Engine  │  │  Services          │   │
│  └─────────┘  └────────────────────┘   │
└─────────────────────────────────────────┘
                     │
                     │ API Calls
                     ▼
┌─────────────────────────────────────────┐
│      Gemini 2.5 Flash (Google AI)       │
│  - Text-to-SQL                          │
│  - Natural Language Understanding     │
│  - Math/Algebra Reasoning             │
│  - Code Generation                      │
└─────────────────────────────────────────┘
                     │
                     │ SQL Queries (parameterized)
                     ▼
┌─────────────────────────────────────────┐
│      PostgreSQL Database                │
│  - vouchers, partners, items, etc.      │
│  - company_id isolation                 │
└─────────────────────────────────────────┘
```

## Features Implemented

### 1. Gemini AI Integration
- **Text-to-SQL**: Convert natural language questions to SQL queries
- **Data Analysis**: Analyze query results and generate insights
- **Math Engine**: Solve algebra and financial calculations
- **Workflow Intelligence**: Analyze and optimize accounting workflows
- **Cross-Module Insights**: Synthesize data from multiple modules

### 2. Security Features
- ✅ Parameterized SQL queries (no SQL injection)
- ✅ Company ID isolation (multi-tenant security)
- ✅ SELECT-only queries (no data modification)
- ✅ Dangerous keyword detection
- ✅ Audit logging for all queries

### 3. Cloud-Ready Features
- ✅ Environment variable configuration
- ✅ Rate limiting (15 req/min free tier)
- ✅ Retry logic with exponential backoff
- ✅ Timeout handling (30s default)
- ✅ Fallback to Python service if Gemini unavailable
- ✅ Docker deployment ready
- ✅ Railway.app compatible

### 4. Frontend Features
- ✅ Modern chat interface (ChatGPT-like)
- ✅ Multiple modes: Chat, Math, Workflow, Insights
- ✅ Quick action buttons
- ✅ SQL query viewer with copy functionality
- ✅ Data table display
- ✅ Confidence scores
- ✅ Suggested questions
- ✅ Conversation history
- ✅ Responsive design

## Files Created/Modified

### Backend Files

#### Created:
1. **backend/services/geminiClient.js** - Gemini AI client service
   - `initializeGemini()` - Initialize Gemini API
   - `generateSQL()` - Text-to-SQL conversion
   - `analyzeData()` - Data analysis and insights
   - `solveMathProblem()` - Math/algebra solver
   - `analyzeWorkflow()` - Workflow analysis
   - `generateInsights()` - Cross-module insights
   - `chat()` - General chat functionality

2. **backend/services/aiOrchestrator.service.js** - AI Orchestrator
   - `WORKFLOWS` - Workflow definitions (CLOSING, RECONCILIATION, TAX_REPORT, INVENTORY_AUDIT)
   - `executeWorkflow()` - Execute multi-step workflows
   - `getProactiveInsights()` - Get proactive AI insights
   - `analyzeCrossModule()` - Cross-module analysis

#### Modified:
1. **backend/config/aiConfig.js** - Added Gemini configuration
   - API_KEY, MODEL, MAX_TOKENS, TEMPERATURE
   - Rate limiting settings
   - Timeout and retry settings

2. **backend/.env.example** - Added GEMINI_API_KEY

3. **backend/services/aiCopilot.service.js** - Integrated Gemini
   - `textToSQL()` - Now uses Gemini (with Python fallback)
   - `askFinancialCopilot()` - Now uses Gemini for analysis
   - `solveMathProblem()` - New math solver
   - `analyzeWorkflow()` - New workflow analyzer

4. **backend/routes/aiQuery.js** - Added new endpoints
   - `POST /api/ai/math` - Math solver
   - `POST /api/ai/workflow/execute` - Workflow execution
   - `GET /api/ai/proactive-insights` - Proactive insights
   - `POST /api/ai/cross-module` - Cross-module analysis

### Frontend Files

#### Created:
1. **front-end/src/views/dashboard/AIFinancialCopilot.jsx** - Main AI interface
   - Chat interface with message history
   - Multiple modes (chat, math, workflow, insights)
   - Quick actions
   - SQL query viewer
   - Data tables
   - Confidence scores

#### Modified:
1. **front-end/src/views/index.js** - Already had AI Copilot module registered

## API Endpoints

### Existing Endpoints (Enhanced)
- `POST /api/ai/query` - Financial Q&A (now uses Gemini)
- `GET /api/ai/suggested` - Get suggested questions
- `GET /api/ai/insights` - Get AI insights

### New Endpoints
- `POST /api/ai/math` - Solve math/financial problems
  ```json
  {
    "problem": "Tính lãi suất 12% trên 100 triệu VND",
    "context": "financial"
  }
  ```

- `POST /api/ai/workflow/execute` - Execute AI workflow
  ```json
  {
    "workflowType": "CLOSING",
    "context": {
      "period": "current_month"
    }
  }
  ```

- `GET /api/ai/proactive-insights` - Get proactive insights
  ```
  Returns insights from all AI modules
  ```

- `POST /api/ai/cross-module` - Cross-module analysis
  ```json
  {
    "question": "Phân tích mối quan hệ giữa doanh thu và tồn kho"
  }
  ```

## Environment Variables

### Required for Gemini AI
```env
# Google Gemini API Key (Get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Optional (for fallback)
```env
# Python AI Service URL (fallback if Gemini unavailable)
PYTHON_AI_SERVICE_URL=https://robust-dedication-production-6a94.up.railway.app
```

## Deployment to Railway

### 1. Set Environment Variables

In Railway dashboard, add these environment variables:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional (already configured)
PYTHON_AI_SERVICE_URL=https://robust-dedication-production-6a94.up.railway.app
AI_CONFIDENCE_AUTO_POSTED=95
AI_CONFIDENCE_HUMAN_REVIEW=80
```

### 2. Deploy Backend

The backend will automatically:
1. Install `@google/generative-ai` package
2. Initialize Gemini on startup
3. Enable AI features if API key is valid
4. Fallback to Python service if Gemini unavailable

### 3. Deploy Frontend

The frontend will:
1. Build with new AI Copilot interface
2. Connect to backend AI endpoints
3. Display Gemini status in UI

### 4. Verify Deployment

Check backend logs for:
```
✅ Gemini AI client initialized successfully
```

Check frontend for:
```
✨ Gemini 2.5 Flash đã kết nối
```

## Usage Examples

### 1. Financial Q&A
```
User: Doanh thu tháng này là bao nhiêu?
AI: [Generates SQL] → [Executes query] → [Analyzes results]
    Answer: Tổng doanh thu tháng này là 150,000,000 VND
```

### 2. Math Solver
```
User: Tính lãi suất 12% trên 100 triệu VND trong 1 năm
AI: [Solves step-by-step]
    Lãi = 100,000,000 × 12% = 12,000,000 VND
```

### 3. Workflow Execution
```
User: CLOSING (Kết sổ kỳ)
AI: [Executes 6-step workflow]
    1. Kiểm tra doanh thu ✅
    2. Kiểm tra chi phí ✅
    3. Đối chiếu công nợ ✅
    4. Kiểm kê kho ✅
    5. Rà soát dòng tiền ✅
    6. Tạo báo cáo ✅
    
    Summary: Kết sổ thành công...
```

### 4. Cross-Module Insights
```
User: Phân tích sức khỏe tài chính tổng quan
AI: [Gathers data from all modules]
    [Synthesizes insights]
    
    📊 Tài chính: Tốt
    📦 Kho: Cần điều chỉnh
    💰 Dòng tiền: Ổn định
    ⚠️ Bất thường: 2 phát hiện
    
    Khuyến nghị:...
```

## Rate Limiting

### Gemini Free Tier Limits
- **15 requests per minute (RPM)**
- **1,000,000 tokens per minute (TPM)**
- **1,500 requests per day**

### Mitigation Strategies
1. **Caching**: Cache frequent queries
2. **Batching**: Combine multiple questions
3. **Fallback**: Use Python service when rate limited
4. **Retry**: Exponential backoff on 429 errors
5. **Queue**: Implement request queue for high load

## Troubleshooting

### Gemini Not Available
```
Check:
1. GEMINI_API_KEY is set in environment
2. API key is valid (test at https://aistudio.google.com/app/apikey)
3. Network connectivity to Google APIs
4. Rate limits not exceeded

Fallback: System automatically uses Python service
```

### SQL Generation Errors
```
Check:
1. Question is clear and specific
2. Database schema is correct
3. Company ID is provided
4. No dangerous keywords in generated SQL

Security: All SQL is validated and parameterized
```

### Frontend Not Loading
```
Check:
1. Backend is running on correct port
2. CORS is configured correctly
3. API_BASE URL is correct
4. Authentication token is valid
```

## Performance Metrics

### Expected Performance
- **Text-to-SQL**: 2-3 seconds
- **Data Analysis**: 3-5 seconds
- **Math Solver**: 1-2 seconds
- **Workflow Execution**: 10-30 seconds (depends on steps)
- **Cross-Module Insights**: 5-10 seconds

### Optimization Tips
1. Use shorter prompts for faster responses
2. Limit data returned (max 100 rows)
3. Cache frequent queries
4. Use workflow execution for batch operations
5. Monitor rate limits in production

## Security Considerations

### Data Security
- ✅ All SQL queries are parameterized
- ✅ Company ID isolation enforced
- ✅ No sensitive data in logs
- ✅ API keys stored in environment variables
- ✅ HTTPS only in production

### Access Control
- ✅ Authentication required for all endpoints
- ✅ Role-based access (admin, ktt, gd_kinhdoanh)
- ✅ Company-level data isolation
- ✅ Audit logging for all AI queries

### AI Safety
- ✅ SELECT-only queries (no data modification)
- ✅ Dangerous keyword detection
- ✅ Query validation before execution
- ✅ Timeout protection
- ✅ Error handling and fallbacks

## Monitoring

### Backend Logs to Monitor
```javascript
// Gemini initialization
'Gemini AI client initialized successfully'

// Query execution
'Text-to-SQL generated with Gemini'
'Executing parameterized SQL query'

// Errors
'Failed to generate SQL'
'Gemini API timeout'
```

### Frontend Indicators
- ✨ Gemini 2.5 Flash đã kết nối (green)
- ⚠️ Chế độ offline (yellow)
- ❌ Lỗi: ... (red)

## Cost Estimation

### Gemini 2.5 Flash (Free Tier)
- **Cost**: $0 (free tier)
- **Limits**: 15 RPM, 1M TPM, 1500 RPD
- **Sufficient for**: Small to medium businesses

### Gemini 2.5 Flash (Paid)
- **Cost**: ~$0.075 per 1K requests
- **No rate limits**
- **Sufficient for**: Enterprise usage

### Cost Optimization
1. Use free tier for development
2. Implement caching for frequent queries
3. Batch operations when possible
4. Monitor usage in production
5. Upgrade to paid tier when needed

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Set GEMINI_API_KEY environment variable
3. ✅ Test all AI features
4. ✅ Monitor rate limits
5. ✅ Collect user feedback
6. 🔄 Add more workflow types
7. 🔄 Implement caching layer
8. 🔄 Add voice input
9. 🔄 Add file attachment analysis
10. 🔄 Implement AI learning from corrections

## Support

For issues or questions:
1. Check logs in Railway dashboard
2. Verify GEMINI_API_KEY is set
3. Test API key at https://aistudio.google.com/app/apikey
4. Check rate limits in Google AI Studio
5. Review this documentation

## License

Copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán