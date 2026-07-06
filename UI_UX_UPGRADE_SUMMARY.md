💎 KETOAN ERP & STOREFRONT: UNIFIED UI/UX MASTERPLAN SPECIFICATION

The Definitive Design System Blueprint for High-Density Sovereign ERP & High-Conversion Storefront
Version: 3.0 (Unified Masterplan) | Locales: Tiếng Việt (VI) & English (EN)
Core Principle: Maximum Visual Polish with Zero Workflow/Functional Disruption

📖 1. THE ARCHITECTURAL PHILOSOPHY & WORKFLOW PRESERVATION

To elevate the Ketoan ecosystem without introducing bug risks or retraining users, this upgrade strictly separates the Surface & Skeleton Planes (Visuals, Typography, Spacing, and Component Layouts) from the Scope & Strategy Planes (Business Logic, API Gateways, and Database schemas).

 ┌────────────────────────────────────────────────────────────────────────┐
 │   SURFACE PLANE  (Colors, Contrast, Borders, Grids, Micro-shadows)      │ <-- UPGRADE THIS (100%)
 ├────────────────────────────────────────────────────────────────────────┤
 │   SKELETON PLANE (Tabular Numbers, High-Density Spacing, Alignments)   │ <-- UPGRADE THIS (100%)
 ├────────────────────────────────────────────────────────────────────────┤
 │   STRUCTURE PLANE (Existing UI Navigation, Drawer toggles, Modals)     │ <-- PRESERVE WORKFLOW (95%)
 ├────────────────────────────────────────────────────────────────────────┤
 │   FUNCTIONAL/LOGIC PLANE (FIFO calculation, checkLockDate API, WS)    │ <-- KEEP UNTOUCHED (100%)
 └────────────────────────────────────────────────────────────────────────┘



🛡️ The "No-Disruption" Guardrails:

Zero Database Schema Changes: No database migrations, index additions, or schema adjustments are required.

Zero Route Re-writing: All API paths (/api/integration/orders, /partners, etc.) remain identical.

No Stateful Logic Rewrites: Existing React hooks, state initializations, and API fetch triggers inside components are preserved. We merely change how the data outputs are wrapped, styled, and aligned.

🎨 2. THE ECOSYSTEM DESIGN TOKENS (UNIFIED SURFACE)

Although ERP and Storefront target different users, they share a unified master color system. This ensures they feel like part of the same corporate suite while serving distinct density goals.

2.1. Shared Color System (Achromatic Base & Semantic Highlights)

|

| Token Name | ERP (Sovereign Mode) | Storefront (Transient Mode) | Application Rule |
| --color-bg-base | #030712 (Dark) / #F1F5F9 (Light) | #F8FAFC (Warm Slate Light) | Main viewport backdrop |
| --color-bg-surface | #0B0F19 (Dark) / #FFFFFF (Light) | #FFFFFF | Cards, table sheets, slide-out panels |
| --color-border-subtle | #1F2937 (Dark) / #E2E8F0 (Light) | #E2E8F0 (Slate 200) | Grid layout lines & inputs borders |
| --color-primary | #6366F1 (Indigo 500) | #4F46E5 (Indigo 600) | Actions, focus rings, checkout anchors |
| --color-success | #10B981 (Emerald 500) | #10B981 (Emerald 500) | Posted vouchers, Add-to-cart feedback |
| --color-warning | #F59E0B (Amber 500) | #F59E0B (Amber 500) | Draft status, Low-stock alarms |
| --color-danger | #EF4444 (Red 500) | #EF4444 (Red 500) | Negative stock alert, delete triggers |

2.2. Spacing & Density Inversion

ERP (Sovereign): Tight, data-dense spacing. Pad cells at py-1.5 px-3 (Row height ~32px) to minimize scrolling and keep financial ledgers fully visible on one page.

Storefront (Transient): Generous, breathable spacing. Pad product cards and lists at py-4 px-6 to create a luxurious B2B/B2C shopping experience that builds purchasing trust.

💻 3. FRONTEND ERP (SOVEREIGN) SPECIALIZATION

The accounting interface is designed for high-frequency daily operation. The upgrade focuses on typography and grid readouts without touching back-end controllers.

3.1. Sovereign Table Rules (VirtualTable Standard)

To avoid horizontal layout breaks and eliminate visual fatigue:

Tabular Numbers Alignment (Mandatory): Financial figures (Debit, Credit, Stock Balances) must align perfectly on the right decimal index. Use monospaced numerical rendering:

.amount-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}



Visual Status Badges: Instead of plain text status flags, render low-contrast backgrounds with high-contrast text to signal document states immediately without distracting the eye:

Posted (Đã ghi sổ): bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20

Draft (Sổ tạm): bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20

Locked (Đã khóa sổ): bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20

Sticky Table Headers: Keep column definitions pinned (sticky top-0) to prevent users from losing their place during vertical navigation.

3.2. Keyboard Ergonomics (Zero-Mouse Navigation)

Integrate simple listeners mapping browser events directly to the existing UI trigger handlers:

F2: Shift active focus to the main search inputs.

Alt + N: Trigger the existing state function to open the creation form or modal.

Ctrl + S: Trigger validation and execute the document "Post" API.

Esc: Reset local toggle states to close open modals or slide-out panels.

🛒 4. STOREFRONT PORTAL (TRANSIENT) SPECIALIZATION

The agent ordering interface must be simple and easily navigable on mobile screens (B2B wholesale orders are frequently made on tablet/phone screens on-site).

4.1. Mobile-First Thumb-Zone Layout

Persistent Floating Action Bar: On mobile displays, the cart summary and check-out CTA must remain locked at the bottom of the viewport for easy thumb access.

Generous Touch Targets: All interactive icons, quantity increment counters (+ and -), and delete buttons must have a minimum clickable area of 44px x 44px.

Visual Stock Meters: Display stock counts with intuitive micro-tags:

High stock: Emerald text badge.

Low stock: Amber label indicating exact numbers to encourage immediate checkout.

⚡ 5. THE REAL-TIME BRIDGE & WORKFLOW SYNC

To bridge the Storefront and the ERP smoothly without rewriting controllers, we implement a real-time visual HUD:

 [ Storefront Checkout Action ] 
               │
               ▼
   HTTP POST to /api/integration/orders  ──► [ ERP Voucher Ingestion Pipeline ]
               │                                                │
               ▼                                                ▼
     WebSocket Broadcast ────────► [ Real-Time ERP Ledger HUD ] ──► [ Sovereign Grid Table ]
 (Simulated through WS payload)      (Displays newly created voucher live as a 'Draft' record)



Seamless Ingestion: The Storefront cart payload maps product IDs directly to transaction line items on the ERP.

WS Status Alerts: When checking out, the UI transitions to a simulated WebSocket status container to reassure B2B agents that their order has safely landed in the accounting ledger as a Draft Voucher.

🌐 6. BILINGUAL DICTIONARY & LOCALIZATION STANDARD

To maintain a consistent tone across both language modes, the system must strictly map localization files using this standardized vocabulary list:

| Vietnamese Term (VI) | English Term (EN) | Interface Scope |
| Quản lý Chứng từ & Dòng tiền | General Ledger & Cash Vouchers | ERP Module Header |
| Tạo chứng từ mới 

$$Alt+N$$

 | New Voucher 

$$Alt+N$$

 | Primary CTA |
| Lưu & Ghi sổ 

$$Ctrl+S$$

 | Post Ledger 

$$Ctrl+S$$

 | Transaction Execution |
| Hủy 

$$Esc$$

 | Cancel 

$$Esc$$

 | Modal Backout |
| Đã Ghi Sổ | Posted | Balanced/Saved State Tag |
| Sổ Tạm | Draft | In-progress Ledger State |
| Đã Khóa Sổ | Locked | Closed-period Ledger State |
| Giá bán sỉ | Wholesale Price | Storefront Item Detail |
| Tồn kho khả dụng | Available in Stock | Storefront Stock Indicator |
| Thêm vào giỏ | Add to Cart | Conversion Anchor Button |
| Tiến hành đặt hàng | Place Order Now | Checkout Primary Action |
| Trạng thái WebSocket | WebSocket Status | API Integration HUD |
| Bảng đối soát Real-Time | ERP Co-Reconciliation HUD | Synchronization Diagnostic Panel |

📋 7. DEVELOPER IMPLEMENTATION CHECKLIST

Ensure the development team applies these updates systematically to keep existing business workflows safe:

$$$$

 Step 1: Universal CSS Inject
Apply the global CSS font rules for tabular numbers (font-variant-numeric: tabular-nums) to the core accounting grids.

$$$$

 Step 2: Apply Refactored Templates
Drop in the updated component files (SovereignTransactionView.jsx and StorefrontPortalView.jsx) that feature integrated, self-contained custom toast managers to prevent build failures.

$$$$

 Step 3: Verification of Business Handlers
Confirm that clicking "Checkout" successfully maps the shopping cart array to the existing ERP draft vouchers state array without altering properties or schema fields.

$$$$

 Step 4: Verify checkLockDate Guardrails
Ensure that clicking "Verify" on any "Locked" document correctly triggers a contextual error warning instead of executing a data-modifying API request.