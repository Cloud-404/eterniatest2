# ETERNIA — VideoSDK → LiveKit Second-Pass Audit

**Audit type:** Static repository review; read-only.  
**Source:** `Eternia_web-main.zip` supplied in this conversation, plus `ETERNIA_VIDEOSDK_AUTHORIZATION_AUDIT.md`.  
**Outcome:** **NO-GO for a direct provider cutover until the critical authorization and credit-ledger issues below are addressed and tested.** The LiveKit client migration itself is feasible, but it must not carry the existing authorization model forward.

## Evidence labels

- **Confirmed in source:** directly demonstrated by code or migration SQL.
- **Likely impact:** the source path is present; exploitability or production impact depends on deployment/data/state.
- **Requires live verification:** cannot be established from the ZIP, such as actual deployed policies, secrets, or edge-function configuration.
- **Not tested:** proposed tests were not executed; no live service was contacted.

No project file was changed. No dependencies were installed. No migrations or Edge Functions were deployed. No production Supabase query was run. `.env` values were not read or reproduced.

---

## 1. Executive summary

The first audit's central conclusion is confirmed: `supabase/functions/videosdk-token/index.ts` authenticates the caller but does not authorize the caller for a specific appointment/session/room. It signs a two-hour JWT with `allow_join` and `allow_mod` and offers a `create-room` action to any authenticated account (`L44–65`, `L81–117`). The client-supplied room and participant identity are not bound to the server-issued token.

The second pass found additional issues that should be treated as urgent, independent of LiveKit:

1. **Critical credit-ledger policy regression:** `20260322071558_...sql` drops the self-insert credit policy as a security hardening step, but the later migration `20260322073805_...sql` reintroduces an equivalent policy (`WITH CHECK (auth.uid() = user_id)`). That check restricts *whose row* can be inserted into, but does not restrict `delta`, `type`, `reference_id`, or notes. A signed-in user can potentially insert arbitrary positive credit entries for their own account. The same policy enables client-side credit writes in `src/hooks/useCredits.ts` and `src/hooks/useEccEarn.ts`. This needs immediate live-policy verification and correction.
2. **Refund function is not atomic/idempotent under concurrency:** `refund-blackbox-session` reads `refunded`, then inserts a grant, then marks the session refunded in separate requests (`L70–126`). Two concurrent requests can both pass the check and insert two grants. It also does not verify the caller has a therapist role; it trusts `session.therapist_id === user.id` (`L63–68`). Because the student UPDATE policy allows changing fields on their own BlackBox row, a student may be able to set `therapist_id` to their own UUID and satisfy that check. Confirm this only in staging after reviewing the deployed policy; do not test on production.
3. **AI transcript endpoint has a session-authorization gap:** `ai-transcribe` validates a signed-in user (`L51–68`) but uses a service-role client to write to a peer session by caller-supplied `session_id` without checking session membership or status (`L227–231`). The BlackBox path fetches the session but does not compare `student_id` or therapist assignment to the caller (`L234–278`). It can create escalations/notifications (`L280–380`). It also accepts caller-controlled transcript/session type and has no rate limit in this function.
4. **Emergency escalation has broad role fallback:** an appointment escalation can be initiated by any account with the `expert` role even if not assigned to the appointment (`escalate-emergency/index.ts L96–104`); a peer escalation can be initiated by any `intern` for a session not assigned to them (`L120–128`). The function loads private emergency-contact fields (`L141–154`) and returns them in its response (`L287–295`). If cross-session escalation is not an explicit product requirement, this is a privacy and authorization gap.
5. **Audio/call lifecycle has repeat and cleanup risks:** `useSilenceDetection` calls `onAutoEnd` every second after the auto-end threshold (`L43–55`), and `MeetingView.handleSilenceAutoEnd` does not inspect the returned `{ error }` from `supabase.functions.invoke` before telling the user the refund succeeded (`MeetingView.tsx L404–415`). `useAudioMonitor` schedules SpeechRecognition restarts with untracked `setTimeout` calls (`L175–193`); on unmount it calls `stopListening`, but does not set `enabledRef` false or clear restart timers (`L205–232`), so a restart after unmount is possible.

**Migration decision:** build a new LiveKit token endpoint alongside VideoSDK, but do not cut over until (a) the credit ledger and session RLS policies are hardened, (b) every call type has server-side session authorization, (c) L3 claim is made atomic and happens before a join token is issued, and (d) staging tests cover desktop and mobile call flows.

## 2. Scope and inspection ledger

### Inspected in detail or targeted code ranges

| Area | Files reviewed | Result |
|---|---|---|
| Token and client helper | `supabase/functions/videosdk-token/index.ts`; `src/lib/videosdk.ts`; `src/components/videosdk/VideoCallModal.tsx` | Token scope, room creation, retries and client room persistence reviewed |
| Media lifecycle | `src/components/videosdk/MeetingView.tsx`; `ParticipantView.tsx`; `MeetingControls.tsx`; `src/hooks/useAudioMonitor.ts`; `src/hooks/useSilenceDetection.ts`; `src/components/blackbox/TherapistSessionControls.tsx` | Join/leave, audio routing, monitoring and silence/refund paths reviewed |
| BlackBox | `src/hooks/useBlackBoxSession.ts`; `src/pages/dashboard/BlackBox.tsx`; `src/components/mobile/MobileBlackBox.tsx`; relevant ranges of `src/components/therapist/TherapistDashboardContent.tsx` | Queue, acceptance, room persistence, token fetch, reconnect and end/refund paths reviewed |
| Peer Connect | relevant ranges of `src/hooks/usePeerConnect.ts`; `src/pages/dashboard/PeerConnect.tsx`; `src/components/mobile/MobilePeerConnect.tsx` | Creation, accept, room race, notification and join call sites reviewed |
| Appointments | `src/hooks/useAppointments.ts`; `src/pages/dashboard/Appointments.tsx`; relevant ranges of `src/components/mobile/MobileAppointments.tsx`, `src/components/expert/ExpertDashboardContent.tsx`, `src/components/mobile/MobileExpertDashboard.tsx` | Appointment room creation and join entry points reviewed |
| L3 / emergency / refund | `src/components/expert/ExpertL3AlertPanel.tsx`; `supabase/functions/claim-l3-session/index.ts`; `escalate-emergency/index.ts`; `refund-blackbox-session/index.ts`; `ai-transcribe/index.ts` | Claim race, role checks, service-role writes and refund path reviewed |
| Database security | relevant migrations for `appointments`, `peer_sessions`, `blackbox_sessions`, `notifications`, `credit_transactions`, role helpers and L3 RLS; `supabase/config.toml`; `_shared/security.ts`; relevant portions of `combined.sql` | Repository-declared policy history reviewed; live policies remain unknown |
| Dependency inventory | `package.json`, lockfile presence, `rg` references across source and Supabase functions | VideoSDK call-site list cross-checked |

### Coverage limits

This was a targeted second pass, not a line-by-line review of all 326 files. UI files unrelated to calling, most unrelated Edge Functions, all deployment environments, and production Supabase state were not fully audited. The existing `combined.sql` contains concatenated policy history, including superseded definitions; use timestamped migrations as history and verify actual production state through `pg_policies` before deciding what is currently active.

## 3. Previous findings F1–F13 verification

| ID | Verdict | Severity | Evidence and conclusion |
|---|---|---|---|
| F1 — unscoped token issuance | **Confirmed** | High | `videosdk-token/index.ts L44–65, L81–117`: validates login only; no session/appointment/room/role/assignment authorization. Token has `allow_join`, `allow_mod`, `iat`, `exp`, but no room or identity binding (`L84–91`). Arbitrary-room joinability is VideoSDK behavior and remains unverified. |
| F2 — client-controlled identity / BlackBox anonymity | **Confirmed** | High privacy relevance | `BlackBox.tsx L185`, `MobileBlackBox.tsx L138`, `TherapistDashboardContent.tsx L523–528`, `VideoCallModal.tsx L220–229`: frontend supplies participant ID and display name. BlackBox uses profile UUID and username. Therapist queue queries include student identity (`TherapistDashboardContent.tsx` around L100–125 and L436). |
| F3 — broad session UPDATE RLS | **Confirmed in migrations; live state unknown** | High | `20260309044708_...sql L19–33` creates appointment/peer UPDATE policies with no explicit `WITH CHECK`; `20260311182702_...sql L47–49` creates student BlackBox UPDATE policy; `20260326175650_...sql L18–28, L46–56, L74–84` gives expert/therapist/intern broad update rights. The relevant policies do not restrict sensitive columns. A missing explicit `WITH CHECK` does not mean no check at all: PostgreSQL defaults UPDATE's check to USING when omitted; however, these USING predicates remain true when a student changes `therapist_id`, `room_id`, or status while retaining their own `student_id`. |
| F4 — `ai-transcribe` session authorization | **Confirmed** | High | `ai-transcribe/index.ts L51–77` checks login and required fields; peer write at `L227–231` is by caller-supplied session UUID with service role and no membership/status check; BlackBox query/update at `L234–278` does not compare the caller to `student_id` or assigned therapist. L3 escalation records and notifications are then written at `L280–380`. |
| F5 — L3 claim race / join before claim | **Confirmed** | High | `claim-l3-session/index.ts L77–119` reads claim history, then updates by session ID only; it does not use a conditional predicate/transaction preventing two claimers from overwriting each other. `ExpertL3AlertPanel.tsx L125–141` opens the modal and only calls claim in `onCallJoined`, so the expert joins before the claim is confirmed. |
| F6 — session assignment field mutation | **Confirmed capability; impact likely** | High when chained with refund | Student BlackBox UPDATE policy uses `auth.uid() = student_id` (`20260311182702_...sql L47–49`) and no column-level restrictions. Student can potentially set their own row's `therapist_id` to their own UUID. The refund endpoint checks only that the row's `therapist_id` equals caller ID, not that the caller has a therapist role (`refund-blackbox-session/index.ts L63–68`). This creates a plausible authorization-bypass chain; validate in a staging clone only. |
| F7 — anonymity is UI-level | **Confirmed** | Medium privacy | Actual provider identity/name are set by the client; therapists can see the student's UUID/username in queue/session data. This does not meet a strong interpretation of “anonymous to the provider/therapist.” Decide the intended anonymity boundary and use pseudonymous provider identities. |
| F8 — orphan rooms / inconsistent persistence | **Confirmed** | Medium reliability | Appointment room create then DB persist (`VideoCallModal.tsx L65–107`); Peer Connect create then conditional persist (`usePeerConnect.ts L638–680`); therapist creates room before conditional claim (`TherapistDashboardContent.tsx L217–239`). Failed persistence/races can leave orphan rooms. Peer call path also emits a call message/notification after room persistence logic; a failed write can leave an unpersisted room ID in client flow. |
| F9 — notification spoofing | **Confirmed policy; impact likely** | Medium | `20260323165234_...sql` creates authenticated notification INSERT with `WITH CHECK (true)` (see original audit §7). `usePeerConnect.ts L668–678` emits `peer_call` notifications and the listener uses notification metadata to set incoming-call state. RLS on the session row may prevent actual joining, but users can spoof incoming-call notifications. |
| F10 — missing rate limiting / permissive CORS | **Confirmed for the token endpoint and `ai-transcribe`** | Medium | Token endpoint uses wildcard CORS (`videosdk-token/index.ts L3–6`) and does not import `_shared/security.ts` or call `checkRateLimit`. `ai-transcribe/index.ts L3–6, L45–77` also has wildcard CORS and no rate limit. The in-memory limiter in `_shared/security.ts L13–35` is not a distributed limit even when used. |
| F11 — BlackBox lifecycle/reconnect gaps | **Confirmed** | Medium | `useBlackBoxSession.ts L67–73` handles `accepted`/`active`; therapist accept sets `accepted` (`TherapistDashboardContent.tsx L219–231`), but inspected join handlers only write `*_joined_at`; no both-participants transition to `active` was found. Student cancel updates status, while therapist does not subscribe to the same session status changes in the inspected path. Reconnect token failure only toasts in `TherapistDashboardContent.tsx L173–179`; the render path shows loading rather than a retry control. |
| F12 — intern BlackBox RLS access | **Confirmed in migration history; live state unknown** | Medium privacy | `20260326175650_...sql L60–84` gives interns SELECT/UPDATE on queued/escalated sessions and flagged active/accepted sessions. `InternDashboardContent.tsx` does not appear to use BlackBox in the inspected call paths. This is an unnecessary permission unless product requirements explicitly require it. |
| F13 — credit/business logic inconsistencies | **Confirmed** | High when paired with ledger policy | BlackBox join spends credits but continues if spend fails (`useBlackBoxSession.ts L104–127`). Peer accept swallows spend failure and continues (`usePeerConnect.ts L403–416`). The call-site behavior is confirmed; business choice may be intentional, but must be explicit and tested. A more serious ledger policy issue is added as F14 below. |

## 4. New second-pass findings

### F14 — credit ledger self-insert policy is reintroduced

**Severity: Critical. Confirmed in repository migration sequence; live state requires verification.**

- `supabase/migrations/20260322071558_d2ed3d0c-64a8-4846-b9c5-b739249d68bc.sql L6–8` explicitly drops `System can insert credit transactions` as a security hardening measure to prevent users fabricating credits.
- Later, `supabase/migrations/20260322073805_fcbc87e4-64d5-4ecf-91d6-02b0b7c00b7f.sql L1–5` creates `Users can insert own credit transactions` with only `WITH CHECK (auth.uid() = user_id)`.
- `credit_transactions` has unconstrained `delta INTEGER` and enum `type`, with no positivity/cap/reference constraint in its table definition (`20260309044630_...sql L62–71`). No later migration was found that drops the reintroduced policy.
- Client code uses direct inserts for earning/spending (`src/hooks/useCredits.ts L38–72`, `src/hooks/useEccEarn.ts L30–47`, `src/hooks/useQuests.ts` around L90), which likely explains why the broad policy was restored.

**Impact:** a signed-in user may be able to insert an arbitrarily large positive `delta` and choose `grant`, `earn`, or another allowed `type` for their own `user_id`, increasing a balance computed by summing ledger deltas. This is not limited to LiveKit; it is a platform-wide ECC integrity issue.

**Remediation direction:** revoke direct user INSERT access to the ledger; move legitimate rewards, spending, refunds and admin grants behind narrowly scoped server functions/RPCs that derive the user ID from `auth.uid()`, validate allowed reward amounts/types, and use transaction-level idempotency. Before changes, inventory every legitimate client-side insert path so rewards do not silently break.

### F15 — refund endpoint has a time-of-check/time-of-use race and trusts a mutable assignment field

**Severity: High. Confirmed code; exploit chain likely given migration policies.**

`supabase/functions/refund-blackbox-session/index.ts` reads `refunded` at L49–75, inserts a `grant` at L97–115, and only afterwards updates the session to `refunded: true` at L117–126. These are separate calls and not a single transaction. Concurrent calls can both observe `refunded = false` and both insert grants. The session update result is not checked. If no spend transaction exists, it can still mark the row refunded with `refundAmount = 0`.

The function only checks `session.therapist_id !== user.id` at L63–68; it does not independently require the `therapist` role. Paired with the BlackBox student UPDATE policy (F3/F6), a student may be able to set `therapist_id` to their own ID and then call this endpoint for a paid session they never joined. This must be validated in a non-production staging clone, not by trying it against production.

**Remediation direction:** make the refund an atomic server-side transaction/RPC with a conditional state transition, a unique idempotency key/constraint for one refund per session, explicit caller role/assignment validation, and checked write results. Do not use a client-controlled mutable `therapist_id` as the sole authority.

### F16 — silence auto-end can call refund repeatedly and may report success when it failed

**Severity: Medium–High reliability/credit integrity. Confirmed source path.**

- `src/hooks/useSilenceDetection.ts L43–55`: once elapsed silence reaches `autoEndThresholdSec`, `onAutoEnd?.()` runs every interval tick (every second); no one-shot ref/guard is used.
- `src/components/videosdk/MeetingView.tsx L404–415`: `handleSilenceAutoEnd` awaits `supabase.functions.invoke`, but does not inspect the returned `error` field. Supabase function errors commonly resolve as `{ data, error }` rather than throwing, so the catch block alone is insufficient. It can show “Student has been refunded” and call leave/end logic even if refund failed.
- The repeated callback compounds F15's refund race.

**Remediation direction:** make auto-end a one-shot state transition; disable the timer immediately; inspect `{data,error}`; only show refund success after confirmed server response; make server refund idempotent regardless of client behavior.

### F17 — audio monitor can restart SpeechRecognition after component unmount

**Severity: Medium privacy/reliability. Confirmed risk from lifecycle implementation.**

`src/hooks/useAudioMonitor.ts L175–193` schedules untracked `setTimeout` callbacks from both `recognition.onerror` and `recognition.onend` to restart recognition. `stopListening` at L205–211 stops the current recognizer but does not disable `enabledRef` or cancel scheduled restart timeouts. The effect cleanup at L225–232 calls `stopListening` and clears the interval only; it does not clear recognition restart timers. On unmount, an `onend` callback may therefore schedule a later `recognition.start()` while the component no longer owns the session. Browser-specific behavior should be confirmed in tests, but the missing cancellation/disabled guard is visible in code.

**Remediation direction:** retain and clear restart timeout IDs; set a disposed/stopped ref before calling `stop()`; guard every callback against unmount and stale session ID; clear the transcript buffer when the session ends; add browser tests for unmount, disabled toggle, and route navigation.

### F18 — emergency escalation role fallback can cross session boundaries and return private contact data

**Severity: High privacy/authorization, subject to product policy. Confirmed source path.**

`supabase/functions/escalate-emergency/index.ts` uses a service-role client. In the appointment branch, a caller who is not the assigned `expert_id` is accepted if they have any `expert` role (`L96–104`). In the peer branch, a caller who is not the assigned `intern_id` is accepted if they have any `intern` role (`L120–128`). The function then loads `user_private` emergency contact fields (`L141–154`) and returns `contact`, `student_username`, and `student_eternia_id` to the caller (`L287–295`).

If cross-session escalation is not explicitly intended, any expert/intern with a session UUID can trigger an escalation for a session outside their assignment and receive the associated stored contact fields. Even if cross-session escalation is intended for emergencies, the endpoint should separate permission to escalate from permission to view private contact information and should audit that disclosure.

**Remediation direction:** validate active session state; enforce assigned participant or a narrowly defined authorized crisis-role policy; separately authorize emergency-contact disclosure; avoid returning private contact details by default; add rate limits and audit logs.

### F19 — `.env` is present in the archive but not ignored

**Severity: Low–High depending on the values in the original repository; requires deployment/repository verification.**

The supplied ZIP contains a `.env` file with Supabase URL/project/publishable-key variable names; values were not inspected or printed. `.gitignore` does not contain `.env`. This does not prove a secret was exposed, and Supabase publishable keys are designed for client use, but the ignore rule should be fixed and repository history checked for service-role keys or other secrets. If any real secret was committed, rotate it; removing the file from the latest commit alone does not remove it from history.

## 5. Workflow-specific second-pass conclusions

### 5.1 BlackBox

1. Student inserts a `queued` row through `useBlackBoxSession.ts L259–263`.
2. Therapist accepts by creating a provider room first, then conditional UPDATE to set `therapist_id`, `status='accepted'`, `room_id`, `started_at` (`TherapistDashboardContent.tsx L213–239`). A losing concurrent accept can leave an orphan room.
3. Student learns the room through realtime and polling (`useBlackBoxSession.ts L138–196`) and requests a generic token (`L75–102`).
4. Therapist uses the same row's room ID and gets a generic token (`TherapistDashboardContent.tsx L159–181`). Neither token request validates session assignment.
5. Both frontend provider configurations pass profile UUID and username (`BlackBox.tsx L185`; therapist L523–528). Thus the provider sees identifiable participant metadata even though the product language describes an anonymous space.
6. Student and therapist join timestamps are written, but inspected code does not transition status to `active` when both have joined. Status stays `accepted` unless another code path changes it.
7. Student cancellation/end and therapist end update the row directly from the client. Broad RLS lets clients modify more than the intended status/timestamp fields.
8. Credit charging is client-triggered after join and failure does not block the call (`useBlackBoxSession.ts L104–127`). Treat this as an explicit product policy decision; don't accidentally change it during the provider rewrite.

### 5.2 Peer Connect

- Student request creates `pending`; intern accept spends 18 ECC and then updates status to `active` (`usePeerConnect.ts L389–425`). Spend errors are swallowed at L404–409 and the session still activates.
- Call creation is lazy and initiated by either party. `startCall` creates a provider room before updating `peer_sessions.room_id` (`L628–680`). Concurrent callers can create duplicate rooms; the loser rereads the winning room, leaving its own room orphaned. The update error itself is not explicitly handled before the code falls back to `finalRoomId`.
- If `VideoCallModal` is opened with no `existingRoomId`, it silently creates a room not persisted to the session (`VideoCallModal.tsx L110–118`).
- `VideoCallModal` does not revalidate session status/participant membership at token time. A stale client can attempt to join after the session completes; provider behavior and existing room lifetime determine whether the join succeeds.
- Notification INSERT policy is permissive; a forged `peer_call` notification may prompt a fake incoming-call UI, though RLS on the actual session fetch may still prevent joining.

### 5.3 Appointments

- `VideoCallModal.startCall` reads `appointments.room_id`, then creates a room if absent and attempts to persist it with `.is('room_id', null)` (`VideoCallModal.tsx L65–107`). It ignores the update error and can fall back to a locally created room if persistence failed. Concurrent room creation can orphan a room.
- The client does not enforce appointment status at token request. Student UI shows Join for pending/confirmed appointments (`Appointments.tsx L103–106`); expert UI permits joining pending/confirmed appointments and the modal's token endpoint accepts any signed-in caller. A direct client invocation can bypass the UI's status filter because the endpoint does not check status.
- On leaving, the modal directly updates appointment status to `completed` (`VideoCallModal.tsx L138–156`), regardless of whether the other party has joined or whether a session actually occurred. Preserve/clarify this behavior before changing call lifecycle.
- Both audio and video appointment modes exist (`useAppointments.ts` data model and `VideoCallModal.tsx L58, L220–228`). Do not assume the whole product is audio-only.

### 5.4 Expert L3

- Expert panel loads flagged sessions and opens the room before claiming (`ExpertL3AlertPanel.tsx L114–141`). Claim occurs only in the join-success callback.
- `claim-l3-session` requires an expert role (`L47–59`) and checks status/flag level (`L61–75`), but the claim update does not include a condition that the claim history is still empty (`L111–119`). Two experts can both pass the initial read and join the same room; final history can overwrite one claim.
- A LiveKit token endpoint must not issue the L3 token until the caller is an expert and the session is currently eligible and either unclaimed or claimed by that same expert, according to the final intended policy. The claim operation should be atomic and should precede token issuance/join.

## 6. RLS / migration analysis

### Confirmed policy-history concerns

- `appointments`: student insert checks only `student_id` ownership (`20260309044708_...sql L15–17`); UPDATE allows either student or expert (`L19–21`) without column restrictions. Students can supply `expert_id` on INSERT unless another constraint/trigger prevents it; the token endpoint still does not independently check appointment membership.
- `peer_sessions`: UPDATE policy permits either participant (`20260309044708_...sql L31–33`) with no column restrictions; the later insert policy checks student identity/role (`20260323181805_...sql L24–32`) but does not constrain `intern_id` to a valid/eligible intern in the policy itself.
- `blackbox_sessions`: student INSERT checks only `student_id` (`20260311182702_...sql L21–23`), and student UPDATE checks only `student_id` (`L47–49`). Staff SELECT/UPDATE predicates from `20260326175650_...sql` include all queued/escalated sessions and active/accepted sessions with `flag_level >= 3`, and interns receive similar permissions (`L60–84`). These are broad data/column permissions.
- `notifications`: the authenticated INSERT policy uses `WITH CHECK (true)` in migration `20260323165234_...sql` (exact line range in the original audit §7); it permits notification spoofing.
- `credit_transactions`: the later self-insert policy is F14 and is the most urgent ledger issue.
- `room_id` has no uniqueness constraint and no DB constraint tying session status to room presence, based on the migrations in the first audit. Client-side `.is('room_id', null)` guards are not a substitute for transactional ownership and idempotency.

### Live production verification required

Do not infer live RLS from repository migrations. Run a read-only policy inspection against the actual Supabase project, preferably with a database owner/read-only admin connection. This SQL is safe to run as a read-only query:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'appointments', 'peer_sessions', 'blackbox_sessions',
    'notifications', 'credit_transactions', 'escalation_requests'
  )
ORDER BY tablename, cmd, policyname;
```

Also verify whether migrations after `20260322073805` changed the credit policy, and inspect grants separately. Do not paste secret values into a chat or audit report.

## 7. VideoSDK dependency inventory and LiveKit mapping

| Current file / area | Current responsibility | LiveKit migration direction |
|---|---|---|
| `package.json` and `package-lock.json`, `bun.lock`, `bun.lockb` | VideoSDK dependency | Add LiveKit dependencies with one chosen package-manager workflow; reconcile lockfiles deliberately. Remove VideoSDK only after all call sites are migrated and verified. |
| `supabase/functions/videosdk-token/index.ts` | Auth + provider JWT + room creation | Replace with a server-side LiveKit token endpoint that authenticates Supabase user and authorizes `{kind, id}` against the database. Never accept arbitrary room/identity/role as authority. |
| `src/lib/videosdk.ts` | Token helper, create-room helper, auth retry/error mapping | Replace with provider-neutral helper, e.g. `src/lib/realtimeMedia.ts`, that requests a token for a typed session kind and ID. Keep existing auth-refresh/error behavior where correct. |
| `src/components/videosdk/VideoCallModal.tsx` | Appointment and Peer Connect call shell; currently also creates rooms | Replace provider wrapper and lifecycle while preserving modal, mode, close, appointment status and error handling after their semantics are clarified. Do not retain client-side room creation. |
| `src/components/videosdk/MeetingView.tsx` | Join/leave, participant collection, device controls, monitoring and silence detection | Rewrite provider-dependent APIs; preserve application-level call states, audio-only mode, monitoring callbacks and lifecycle tests. Review current auto-end and cleanup defects before porting. |
| `src/components/videosdk/ParticipantView.tsx` | VideoSDK participant track rendering, audio stream routing and volume boost | Rewrite track attachment/rendering using LiveKit track references. Preserve audio output selection/volume boost only if tested and supported. This is a nontrivial rewrite, not a simple import replacement. |
| `src/components/videosdk/MeetingControls.tsx` | Mic/camera/leave and output device controls | Adapt to LiveKit local participant publish/mute APIs and room disconnect. Test audio-only and video appointments separately. |
| `src/hooks/useBlackBoxSession.ts` + `BlackBox.tsx` + `MobileBlackBox.tsx` | Student queue, token fetch, realtime/polling, join callbacks | Preserve queue behavior; replace token contract with `{kind:'blackbox', id: sessionId}`; ensure same pseudonymous room and server-side membership checks. |
| `src/components/therapist/TherapistDashboardContent.tsx` | Therapist accept/reconnect/call UI | Remove pre-claim room creation; claim session atomically first, then request authorized token. Keep therapist and student in the same canonical room name. |
| `src/hooks/usePeerConnect.ts` + desktop/mobile PeerConnect | Peer chat, session lifecycle, room ID, notification | Preserve Supabase chat and notifications; make room name deterministic from peer session ID and token authorization server-side. Remove create-room race and guard completed sessions. |
| `src/pages/dashboard/Appointments.tsx`, `MobileAppointments.tsx`, `ExpertDashboardContent.tsx`, `MobileExpertDashboard.tsx` | Appointment call entry points | Pass appointment ID and caller context only as a requested resource; server independently verifies student/expert membership and allowed status. Maintain audio/video mode. |
| `src/components/expert/ExpertL3AlertPanel.tsx`, `claim-l3-session` | L3 join and claim | Fix claim atomicity first; claim must precede token issuance/join. Scope token to L3 room and role. |
| `src/hooks/useAudioMonitor.ts`, `useSilenceDetection.ts`, `TherapistSessionControls.tsx` | Browser speech recognition, AI classification, silence warning/auto-end | These do not directly import VideoSDK; likely keep provider-neutral but fix lifecycle/authorization/refund issues. Re-test their assumptions about local vs remote audio and device behavior. |
| `supabase/functions/ai-transcribe`, `refund-blackbox-session`, `escalate-emergency` | AI risk, refund and escalation side effects | Not provider-specific; harden authorization/idempotency before migration. Do not rewrite them merely because LiveKit is introduced. |
| `src/components/admin/SessionsLogViewer.tsx` | Displays stored room IDs | Check if displaying room names remains useful; do not treat a room name as an access credential. |

Repository search found VideoSDK imports/calls in the files listed above plus `README.md`, `.lovable/memory/index.md`, `supabase/config.toml`, and `package.json`. Peer chat itself uses Supabase `peer_messages`, not VideoSDK data channels. No evidence was found that chat depends on VideoSDK messaging.

## 8. LiveKit API verification

The following API-level statements were checked against official LiveKit documentation on 2026-10-13:

- LiveKit access tokens can carry a room name, participant identity, and video grants/permissions. The official token documentation describes room-scoped `roomJoin` grants and optional publishing/subscribing permissions: https://docs.livekit.io/home/server/generating-tokens/ and https://docs.livekit.io/frontends/reference/tokens-grants/.
- The official JS server SDK documentation currently describes `livekit-server-sdk`, `AccessToken`, `addGrant({ roomJoin: true, room: roomName })`, and asynchronous `await at.toJwt()`. It states rooms are automatically created when the first client joins if the room does not exist: https://docs.livekit.io/reference/server-sdk-js/.
- The official JavaScript client docs describe the `Room` object, `connect(url, token)` and `disconnect()`: https://docs.livekit.io/reference/client-sdk-js/.
- The React components docs describe `LiveKitRoom` and a room context for child components: https://docs.livekit.io/reference/components/react/component/livekitroom/ and https://docs.livekit.io/reference/components/react/concepts/livekit-room-component/.

These docs establish the conceptual APIs, not compatibility with the exact Supabase Edge runtime or selected package versions in this repository. Before implementation, validate the chosen `livekit-server-sdk` import/version against the project's Deno Edge Function runtime, pin package versions, and compile a minimal staging token function. Do not expose `LIVEKIT_API_SECRET` to the browser.

## 9. Recommended authorization contract for new token endpoint

Use a strict request schema such as `{ kind: 'appointment' | 'peer' | 'blackbox' | 'l3', id: UUID }`. Treat `kind` and `id` as a resource selector, not proof of access. Derive caller identity from validated Supabase auth and query authoritative records server-side.

| Kind | Required authorization before token | Allowed status guidance | Token identity / grants |
|---|---|---|---|
| Appointment | Caller must be exactly `student_id` or assigned `expert_id`; if expert role is required, verify it from `user_roles`, not profile UI. Verify no cancellation/completion and decide allowed time window. | `pending`/`confirmed` only if product intentionally allows pre-confirmation joins; otherwise `confirmed` only. Reject `completed`/`cancelled`. | Pseudonymous stable identity derived server-side; room name derived from appointment UUID; audio publish/subscribe; video publishing only when `session_type='video'`. |
| Peer Connect | Caller must be exactly `student_id` or `intern_id`; verify intern role for intern side and current session assignment. | `active` only. Reject `pending`, `completed`, `flagged` unless an explicit policy says otherwise. | Stable pseudonymous identity derived server-side; deterministic room name from peer session UUID; audio publish/subscribe; video grant off if feature is audio-only. |
| BlackBox student/therapist | Student must equal `student_id`; therapist must equal `therapist_id` and have `therapist` role. Reject unassigned therapist. If experts may join, require L3 flag and exact claim/eligibility rule. | `accepted`/`active` for assigned participants; do not issue to queued/completed/cancelled. Explicitly define whether `escalated` remains joinable. | Pseudonymous participant identity; room name derived from BlackBox session UUID; audio grants only unless product explicitly needs video. Do not include username/student UUID in provider display metadata. |
| Expert L3 | Caller must have `expert` role, session must be L3 eligible, and claim must be atomic and already owned by caller or be claimed in the same server-side transaction before token issue. | Only active/accepted/escalated states explicitly approved by policy; reject completed/cancelled. | Pseudonymous expert identity; room name derived from the same BlackBox session UUID; minimal audio/video grants as required. |

Do not trust `room_id`, `participantId`, `name`, `role`, or requested grants from the client. If the endpoint accepts a room name from the client at all, it must compare it to a server-derived canonical name and reject mismatches. Prefer storing a deterministic name such as `bb_<session-uuid>`, `peer_<session-uuid>`, or `apt_<appointment-uuid>` in the existing text field only if there is a clear compatibility plan for in-flight VideoSDK IDs. A LiveKit room name and LiveKit room SID are different concepts; use the room name for joins and store provider SID only if needed for administration/cleanup.

## 10. Safe migration order

1. **Baseline and containment:** capture existing call behavior in staging; inspect live RLS and credit ledger policies; ensure secrets are not committed. Do not change provider yet.
2. **Fix critical platform security:** remove broad direct credit ledger INSERT; move legitimate credit flows to server/RPC paths; restrict session table updates to intended fields/transitions; harden `ai-transcribe`, `refund-blackbox-session`, and `escalate-emergency` authorization; make refunds idempotent; make L3 claim atomic.
3. **Add regression tests:** role/session authorization matrix, duplicate-refund concurrency test, credit-ledger tampering test, and lifecycle cleanup tests. Verify with test accounts for student, assigned therapist, unassigned therapist, intern, expert, and admin.
4. **Implement new LiveKit Edge Function alongside VideoSDK:** validate Supabase caller, query session/appointment, enforce status/membership, derive room and pseudonymous identity, create least-privilege grants, return only token + LiveKit server URL and safe metadata. Keep secrets server-side.
5. **Add provider-neutral client helper:** keep existing VideoSDK helper while LiveKit helper is introduced; avoid changing all call sites in one step.
6. **Migrate one workflow at a time in staging:** appointments first (audio and video), Peer Connect second, BlackBox student + therapist third, L3 last after claim hardening. Maintain desktop/mobile parity at each step.
7. **Rewrite media components:** adapt MeetingView, ParticipantView, MeetingControls to LiveKit tracks/events. Preserve mic permission, audio output routing, volume boost, AI monitor callbacks, silence detection and leave behavior only after explicit tests.
8. **Handle legacy room IDs and cutover:** decide how to drain or mark existing VideoSDK sessions; avoid mixed provider room IDs being interpreted by the wrong SDK. Stop accepting new VideoSDK calls only after all clients are deployed and staging is green.
9. **Verify, then remove old provider:** grep for all VideoSDK imports/API calls, run typecheck/build/tests, test mobile and desktop, then remove old endpoint/config/dependency and update README/memory docs. Regenerate lockfiles only under the project's chosen package-manager workflow.
10. **Rollback:** retain old function/dependency until cutover passes; use an explicit provider flag or controlled release switch, but do not let the client choose a provider or bypass authorization. Rollback must not issue tokens for rooms created by the other provider.

## 11. Required regression/security test matrix

| Test | Setup / action | Expected result |
|---|---|---|
| Unauthenticated token | Call new endpoint with no/invalid Supabase token | 401; no provider token/room created |
| Unrelated student | Student A requests Student B's appointment/session UUID | 403/404; no token issued |
| Wrong expert | Expert not assigned to appointment requests token | Denied |
| Wrong therapist | Therapist not assigned to BlackBox session requests token | Denied unless explicit L3 policy allows and claim is owned |
| Intern on BlackBox | Intern requests BlackBox token | Denied unless explicit product rule authorizes that role |
| L3 pre-claim | Expert attempts token/join before claim succeeds | Denied; no media connection |
| Forged room ID | Caller submits another room name | Server ignores/rejects; canonical room only |
| Forged identity/name | Caller submits arbitrary `participantId`/display name | Server derives pseudonymous identity; client values ignored |
| Terminal session | Request token for completed/cancelled appointment/session | Denied |
| Appointment mode | Audio appointment requests token | No video publish permission; audio works |
| Video appointment | Confirmed video appointment | Audio/video works only for the two authorized participants |
| Concurrent BlackBox claim | Two therapists accept same queued session simultaneously | Exactly one assignment succeeds; loser gets no token and no room side effect |
| Concurrent L3 claim | Two experts claim same L3 session | Exactly one claim wins before either joins; no history overwrite |
| Concurrent peer room initialization | Two parties start a call simultaneously | Both receive same canonical room; no duplicate provider rooms created |
| DB persist failure | Simulate failed room/session write | No client joins an unpersisted room; clean failure and safe retry |
| Refund double-submit | Send two concurrent refund requests | Exactly one grant transaction and one terminal state |
| Student changes therapist ID | In staging, attempt to mutate `therapist_id`, `status`, `room_id`, `flag_level` | Database denies sensitive column changes; audit event recorded if appropriate |
| Credit ledger tampering | Student attempts direct INSERT with huge positive `delta`/`grant` | Denied by RLS; legitimate rewards still work through approved server path |
| AI transcript cross-session | User sends transcript with another user's session ID | Denied before service-role writes, escalation or notification |
| AI transcript abuse | Oversized transcript or repeated calls | Input capped; rate-limited; no uncontrolled AI spend |
| Emergency cross-session | Unassigned intern/expert submits another session ID | Denied unless specific documented crisis policy; private contact not returned by default |
| Speech recognition unmount | Start monitoring then navigate away/disable hook | Recognition stops; no timer restarts; no later transcript posts |
| Silence auto-end | Trigger 5-minute threshold | One refund request only; success UI only if server confirms success |
| Reconnect | Drop network and reconnect for each call type | Fresh authorized token; terminal/assignment changes deny reconnect |
| Mobile/desktop parity | Student on mobile and staff on desktop join same session | Same canonical room; correct role/permissions and status behavior |
| Provider disconnect | Leave, pagehide, close modal, unmount | No duplicate completion/refund; media tracks and listeners cleaned up |
| Realtime privacy | Subscribe as unrelated user to session/notification channels | No unauthorized student/session metadata delivered |

These tests are **proposed, not executed**. Run destructive/security tests only in a staging project with synthetic accounts and data.

## 12. Outstanding questions requiring live access or product decisions

1. What are the actual deployed `pg_policies` and grants for session and credit tables? Have dashboard changes or untracked migrations altered the repository's policy history?
2. Is `20260322073805` applied to production, and is `Users can insert own credit transactions` currently active? This is the most urgent live check.
3. Is signup publicly open, and are there anti-abuse controls around account creation and AI endpoint usage?
4. Does product policy intentionally allow any expert to view/claim all queued BlackBox sessions, any intern to see queued sessions, or any expert/intern to escalate a session they are not assigned to?
5. What is the intended anonymity boundary: anonymous only to other students, or also to therapists and the media provider? Should therapists ever see student username/UUID in the queue?
6. Should appointment calls be permitted while `pending`, or only `confirmed`? When should a call change appointment status to `completed`—on either participant leaving, both leaving, or an explicit end action?
7. Should BlackBox status become `active` only when both participants have joined, and how should one participant's disconnect affect the other?
8. What should happen if the student's credits cannot be deducted at call join? Current code allows the call to continue.
9. Is the emergency contact data truly encrypted at rest, or are columns named `*_encrypted` being used as plaintext? Who is authorized to see those fields?
10. Which package manager is authoritative for CI/Vercel and developer machines: npm or Bun? Why are `package-lock.json`, `bun.lock`, and `bun.lockb` all present?
11. Which LiveKit deployment/plan and URL will be used, and does the Supabase Edge runtime support the selected server SDK version without bundling/runtime issues?
12. Are existing active VideoSDK calls allowed to finish during cutover? Define a legacy drain window before changing room semantics.

## 13. Final go/no-go assessment

**NO-GO for direct implementation/cutover today. GO for a staged migration after the following prerequisites are resolved.**

### Confirmed issues to fix before migration

- Room-unscoped, non-session-authorized VideoSDK token issuance (F1).
- Client-supplied participant identities and BlackBox identity leakage (F2/F7).
- Broad UPDATE policies on appointment, peer, and BlackBox tables (F3/F6).
- `ai-transcribe` service-role writes without session membership authorization (F4).
- Non-atomic L3 claim and joining before claim success (F5).
- Broad notification INSERT policy and potential fake peer-call notifications (F9).
- No token/AI-transcribe rate limit; wildcard CORS (F10; CORS can remain wildcard only if deliberately accepted, but authentication and abuse controls still need hardening).
- BlackBox state/reconnect handling gaps (F11).
- Intern BlackBox read/update permissions unless required (F12).
- Self-insert credit ledger policy reintroduced after a security hardening migration (F14).
- Refund race, mutable-assignment trust, and unchecked update result (F15).
- Repeated silence auto-end callback and false-positive refund success UI (F16).
- SpeechRecognition restart timeout cleanup risk (F17).
- Emergency escalation fallback may allow cross-session private-contact retrieval (F18).
- `.env` ignore/repository-history hygiene (F19).

### Migration prerequisites

1. Verify live RLS/grants and fix credit-ledger policy first.
2. Implement atomic, idempotent credit/refund operations without direct client ledger writes.
3. Harden all session UPDATE/INSERT paths and add server-side token authorization by workflow.
4. Make L3 claim atomic and perform claim before token issuance/join.
5. Define explicit session-status rules, identity/anonymity boundaries, and appointment audio/video grants.
6. Fix and test AI transcript, emergency escalation, and monitoring cleanup behavior.
7. Establish test accounts, staging environment, baseline call tests, and rollback plan.
8. Validate LiveKit SDK/runtime versions in a minimal staging Edge Function.

### Items that cannot be verified from the repository alone

- Actual production RLS policies, grants, applied migration state, and dashboard overrides.
- Whether provider-side VideoSDK token behavior allows a room-less token to join arbitrary rooms.
- Production secret exposure/history and whether any credentials need rotation.
- Real browser-specific SpeechRecognition behavior after unmount and device-specific LiveKit media behavior.
- Production usage patterns, actual credit balances/transactions, and whether the suspected refund/credit exploit paths are currently exploitable in the deployed database.

**Recommended next step:** perform the read-only production policy check and fix the credit-ledger/session authorization defects in a staging branch before writing the LiveKit migration. Do not start by replacing React SDK imports; that would leave the most important security failures intact.
