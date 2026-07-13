m# AI Service Setup Guide

## ✅ Completed Steps:

1. **AI Service is running** on `http://localhost:8000` ✅
2. **Backend configured** with Gemini API key ✅
3. **Migration script created** ✅

## 🔧 Remaining Steps:

### Step 1: Run Database Migration in Railway

Since you don't have `psql` installed locally, run the migration in Railway's web console:

1. **Go to Railway Dashboard:**
   - https://railway.app/dashboard
   - Select your project
   - Click on PostgreSQL service

2. **Open PostgreSQL Console:**
   - Click "Query" tab
   - Copy and paste the SQL below

3. **Execute this SQL:**

```sql
-- Create ai_copilot_kb table
CREATE TABLE IF NOT EXISTS ai_copilot_kb (
    id BIGSERIAL PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    sql_query TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INT REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_copilot_kb_company ON ai_copilot_kb(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_copilot_kb_created ON ai_copilot_kb(created_at DESC);

-- Add due_date column to vouchers
ALTER TABLE vouchers 
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Add account_type column to accounts
ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(20);

-- Update account_type based on account_code
UPDATE accounts 
SET account_type = CASE 
  WHEN account_code LIKE '111%' OR account_code LIKE '112%' THEN 'cash'
  WHEN account_code LIKE '131%' OR account_code LIKE '132%' THEN 'receivable'
  WHEN account_code LIKE '141%' THEN 'inventory'
  WHEN account_code LIKE '331%' OR account_code LIKE '332%' THEN 'payable'
  WHEN account_code LIKE '4%' THEN 'revenue'
  WHEN account_code LIKE '5%' THEN 'expense'
  WHEN account_code LIKE '6%' OR account_code LIKE '7%' OR account_code LIKE '8%' THEN 'cost'
  ELSE 'other'
END
WHERE account_type IS NULL;
```

4. **Click "Run"** - Should see "Success" message

### Step 2: Update Railway Backend Environment Variables

1. **Go to Railway Dashboard** → Backend service → Variables tab

2. **Add/Update these variables:**
   ```
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
   PYTHON_AI_SERVICE_URL=https://robust-dedication-production-6a94.up.railway.app
   ```

3. **Save and wait for redeploy** (1-2 minutes)

### Step 3: Deploy AI Service to Railway (Optional but Recommended)

For production, deploy the AI service to Railway:

1. **In Railway Dashboard:**
   - Click "New" → "Empty Service"
   - Name it `ai-service`
   - Connect to GitHub repository

2. **Configure:**
   - Root directory: `ai-service`
   - Build command: `pip install -r requirements.txt`
   - Start command: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Add environment variables:**
   ```
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
   GEMINI_MODEL=gemini-2.0-flash-exp
   ```

4. **Deploy** - Railway will give you a URL like `https://your-ai-service.up.railway.app`

5. **Update backend `PYTHON_AI_SERVICE_URL`** to the new Railway URL

### Step 4: Test AI Features

After completing the steps above:

1. **Restart backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Test AI Copilot:**
   - Open the application
   - Try asking: "Tổng doanh thu hôm nay?"
   - Should return SQL query and results

3. **Check logs:**
   - Should see: "AI service available"
   - No more "Neither Gemini nor Python AI service available" warnings

## 🎯 Quick Test (Local Development Only)

If you just want to test locally without Railway:

1. **Keep AI service running:**
   ```bash
   cd ai-service
   python -m uvicorn main:app --reload --port 8000
   ```

2. **Start backend:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Test in browser:**
   - Open http://localhost:3001
   - Try AI Copilot feature
   - Should work with local AI service

## ⚠️ Important Notes:

1. **Gemini API Key:** The key you provided has rate limits (15 requests/minute on free tier)
2. **Local vs Production:** 
   - Local: AI service runs on `localhost:8000`
   - Production: AI service runs on Railway
3. **Database Migration:** Must be run in Railway PostgreSQL console (not locally)

## 🐛 Troubleshooting:

### "AI service not available" error:
- Check if AI service is running: `curl http://localhost:8000/health`
- Check backend logs for connection errors
- Verify `PYTHON_AI_SERVICE_URL` is correct

### "Table ai_copilot_kb does not exist" error:
- Run the SQL migration in Railway PostgreSQL console
- Verify table exists: `SELECT * FROM ai_copilot_kb LIMIT 1`

### "Gemini API error":
- Check API key is valid
- Check rate limits (15 req/min free tier)
- Verify internet connection

## 📚 Next Steps:

Once AI is working, you can:
1. Train the AI with your accounting data
2. Add more questions to `ai_copilot_kb` table
3. Configure confidence thresholds
4. Enable AI-powered suggestions

## 🚀 Status:

- [x] AI service code ready
- [x] AI service running locally
- [x] Backend configured
- [ ] Database migration executed (run SQL in Railway)
- [ ] Railway environment variables updated
- [ ] AI features tested