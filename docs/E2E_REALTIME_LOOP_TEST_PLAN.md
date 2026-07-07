# E2E Realtime Loop-Safety Test Plan

## Objective
Validate that Phase 2 (frontend invalidation orchestration) and Phase 3 (backend cascade validation) work consistently and do not create infinite request/realtime loops.

## Scope
- Frontend: websocket subscription, invalidation debounce, loop guard, self-event suppression.
- Backend: voucher/item/order/closing mutation guards and cascade reference checks.
- Cross-module flows: partner, inventory, vouchers, sales order ingestion, report closing.

## Preconditions
1. Backend is running with database and websocket enabled.
2. Frontend is running in two separate browser sessions:
- Session A: normal user with write permissions.
- Session B: another user (or same user in another browser profile) to verify remote sync.
3. Browser DevTools Network tab is open in both sessions.
4. Clear browser storage before test start.

## Observability Setup
1. In Session A and Session B, enable Network recording and preserve logs.
2. Filter by:
- `vouchers`
- `items`
- `report`
- `inventory`
- `socket`
3. In backend logs, track realtime payload frequency by event name.

## Test Matrix

### Case 1: Voucher Create Sync (No Loop)
1. In Session A, create 1 voucher.
2. Expected:
- Session A: exactly 1 create API call, max 1-2 follow-up GET refresh calls per screen.
- Session B: no POST; only refresh GET calls triggered by realtime.
- No repeating periodic burst after initial sync window (5 seconds).

### Case 2: Voucher Update/Delete Sync (No Loop)
1. In Session A, update then delete the same voucher.
2. Expected:
- Session A and B both refresh once per event group (debounced).
- No chain reaction where refresh API calls trigger more writes.

### Case 3: Item Delete Cascade Protection
1. Try deleting an item already referenced by voucher details.
2. Expected:
- API responds with business error (cannot delete referenced item).
- No realtime `inventory` broadcast on failed delete.

### Case 4: Cross-Company Reference Guard
1. Attempt to create/update voucher with `partner_id` or `item_id` from another company.
2. Expected:
- API rejects request with reference integrity error.
- No partial write.

### Case 5: Sales Order Ingestion Guard
1. Send integration order payload with invalid customer/item references.
2. Expected:
- API rejects before enqueue.
- No queue job created.

### Case 6: Closing Broadcast Loop Check
1. Trigger closing from Session A.
2. Expected:
- Session A and Session B receive one closing event each.
- Dependent screens refresh once (or debounced group), then become idle.

### Case 7: Self-Event Suppression
1. In Session A, trigger write operations quickly (create 5 vouchers in sequence).
2. Expected:
- Session A does not repeatedly re-process identical self-origin events.
- Refresh volume remains bounded by debounce and loop guard thresholds.

## Infinite Loop Detection Rules
Treat as failure if any condition is true:
1. A single write operation causes more than 10 repeated GET requests on the same endpoint within 10 seconds in one session.
2. Network requests continue without user action for longer than 15 seconds after the last mutation.
3. Backend logs show repeating identical event payloads for the same entity without new writes.

## Pass Criteria
1. All guarded invalid mutations fail with clear business errors.
2. Valid mutations sync to other sessions within 3 seconds.
3. No request/event storm meets failure thresholds in loop detection rules.
4. Session A and Session B converge to the same visible data state.

## Optional Automation Outline
1. Use Playwright with two browser contexts (A/B).
2. Instrument frontend `fetch`/axios calls and websocket events in-page.
3. Count calls per endpoint/event in a 10-second window.
4. Assert thresholds from "Infinite Loop Detection Rules".
5. Export JSON evidence per test case.

## Regression Checklist (Run before release)
1. Voucher create/update/delete/post.
2. Item create/update/delete.
3. Partner create + list refresh.
4. Sales order integration enqueue + status update.
5. Closing execute + report refresh.
6. Multi-tab realtime consistency.
