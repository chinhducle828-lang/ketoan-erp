# CORS Fix for Railway Production

## Problem
Your local frontend at `http://localhost:3001` is being blocked by CORS when trying to access the Railway production backend at `https://dazzling-grace-production-03a5.up.railway.app`.

## Solution

### Option 1: Add localhost to Railway Environment Variables (Recommended for Development)

1. **Go to Railway Dashboard:**
   - Open your project at https://railway.app
   - Select your backend service (dazzling-grace-production-03a5)

2. **Navigate to Environment Variables:**
   - Click on the "Variables" tab
   - Find the `FRONTEND_URL` variable

3. **Update FRONTEND_URL:**
   ```
   FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app,http://localhost:3001,http://localhost:3000
   ```

4. **Save and Redeploy:**
   - Click "Save" or "Deploy"
   - Wait for the backend to restart (usually 1-2 minutes)

### Option 2: Use Production Frontend URL (Better for Testing)

Instead of running frontend locally, use the production frontend:

1. **Update your frontend `.env`:**
   ```bash
   VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app
   ```

2. **Build and serve production frontend:**
   ```bash
   cd front-end
   npm run build
   npm run preview
   ```

### Option 3: Use a Proxy (Alternative for Development)

Create a proxy configuration in your frontend:

**`front-end/vite.config.js`:**
```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://dazzling-grace-production-03a5.up.railway.app',
        changeOrigin: true,
        secure: false
      }
    }
  }
}
```

Then access frontend at `http://localhost:3000` (or whatever port Vite uses).

## Current CORS Configuration

The backend CORS is configured in `backend/server.js` (lines 64-124):

```javascript
const rawFrontend = process.env.FRONTEND_URL || '';
const allowedOrigins = [...new Set(rawFrontend.split(',').map(s => s.trim()).filter(Boolean))];

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép request không có origin (Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Trong production, bắt buộc phải cấu hình FRONTEND_URL
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: origin not allowed in production'));
    }

    // Check if origin is in allowed list
    if (normalizedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // Allow Railway origins
    if (allowedRailwayOrigin && normalizedOrigin.endsWith('.railway.app')) {
      return callback(null, true);
    }

    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
}));
```

## Verification

After applying the fix, verify CORS is working:

1. **Open browser DevTools (F12)**
2. **Go to Network tab**
3. **Refresh the page**
4. **Check for CORS errors** - should be gone
5. **Check response headers** - should include:
   ```
   Access-Control-Allow-Origin: http://localhost:3001
   Access-Control-Allow-Credentials: true
   ```

## Security Note

⚠️ **Important:** Only add `localhost` to production `FRONTEND_URL` during development. For production deployment:

1. Remove `localhost` from `FRONTEND_URL`
2. Use only your production frontend domains:
   ```
   FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app
   ```

## Quick Fix Command

If you have Railway CLI installed:

```bash
railway variables set FRONTEND_URL="https://ketoanonline.up.railway.app,https://banhang.up.railway.app,http://localhost:3001"
```

Or using Railway Dashboard:
1. Go to https://railway.app/dashboard
2. Select your project
3. Click on backend service
4. Go to Variables tab
5. Edit `FRONTEND_URL`
6. Add `,http://localhost:3001` to the end
7. Save and wait for redeploy

## Testing

After the backend restarts:

1. Clear browser cache (Ctrl+Shift+R)
2. Refresh your local frontend
3. CORS errors should be resolved
4. API calls should work

## Alternative: Use Production URLs for Testing

If you don't want to modify Railway environment variables, you can test against production directly:

1. Deploy your frontend to Railway/Vercel/Netlify
2. Update `FRONTEND_URL` to include the deployed frontend URL
3. Access the production frontend instead of localhost

This is the recommended approach for testing production-like environments.