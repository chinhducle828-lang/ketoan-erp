# Storefront (Standalone)

This folder is a standalone Vite app for the public storefront.

## Local run

1. Install dependencies:
   npm install
2. Configure env:
   copy .env.example to .env
3. Start dev server:
   npm run dev

## Railway deploy

Create a separate Railway service from the same GitHub repository and set:

- Root Directory: `storefront`
- Build Command: `npm install ; npm run build`
- Start Command: `npm run preview -- --host 0.0.0.0 --port $PORT`

Environment variables:

- `VITE_API_BASE_URL=https://<backend-service>.up.railway.app`
- `VITE_BASE_URL=/`
- `VITE_ALLOW_ROLE_SWITCH=false` (recommended for production)

Backend service should allow CORS origin from this storefront domain in `FRONTEND_URL`.

## Role-based display

Storefront now supports role-specific UI modes through query params:

- `role=nv_banhang`: sales mode (cart + checkout + create order)
- `role=nv_kho`: warehouse mode (catalog + operations tracking, no checkout)
- `role=admin`: storefront admin mode (product catalog CRUD in storefront)
- `company_id=<id>`: bind data to selected company

Admin mode notes:

- When opened from ERP admin account, storefront can receive `erp_token` and auto-create admin session.
- Manual admin login form on storefront has been removed; admin session is expected to come from ERP.
- Product form uses image upload button (`Thêm ảnh`) and sends files via multipart form-data to `/api/items`.
- Product form now includes `opening_quantity` (Số lượng nhập kho).

Examples:

- `https://storefront.example.com/?company_id=18&role=nv_banhang`
- `https://storefront.example.com/?company_id=18&role=nv_kho`
- `https://storefront.example.com/?company_id=18&role=admin`

When opening storefront from ERP, the link is now generated automatically with both `company_id` and `role`.

UI recommendation:

- Production: keep `VITE_ALLOW_ROLE_SWITCH=false` so header only shows current role badge.
- Local testing: set `VITE_ALLOW_ROLE_SWITCH=true` to show dev-only role switch buttons.

## ERP separation

`ItemManagement` has been separated from ERP module navigation and moved to storefront admin mode (`role=admin`).
