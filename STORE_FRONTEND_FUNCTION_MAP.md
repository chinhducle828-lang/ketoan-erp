# Storefront and Front-end Function Map

## 1) Role mapping across apps

| ERP role code | Front-end behavior | Storefront mode | Main capabilities |
|---|---|---|---|
| guest (fallback) | Can open notice page and redirect | guest | browse items, cart, create order |
| admin | ERP modules + POS entry | admin | item CRUD, queue tracking, no checkout |
| nv_banhang | Redirect to storefront-only flow | nv_banhang | cart, checkout, queue tracking |
| nv_kho | Redirect to storefront-only flow | nv_kho | queue tracking only |
| other roles (ktt, nv, gd_kinhdoanh) | Stay in ERP modules | guest when opening storefront link | safe read/order guest mode |

## 2) Front-end to storefront bridge

Source:
- front-end/src/App.jsx
- front-end/src/views/auth/StorefrontAccessNotice.jsx
- front-end/src/constants/storefrontRoles.js

Flow:
1. Front-end detects role from auth state.
2. If role is storefront-only (nv_banhang, nv_kho), redirect user to storefront notice.
3. Notice page builds storefront URL with:
   - company_id
   - normalized role (supported roles only)
   - erp_token
   - erp_url
4. Storefront receives query params and boots the matching UI mode.

## 3) Storefront capability map

Source:
- storefront/src/StorefrontPage.jsx

Single map now drives feature gates:
- canOrder
- canUseCart
- canManageItems
- canTrackQueue

This removes duplicated if/else role checks and keeps role behavior deterministic.

## 4) API-level function mapping

| User action | Storefront API | Backend route |
|---|---|---|
| Load product catalog | GET /api/public/items?company_id=... | backend/routes/publicRoutes.js -> router.get('/items') |
| Place web order | POST /api/public/orders | backend/routes/publicRoutes.js -> router.post('/orders') |
| Admin create/update/delete item | /api/items | backend/routes/items.js |
| Warehouse queue tracking | GET /api/logistics/queue-details | backend/routes/logisticsRoutes.js |
| Mark logistics status chain | POST assign-truck -> confirm-loaded -> mark-completed | backend/routes/logisticsRoutes.js |

## 5) Algorithm improvement applied

Updated item filter/sort in storefront:
- normalize search/category once per run
- null-safe normalization for name/code/category/price
- single pass filtering loop
- run sort only for selected sort mode

Expected effect:
- fewer repeated string conversions
- safer handling for incomplete item fields
- better performance on larger item lists
