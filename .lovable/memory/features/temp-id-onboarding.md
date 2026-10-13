Temp ID onboarding flow implemented 2026-03-22. Replaces old institution-code + HMAC QR flow.

## Flow
Admin → create-bulk-temp-ids → temp_credentials table → SPOC → generate-spoc-qr (picks unused temp ID) → QR with temp_id+password → Student scans → verify-temp-credentials → Register page → activate-account → permanent account

## Tables
- temp_credentials: institution_id, temp_username, temp_password_hash, temp_password_plain, status (unused/assigned/activated), auth_user_id

## Edge Functions
- create-bulk-temp-ids: Admin creates pool of temp credentials
- generate-spoc-qr: SPOC picks unused temp ID, marks assigned, returns QR payload
- verify-temp-credentials: Validates temp username+password, rate limited
- activate-account: Creates real auth user, updates profile, marks temp cred activated, auto-login

## Frontend Changes
- /institution-code route removed
- QRScan.tsx: Parses {temp_id, temp_password, institution_id} JSON payload
- Register.tsx: Detects temp_credential_id in sessionStorage → calls activate-account instead of signUp
- MemberManager.tsx: Uses create-bulk-temp-ids, shows temp credential pool with status counts
- SPOCDashboardContent.tsx: Shows temp ID pool stats, removed single-student creation
