# Bug History

This file documents every significant bug encountered, its status, and the fix applied.

## BUG-001
- **Status**: FIXED
- **File**: `front_end/src/app/pages/app/SearchBusinessesPage.tsx`
- **Cause**: Active polling intervals were not cleared when the user cancelled or switched sessions, causing state corruption and race conditions.
- **Fix**: Implemented a cleanup sequence `handleCancelVerify` to stop all active polling intervals (`clearInterval`) before loading a new search session.

## BUG-002
- **Status**: FIXED
- **File**: `front_end/src/app/pages/app/SearchBusinessesPage.tsx`
- **Cause**: Per-row save operations were using stale state (`selectedIds`), causing the wrong business to be saved or the action to fail.
- **Fix**: Modified the per-row save function to directly call the API with the specific ID, bypassing the generic `selectedIds` state.

## BUG-003
- **Status**: FIXED
- **File**: `front_end/src/app/pages/app/SearchBusinessesPage.tsx`
- **Cause**: Links prepended `https://` without stripping existing protocols, leading to broken `https://http://...` URLs.
- **Fix**: Added logic to strip existing protocols before prepending `https://`.

## BUG-004
- **Status**: FIXED
- **File**: `front_end/src/app/pages/app/SearchBusinessesPage.tsx`
- **Cause**: Export functionality was a UI placeholder.
- **Fix**: Export button wired up to the real API endpoint `handleExport`.

## BUG-005
- **Status**: FIXED
- **File**: `front_end/src/app/pages/app/SearchBusinessesPage.tsx`
- **Cause**: UI lacked a loading state while session results were being fetched, leaving the user confused.
- **Fix**: Added a spinner and visual loading state during session results fetch.

## BUG-006
- **Status**: PENDING
- **File**: Backend API Routes (`save_client`, `email_send`, `email_generate`)
- **Cause**: Missing IDOR (Insecure Direct Object Reference) checks. Users could modify records they don't own by passing arbitrary IDs.
- **Fix**: Implement `current_user.id` checks against the resource's `user_id` before performing actions.

## BUG-007
- **Status**: PENDING
- **File**: `backend/app/services/campaign_engine_service.py`
- **Cause**: The campaign engine never correctly deducts actual credits from the `UserCredit` balance during its background loop.
- **Fix**: Integrate `credit_service.deduct_credits` properly inside the campaign loop.

## BUG-008
- **Status**: PENDING
- **File**: `backend/app/services/campaign_engine_service.py`
- **Cause**: Campaign engine is an `async def` but executes synchronous SQLAlchemy calls, blocking the event loop and starving other requests.
- **Fix**: Use `run_in_threadpool` or migrate to `asyncSession` for the background task database interactions.

## BUG-009
- **Status**: FIXED
- **File**: `front_end/src/lib/api.ts`
- **Cause**: Frontend API calls hitting the wrong endpoint URLs, causing 404s (e.g., `/api/relevancy/v2/run` instead of `/api/v1/relevancy/run`).
- **Fix**: Updated API routes to match the actual FastAPI router prefixes.

## BUG-010
- **Status**: FIXED
- **File**: `front_end/src/app/pages/app/BusinessDetailsPage.tsx`, `CampaignEnginePage.tsx`
- **Cause**: Runtime crashes occurred when the frontend attempted to access properties on `null` objects (e.g., `website`, undefined API responses).
- **Fix**: Implemented null-safe data handling, optional chaining, and proper empty state rendering.

## BUG-011
- **Status**: FIXED
- **File**: `front_end/src/app/layouts/AppLayout.tsx`
- **Cause**: Misleading hardcoded UI elements (badge numbers, "Pro Plan", always-on red notification badge).
- **Fix**: Cleared hardcoded badges, dynamically pulled plan from user profile, removed static red notification dot.

## BUG-012
- **Status**: FIXED
- **File**: `front_end/src/app/pages/app/BillingPage.tsx`
- **Cause**: Buttons for billing actions (Change Plan, Update Payment, Download Invoice) were completely non-functional without feedback.
- **Fix**: Added "Coming Soon" toast notifications to all non-functional billing actions using `sonner`.
