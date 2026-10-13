# ETERNIA — VideoSDK → LiveKit Pre-Migration Authorization & Architecture Audit

Static, read-only audit of `Eternia_web-main.zip`. No project file was modified, no dependency installed, no network call made against the project or Supabase. The only outside requests were two reads of public LiveKit documentation pages.

Path convention: all paths are relative to `Eternia_web-main/`. `L<n>` means line number in that file. `MIG:<timestamp>` means `supabase/migrations/<timestamp>_*.sql`.

Labels: **VERIFIED** (directly seen in code/SQL), **INFERRED** (strongly suggested, not conclusive), **UNKNOWN** (cannot be established from the ZIP).

---

## 1. Executive summary

1. **The token endpoint authenticates but does not authorize.** `supabase/functions/videosdk-token/index.ts` verifies that the caller has a valid Supabase user (L52–65), then signs a VideoSDK JWT with `permissions: ["allow_join","allow_mod"]` and a 2-hour lifetime (L84–91). The request body is only `{action}` (L26, `lib/videosdk.ts` L56–58). It never receives, reads or checks a session ID, appointment ID, room ID, role, or relationship. The same token is returned for every caller, for every workflow. **VERIFIED, high confidence.**
2. **Room scoping is absent from the token.** The JWT payload contains only `apikey`, `permissions`, `iat`, `exp` (L85–90). No room or participant claim is bound. Any authenticated user can also mint new rooms on demand (`create-room`, L112–150). Whether VideoSDK lets a token with no room claim join any room is provider behavior I did not verify (**UNKNOWN**); the code gives no server-side restriction.
3. **Real access control is only "can this client read `room_id` through RLS".** For BlackBox, Peer Connect and appointments, the room ID is stored in a table row; the client reads it and asks for a generic token. Protection therefore rests on (a) room IDs being unguessable and (b) RLS SELECT policies. **VERIFIED** for the code path; exploitability depends on VideoSDK behavior (**UNKNOWN**).
4. **RLS UPDATE policies on all three session tables have no `WITH CHECK` and no column restriction.** A participant can rewrite `room_id`, `status`, and (for peer/appointments) the counter-party column on their own row. **VERIFIED** (policy text); impact **INFERRED**.
5. **The three workflows do not share one design.** Appointments: room created by whoever opens the call first, persisted with a client-side `IS NULL` guard. Peer Connect: room created lazily on "start call" by whichever participant clicks first. BlackBox: room created by the therapist *before* the DB claim, persisted in the same `UPDATE` that claims the session. All three create the VideoSDK room from the browser through the same edge function.
6. **Migration opportunity:** with LiveKit, rooms can be created on first join (LiveKit docs, see §10), so the three `create-room` call sites and their orphan-room failure modes disappear. The `room_id` text columns can keep working as the room *name*. The token function must become a real authorization point; that is the single most important change.
7. **Anonymity in BlackBox is UI-level only.** The real user UUID is passed as `participantId` and the username as display name (`pages/dashboard/BlackBox.tsx` L185), and therapists see `student_username` and `student_id` (`TherapistDashboardContent.tsx` L107, L436; RLS grants therapists SELECT on queued rows). **VERIFIED.** The LiveKit identity should be pseudonymous.

**Confirmed vulnerabilities (static):** F1, F2, F3, F4, F5. **Potential risks:** F6–F12. See §9.

**Coverage statement:** I read in full every file on the VideoSDK/token/session paths (§2) and the policy-bearing migrations. I did **not** read all 326 files line by line; the rest were covered by repository-wide grep (§2.2). Live Supabase state (applied migrations, dashboard-edited policies, secrets) is **UNKNOWN** (§13).

---

## 2. Verified architecture and source-file inventory

### 2.1 Stack (VERIFIED)
- `package.json` L51: `"@videosdk.live/react-sdk": "^0.7.0"`. No LiveKit package present. Lockfiles present: `package-lock.json`, `bun.lock`, `bun.lockb` (not inspected beyond existence; two lockfile systems is itself a migration hazard).
- React + Vite + Supabase JS; Supabase Edge Functions (Deno) in `supabase/functions/` (30 directories incl. `_shared`).
- `supabase/config.toml` L18–19: `[functions.videosdk-token] verify_jwt = false`. Authentication is therefore **only** the in-code check at `videosdk-token/index.ts` L44–65.
- Server secrets read via `Deno.env`: `VIDEOSDK_API_KEY`, `VIDEOSDK_API_SECRET` (L71–72). Not present in the ZIP (names only checked).
- `.env` in ZIP contains 5 variable *names* (Supabase URL / publishable key / project id variants). Values not inspected. `.gitignore` has no `.env` entry (grep returned nothing) — **VERIFIED**.
- `vercel.json`: SPA rewrite + headers. CSP `connect-src 'self' https: wss:` and `Permissions-Policy: camera=(self), microphone=(self)` — compatible with a LiveKit WebSocket/WebRTC endpoint without CSP change (**INFERRED**; WebRTC media itself is not governed by `connect-src`).
- Tests: only `src/test/example.test.ts` and `src/test/setup.ts`. Zero VideoSDK/session tests (**VERIFIED**).

### 2.2 Files referencing VideoSDK (grep, case-insensitive, whole project)
Source: `src/components/videosdk/{MeetingView,ParticipantView,VideoCallModal,MeetingControls}.tsx`, `src/components/therapist/TherapistDashboardContent.tsx`, `src/components/mobile/{MobileBlackBox,MobileAppointments,MobilePeerConnect,MobileExpertDashboard}.tsx`, `src/components/expert/{ExpertL3AlertPanel,ExpertDashboardContent}.tsx`, `src/hooks/{useBlackBoxSession,usePeerConnect}.ts`, `src/lib/videosdk.ts`, `src/pages/dashboard/{BlackBox,Appointments,PeerConnect}.tsx`, `supabase/functions/videosdk-token/index.ts`, `supabase/config.toml`, `package.json`, `README.md`, `.lovable/memory/index.md` (L36: "Strictly audio-only (audioOnly prop throughout VideoSDK tree)" — note it conflicts with appointment video mode; see §6).

Other readers of `room_id`: `src/components/admin/SessionsLogViewer.tsx` L123, L142, L158 (admin log display only).

### 2.3 Inspection ledger

| Status | Files |
|---|---|
| **Read in full / in relevant ranges** | `supabase/functions/videosdk-token/index.ts`; `src/lib/videosdk.ts`; `src/hooks/useBlackBoxSession.ts`; `src/pages/dashboard/BlackBox.tsx`; `src/components/videosdk/VideoCallModal.tsx`; `MeetingView.tsx` L1–12, L186–300, L370–420 (+grep of whole file); `TherapistDashboardContent.tsx` L100–620; `usePeerConnect.ts` L180–215, L322–470, L600–727 (+grep); `PeerConnect.tsx` L440–500, L755–781 (+grep); `ExpertL3AlertPanel.tsx` L45–175, L305–335; `claim-l3-session/index.ts`; `refund-blackbox-session/index.ts`; `escalate-emergency/index.ts` L55–95; `ai-transcribe/index.ts` L1–100, L215–240; `_shared/security.ts` L1–40; `vercel.json`; `supabase/config.toml` L1–61 |
| **Read in full (SQL)** | MIG:20260309044708, 20260311182702, 20260311202107, 20260311193547, 20260322060057, 20260322182833, 20260322184923, 20260323165234, 20260323181805, 20260326175650, 20260309101549; relevant ranges of MIG:20260309044630, 20260326085707 |
| **Grep-level only** | `MobileBlackBox.tsx`, `MobilePeerConnect.tsx`, `MobileAppointments.tsx`, `MobileExpertDashboard.tsx`, `ExpertDashboardContent.tsx`, `Appointments.tsx` (L26, L36, L103, L182), `ParticipantView.tsx`, `MeetingControls.tsx`, `useAudioMonitor.ts`, `useSilenceDetection.ts`, `TherapistSessionControls.tsx`, `SessionsLogViewer.tsx`, `InternDashboardContent.tsx`, remaining ~50 migration files (searched for the three session tables, policies, triggers, grants, enum changes), `combined.sql` (1,937 lines; searched only) |
| **Not inspected** | The remainder of `src/` (UI components, pages, contexts) with no VideoSDK/session reference; `public/`; `src/integrations/supabase/types.ts` (used only as a pointer — not as evidence of policies); other Edge Functions' bodies (credits, SPOC, admin, etc.) |

`combined.sql` appears to be a concatenation of earlier migrations; I did not diff it against the timestamped files (**UNKNOWN** whether it is authoritative or stale).

---

## 3. Token authorization matrix (all workflows)

All workflows converge on one function. Differences are only in *what the client does before calling it*.

| Workflow | Initiating file | Requesting function | Backend endpoint | Authentication check | Session authorization check | Token permissions | Result |
|---|---|---|---|---|---|---|---|
| **A. Appointments (student)** | `pages/dashboard/Appointments.tsx` L36 (`handleJoinCall`), L182; mobile: `MobileAppointments.tsx` L195 | `VideoCallModal.startCall` L60–129 → `getVideoSDKToken` L73 / `createVideoSDKRoom` L79 | `videosdk-token` (`get-token` / `create-room`) | Bearer JWT → `supabase.auth.getUser` (index.ts L39–65) | **None server-side.** Client reads `appointments.room_id` via RLS (L66–70) | `allow_join, allow_mod`, 7200 s, no room/participant claim (L84–91) | Token for any caller |
| **A'. Appointments (expert)** | `ExpertDashboardContent.tsx` L403, L580, L906; `MobileExpertDashboard.tsx` L434 | same | same | same | None server-side | same | same |
| **B. Peer Connect** | `PeerConnect.tsx` L469–481, L758–775; `MobilePeerConnect.tsx` L508–514 | `usePeerConnect.startCall` L629–687 (`createVideoSDKRoom` L638) then `VideoCallModal` with `existingRoomId` (→ `getVideoSDKToken` L111) | same | same | None server-side; `startCall` only checks `session.status === "active"` in client state (L633) | same | same |
| **C. BlackBox student** | `pages/dashboard/BlackBox.tsx` L220 (`requestSession`) → auto-connect `useBlackBoxSession` L156–160 → `fetchToken` L76–102 (`getVideoSDKToken` L83) | `fetchToken` | same | same | None server-side; client waits for `room_id` + status `accepted/active` from its own row | same | same |
| **D. BlackBox therapist** | `TherapistDashboardContent.tsx` L452–455 (`acceptSession` L213–245; `createVideoSDKRoom` L217); reconnect L159–184 (`getVideoSDKToken` L175) | `acceptSession`, `checkActive` | same | same | None server-side. Role/ownership enforced only by RLS on the later `UPDATE` (L220–231) | same | same |
| **D'. BlackBox expert (L3)** | `ExpertL3AlertPanel.tsx` L114–132 → `VideoCallModal` `existingRoomId` L323, `autoStart` L330 | `VideoCallModal.startCall` L110–113 | same | same | None at token time; `claim-l3-session` runs **after** join (L135–141) | same | same |
| **E. Other direct token callers** | None found | — | — | — | — | — | grep shows the only callers of `getVideoSDKToken`/`createVideoSDKRoom` are `VideoCallModal`, `useBlackBoxSession`, `TherapistDashboardContent`, `usePeerConnect` |

### Specific questions

| Question | Answer | Label / confidence | Evidence |
|---|---|---|---|
| Can any authenticated user request a token for an arbitrary room? | The endpoint does not accept a room, so it issues the same room-less token to everyone. Whether that token can join *an arbitrary* room is determined by VideoSDK (the JWT has no room claim). | VERIFIED (no server check) / UNKNOWN (provider semantics). High / n.a. | `videosdk-token/index.ts` L26, L44–65, L84–91 |
| Can a student request a token for another student's session? | Yes at the token layer (no session binding). Discovering another student's `room_id` is blocked by RLS: students have only own-row SELECT on `blackbox_sessions` (MIG:20260311182702 L26–28), `peer_sessions` (MIG:20260309044708 L24–26), `appointments` (L11–13). | VERIFIED. High. | same |
| Can a therapist/expert get a token without being assigned? | Yes. No role or assignment is checked at token time. Any signed-in account, including a plain student, can call it. | VERIFIED. High. | L44–110 |
| Can the client control room ID, participant identity, permission level? | Room ID: client chooses which room to join (`existingRoomId`/DB value) and the server never sees it. Participant identity and display name: client-chosen in `MeetingProvider.config` (`BlackBox.tsx` L185, `TherapistDashboardContent.tsx` L523–527, `Appointments.tsx` L182). Permissions: fixed server-side, but fixed to the broadest set (`allow_mod`). | VERIFIED. High. | cited |
| Is creating a room distinguished from joining one? | Only by `action`. Both return the same JWT; `create-room` additionally calls `POST https://api.videosdk.live/v2/rooms` with an empty body. Any authenticated user may create. | VERIFIED. High. | L106–150 |
| Are permissions limited per workflow? | No. One permission set for all. `allow_mod` is not used by any inspected client code (no moderator calls found in `MeetingView`/`MeetingControls` grep). | VERIFIED. High (usage: Medium — grep-level for Controls). | L87 |
| Server-enforced or UI-enforced? | UI + RLS visibility. The server enforces only "is a logged-in user". | VERIFIED. High. | §3 table |

Failure handling at token time: 401 `SESSION_INVALID` on missing/malformed/invalid JWT (L44–65); 500 `VIDEOSDK_CONFIG_MISSING` (L74–79); 502 on upstream failure (L126–145); client parses and does one refresh-and-retry on auth-looking errors (`lib/videosdk.ts` L73–92).

---

## 4. BlackBox student → therapist sequence (actual code)

```mermaid
sequenceDiagram
    autonumber
    participant S as Student UI (BlackBox.tsx / useBlackBoxSession)
    participant DB as Supabase DB (blackbox_sessions + realtime)
    participant T as Therapist UI (TherapistDashboardContent)
    participant EF as Edge fn videosdk-token
    participant V as VideoSDK

    S->>DB: SELECT existing open session (hook L199-214, L221-227)
    S->>DB: rpc get_blackbox_daily_count / usage_count / get_credit_balance (L236-255)
    S->>DB: INSERT {student_id, status:'queued'} (L259-262)
    Note over DB: unique idx: one open session per student (MIG:20260322182833 L8-10)
    DB-->>T: realtime '*' on blackbox_sessions -> fetchQueue (L115-125)
    T->>EF: create-room (acceptSession L217)
    EF->>V: POST /v2/rooms
    V-->>EF: roomId
    EF-->>T: {token, roomId}
    T->>DB: UPDATE SET therapist_id, status='accepted', room_id, started_at WHERE id AND status='queued' (L220-231)
    Note over DB: RLS: any therapist/expert/intern may UPDATE queued rows (MIG:20260326175650 L46-56 etc.)
    DB-->>S: realtime UPDATE payload -> setActiveSession (hook L144-150) (+3s polling L183-196)
    S->>S: callState 'ready' (hook L67-70) -> fetchToken (L156-160)
    S->>EF: get-token (L83)
    EF-->>S: {token}
    S->>V: MeetingProvider(meetingId=room_id, participantId=profile.id, name=username) -> MeetingView autoJoin (BlackBox.tsx L177-198)
    T->>V: MeetingProvider(meetingId=room_id) autoJoin (L521-562)
    V-->>S: onMeetingJoined -> onCallJoined -> spendCredits, UPDATE student_joined_at (hook L104-127)
    V-->>T: onJoined -> UPDATE therapist_joined_at (L542-546)
    Note over DB: status stays 'accepted'; no code sets 'active' on both-joined
    S->>DB: endSession -> status='completed' (hook L326-335)  /  cancelSession -> 'cancelled' (L278-286)
    T->>DB: endSession -> status='completed' + notes (L248-257)
```

Answers to Part 3 stages (each with label):

| # | Stage | Finding | Label |
|---|---|---|---|
| 1–3 | Student initiates; creates session row | `requestSession` inserts a `queued` row; reuses an existing open session if one exists (hook L221–233); DB unique index prevents duplicates (MIG:20260322182833 L8–10) | VERIFIED |
| 4 | Therapist notified | Realtime `event:"*"` on whole `blackbox_sessions` triggers `fetchQueue` (L115–125). No push/notification row for queued sessions found. Whether realtime delivers depends on RLS + publication (publication added MIG:20260311182702 L52) | VERIFIED / delivery INFERRED |
| 5 | Therapist claims | Single conditional UPDATE `.eq("status","queued")` (L228–229) — atomic at DB level; losers get error → toast (L233–241). Also unique index one active session per therapist (MIG:20260322184923 L7–9) | VERIFIED |
| 6–7 | Room created and persisted | VideoSDK room created **before** the claim (L217 vs L220–231); persisted in the same UPDATE (`room_id: roomId`, L225) | VERIFIED |
| 8 | Student receives room ID | Realtime UPDATE (hook L144–150) + 3 s polling fallback (L183–196) + on-mount check (L199–214) | VERIFIED |
| 9 | Therapist receives room ID | From the response of its own UPDATE (L230–237); on reload via `checkActive` (L160–181) | VERIFIED |
| 10 | Tokens | Each side independently calls `get-token` (student hook L83; therapist L217 `create-room` response or L175 on reload) | VERIFIED |
| 11 | Same room identifier | Yes — both use `activeSession.room_id` from the same row (BlackBox.tsx L185, Therapist L523) | VERIFIED |
| 12 | Backend independently verifies right to join | No | VERIFIED |
| 13 | Room marked active/completed | `accepted` is set at claim. **Nothing sets `active` on both-joined**, despite the comment at Therapist L219 (grep: only `submitEscalation` L285 and `claim-l3-session` L112–113 set `active`). Completed set by either side's `endSession`. | VERIFIED |
| 14 | Disconnect | `MeetingView` leaves on `pagehide`/unmount (L237–252); `onMeetingLeft` → `onMeetingLeave` → `endSession` (L204–211) → row `completed`; other side sees it via realtime/polling (student) — the therapist component has no listener for status changes on its own session (only escalation-history growth, L127–157) | VERIFIED (therapist-side gap: not found in inspected ranges) |
| 15 | Student leaves before therapist joins | `cancelSession` → `cancelled` (+refund if `student_joined_at` null, hook L288–317). Therapist UI: no handler found; therapist stays on "Connecting to audio…" until manual End | VERIFIED (absence in inspected ranges) |
| 16 | Therapist accepted but token fails | On accept the token comes with `create-room`, so no separate failure. On reload (`checkActive` L173–179) failure only toasts; the render block (L516–570) shows a spinner with no retry control | VERIFIED |
| 17 | Row updated but room never created | Not possible in this ordering: room is created first. Inverse (room created, row not updated) leaves an **orphan room** | VERIFIED |
| 18 | Concurrent claim/initialize | Claim race safe (conditional UPDATE). Each loser still created a VideoSDK room first (orphans). | VERIFIED |

Expert L3 branch: expert opens modal using `room_id` from `blackbox_sessions` (RLS permits experts SELECT when `flag_level >= 3 AND status IN ('active','accepted')`, MIG:20260326175650 L4–14), joins the room, **then** calls `claim-l3-session` (`ExpertL3AlertPanel.tsx` L135–141). `claim-l3-session` checks the `expert` role in `user_roles` (L47–59) but the join already happened.

---

## 5. Peer Connect room-ID lifecycle

Peer chat itself is Supabase-based (`peer_messages`, realtime filter `session_id=eq.<id>`, `usePeerConnect.ts` L306–307). VideoSDK is used only for the optional voice call.

Facts (VERIFIED unless noted):
- Session created by student: `INSERT {student_id, intern_id, status:'pending'}` (L358–362). Intern chosen by the student; "busy" intern pre-check (L340–350) plus partial unique index `idx_unique_active_peer_intern` on `(intern_id) WHERE status IN ('pending','active')` (MIG:20260322182833 L3–5). Error code 23505 is handled (L365).
- INSERT policy requires `auth.uid() = student_id AND has_role(auth.uid(),'student')` (MIG:20260323181805 L25–32). A trigger expires stale rows older than 2 h on every insert (L2–21).
- Accept by intern: `UPDATE status='active', started_at` filtered `intern_id = user.id` (L411–415). Credits (18 ECC) are spent before the UPDATE, and failure of spend is swallowed (L404–409).
- **No room at session creation or acceptance.** `room_id` is null until a participant presses the call button.
- `startCall` (L629–687): if `session.room_id` exists in client state → return it (L636). Else `createVideoSDKRoom()` (L638), then `UPDATE … SET room_id WHERE id AND room_id IS NULL` (L641–647); if 0 rows, re-read (L650–656). Inserts a "📞 Voice call started" message and a `peer_call` notification with `{session_id, room_id}` (L662–678).
- The other party learns of the room by notification realtime (L180–215) which only stores `session_id`; the actual room ID is then read from the row via React Query (`activeSession.room_id`, PeerConnect L486, L580).
- Join: `VideoCallModal existingRoomId={activeSession.room_id}` (PeerConnect L765) → `getVideoSDKToken` (VideoCallModal L110–113). **If `existingRoomId` is falsy the modal silently creates a brand-new, unpersisted room (L114–118).**
- No validation of the room ID before join. No check that the session is still `active` at join time (client state only).

### State transitions (implemented states only; `peer_session_status` enum = pending/active/completed/flagged, MIG:20260309044600 L6; the code uses `is_flagged` boolean instead of the `flagged` status)

| Current state | Trigger | Database changes | Room changes | Next state | Failure behavior |
|---|---|---|---|---|---|
| (none) | Student `requestSession` (L322–387) | INSERT `pending`; notification to intern | none | `pending` | 23505 → "already have an active session"; credit pre-check only (L354–355) |
| `pending` | Intern `acceptSession` (L390–433) | spend 18 ECC (failure swallowed L404–409); UPDATE `active`, `started_at`; notification | none | `active`, `room_id = null` | UPDATE error → thrown; credit already spent if UPDATE fails (**gap**) |
| `pending` | Intern `declineSession` (L436–470) | UPDATE `completed` | none | `completed` | — |
| `pending` | Client expiry `expireSession` (L600–621) | UPDATE `completed` WHERE `pending` | none | `completed` | — |
| `active`, room null | Either party `startCall` (L629–687) | UPDATE `room_id` WHERE `room_id IS NULL`; message insert; notification | VideoSDK room created **before** DB write | `active`, room set | Room created + UPDATE fails → orphan room (error swallowed, UPDATE result unchecked for `error`, L641–647); two simultaneous callers → both create rooms, loser's room orphaned, re-read picks winner (L650–657) |
| `active`, room set | Other party "Join Call" | none | token only | `active` | Wrong/stale room → provider error surfaced via `MeetingView` `onError` |
| `active` | `endSession` (L574–597) / 2 h trigger | UPDATE `completed`, `ended_at` | none (no provider-side room closure; media leave is client-side) | `completed` | — |
| any open | `flagSession` (L502–560) | `is_flagged = true`, note, possible `escalation_requests` insert | none | unchanged status | — |
| `completed` | join attempt | none | `VideoCallModal` has no status check | — | **Gap:** no explicit "expired/completed → refuse join" at token or modal level (INFERRED from absence in `VideoCallModal` L60–129 and token function) |

Can LiveKit keep the existing `peer_sessions.room_id` (text, MIG:20260323180516 L1) with no schema change? **Yes (INFERRED, high confidence):** it is an unconstrained `text` column; a LiveKit room name is a string. Assumptions to validate: (a) room names derived deterministically from the session UUID so no persistence race exists at all; (b) no code assumes VideoSDK's ID format (grep found none — only display in `VideoCallModal` L174–178 and `ExpertL3AlertPanel` L228); (c) existing in-flight rows with VideoSDK IDs must drain or be treated as legacy at cutover.

---

## 6. VideoSDK vs Eternia responsibility matrix

| Capability | Current owner | Files / functions | DB involvement | VideoSDK dependency | LiveKit migration impact |
|---|---|---|---|---|---|
| Token generation | **Eternia backend** (HS256 JWT hand-signed with Web Crypto) | `videosdk-token/index.ts` L8–17, L82–104 | none | Format/claims are VideoSDK-specific (`apikey`, `permissions`) | Replace. LiveKit token format differs; do not reuse |
| Room creation | Shared: Eternia backend → VideoSDK REST | `index.ts` L112–150; callers `VideoCallModal` L79/L115, `TherapistDashboardContent` L217, `usePeerConnect` L638 | `room_id` columns | `POST /v2/rooms` | Likely eliminated (auto-create on first join, docs verified §10) |
| Room identity | Shared: VideoSDK generates, Eternia stores | `appointments.room_id` (MIG:20260311172923), `peer_sessions.room_id` (MIG:20260323180516), `blackbox_sessions.room_id` (MIG:20260311182702 L8) | text columns | Provider-generated IDs | Use deterministic names; columns reusable |
| Participant identity | **Eternia frontend** (client-chosen) | `BlackBox.tsx` L185; `Appointments.tsx` L182; `PeerConnect.tsx` L763; therapist L527 | none | `participantId` in `MeetingProvider.config` | Must move server-side into token; pseudonymize |
| Session matching / therapist assignment | Eternia frontend + Supabase | `acceptSession` L213–245; unique index MIG:20260322184923 | `blackbox_sessions.therapist_id` | none | Preserve unchanged |
| Appointment scheduling | Eternia + Supabase | `appointments`, `expert_availability` | tables | none | Preserve |
| Peer matching | Eternia frontend + Supabase | `usePeerConnect.requestSession` | `peer_sessions` + unique index | none | Preserve |
| BlackBox queue | Supabase + frontend | `fetchQueue`/realtime (L115–125) | `blackbox_sessions` | none | Preserve |
| Authentication | Supabase Auth | `supabase.auth.getUser` in functions; `client.ts` | `auth.users` | none | Preserve; reuse in new token function |
| Authorization (session level) | Supabase RLS (data) / **nobody at token layer** | MIG files §7 | policies | none | **Add** at token function |
| Audio/video transport | **VideoSDK-managed** | `MeetingProvider`, `useMeeting` | none | core | Replace |
| Mic/camera permission prompts | Browser + Eternia | `MeetingView` L285–298 (`getUserMedia` pre-prompt) | none | none | Preserve (SDK-independent) |
| Join / leave | VideoSDK + Eternia | `MeetingView` L191–252 (`join`, `leave`, `onMeetingJoined/Left`, `pagehide`) | status writes at L204–211 → `endSession` | `useMeeting` | Replace the hook calls; keep the lifecycle wiring |
| Track publish/subscribe, rendering | VideoSDK-managed + Eternia UI | `ParticipantView.tsx` (`useParticipant`, `VideoPlayer`, `micStream.track`, AudioContext gain/speaker routing L25–134) | none | heavy | Rewrite on LiveKit tracks (`MediaStreamTrack` access) |
| Mute / camera toggle | VideoSDK API, Eternia UI | `MeetingControls.tsx` L48–81, `MeetingView` L254–266 | none | `toggleMic`, `toggleWebcam`, `changeWebcam`, `getWebcams` | Replace |
| Audio level meter | Eternia over VideoSDK stream | `MeetingView.useParticipantAudioLevel` L53–112 | none | `useParticipant().micStream` | Replace the stream source |
| Reconnection | VideoSDK-managed (assumed) | no custom reconnect code found in inspected ranges; app-level join timeout in `useBlackBoxSession` L163–180 | `last_join_error` | provider | **UNKNOWN** parity; test explicitly |
| Chat / data messaging | **Not VideoSDK** — Supabase `peer_messages` | `usePeerConnect` L306–307, L475–500 | table + realtime | none (no `usePubSub` found) | Nothing to migrate |
| Session persistence / status | Eternia + Supabase | hooks above | `status`, `*_joined_at`, `last_join_error` | none | Preserve |
| AI monitoring / transcription | **Browser** (`SpeechRecognition`, `useAudioMonitor.ts` L137–143) + edge fn | `useAudioMonitor.ts` L91; `ai-transcribe` | admin writes to session rows | none (file not in VideoSDK grep) | Preserve; verify it does not depend on VideoSDK stream (grep says no) |
| Silence auto-end / refunds | Eternia | `MeetingView` L404–416 → `refund-blackbox-session` | `credit_transactions`, `blackbox_sessions` | none | Preserve |
| Media cleanup | Eternia + VideoSDK | `MeetingView` L237–252; `ParticipantView` `cleanupAudioNodes` | none | `leave()` | Re-implement with `room.disconnect()` equivalent |
| Session completion | Eternia | `endSession` in both hooks; `VideoCallModal.handleLeave` L138–156 (marks appointment `completed`) | status | none | Preserve; ensure disconnect on completion |
| Error handling | Eternia | `lib/videosdk.ts` L14–94; `MeetingView` L212–226 (messages prefixed "VideoSDK error") | `last_join_error` | error shape | Adapt error mapping |

**Keep untouched:** queue/claim logic, credit logic, escalation/refund functions, peer chat, AI monitoring, status transitions, notification flows.
**Replace:** `videosdk-token` function, `lib/videosdk.ts`, `MeetingProvider`/`useMeeting`/`useParticipant` usage in the four `videosdk/` components and their five+ entry points.
**May be lost if VideoSDK is removed first:** token endpoint (all call buttons break at once), room creation (peer/appointment/BlackBox accept all fail at `createVideoSDKRoom`), the AudioContext speaker-routing in `ParticipantView.tsx`. No chat/data-channel feature depends on VideoSDK.

Note: appointment modals are video-capable (`mode: "video"` default, `webcamEnabled: !isAudioOnly`, VideoCallModal L224), contradicting the "strictly audio-only" memory note (`.lovable/memory/index.md` L36). LiveKit grants must allow video publishing for appointments (**VERIFIED** inconsistency).

---

## 7. Database RLS and session-integrity audit

Only SQL migrations in the ZIP count as evidence. `src/integrations/supabase/types.ts` shows columns (e.g. `room_id` at L66/L227/L920) but not policies. **Live policies, dashboard edits, and applied migration state are UNKNOWN.**

Supporting functions: `has_role(_user_id, _role)` is `SECURITY DEFINER`, `search_path = public`, reads `public.user_roles` (MIG:20260309044708 L90–102). `therapist` was added to `app_role` in MIG:20260321202236 L30. Role assignment on signup: everyone gets `student` (handle_new_user L118–143); `user_roles` write policies are admin-only (MIG:20260309101549 L2–21) and there is no user-writable INSERT policy (**VERIFIED** — no escalation path found).

Policies below are the **effective** set after superseding migrations. No `FOR DELETE` policy exists on any of the three tables (grep) → deletes are denied for authenticated users under RLS.

| Table | RLS | Policy | Op | Condition (USING / WITH CHECK) | Observation |
|---|---|---|---|---|---|
| `appointments` | Enabled (MIG:20260309044630 L120) | Users can view own | SELECT | `auth.uid() = student_id OR auth.uid() = expert_id` (MIG:20260309044708 L11–13) | Correct membership check |
| | | Students can create | INSERT | `WITH CHECK auth.uid() = student_id` (L15–17) | No check that `expert_id` is an expert, nor that `room_id` is null / `status` is initial |
| | | Users can update own | UPDATE | `USING student OR expert`; **no WITH CHECK** (L19–21) | Either party can change `room_id`, `status`, `expert_id`, `credits_charged`, times. The `room_id IS NULL` idempotency guard exists only in client code (`VideoCallModal` L81–87) |
| | | Admins view all | SELECT | `has_role(auth.uid(),'admin')` (MIG:20260311202107 L2–4) | — |
| `peer_sessions` | Enabled (L121) | Users can view own | SELECT | `student_id OR intern_id` (MIG:20260309044708 L24–26) | OK |
| | | Students can create | INSERT | `auth.uid() = student_id AND has_role(uid,'student')` (MIG:20260323181805 L25–32; replaces L28–29) | `intern_id` unconstrained (any profile UUID) |
| | | Participants can update | UPDATE | `student OR intern`; no WITH CHECK (MIG:20260309044708 L31–33) | Either party can write `room_id`, `status`, `intern_id`, `is_flagged`. A student could set `status='active'` without intern acceptance (**INFERRED**) |
| | | Admins view all | SELECT | `has_role(...,'admin')` (MIG:20260311202107 L6–8) | — |
| `blackbox_sessions` | Enabled (MIG:20260311182702 L18) | Students create | INSERT | `auth.uid() = student_id` (L21–23) | Student can insert with any `status`, `room_id`, `therapist_id` (no column restriction) |
| | | Students view own | SELECT | `auth.uid() = student_id` (L26–28) | OK |
| | | Students update own | UPDATE | `USING auth.uid() = student_id`; no WITH CHECK (L47–49) | **Student can overwrite `status`, `room_id`, `therapist_id`, `flag_level`, notes** on own row (INFERRED impact: fake "accepted" state; set `therapist_id` to occupy a therapist's unique slot — risk F6) |
| | | Experts view / update | SELECT/UPDATE | `has_role(expert) AND (status='queued' OR status='escalated' OR therapist_id=uid OR (flag_level>=3 AND status IN ('active','accepted')))`; no WITH CHECK (MIG:20260326175650 L4–14, L18–28; supersedes MIG:20260311182702 L31–44 and MIG:20260326085707) | Any expert can UPDATE any queued/escalated/L3 session, any column |
| | | Therapists view / update | SELECT/UPDATE | same predicate with `therapist` (L32–42, L46–56) | Any therapist can see `student_id` of every queued session and update it |
| | | Interns view / update | SELECT/UPDATE | same predicate with `intern` (L60–70, L74–84) | **Interns can see and accept BlackBox sessions at DB level.** Inspected intern UI (`InternDashboardContent.tsx`) does not query `blackbox_sessions` (grep), so this looks like an unused permission (INFERRED) |
| | | Admins view all | SELECT | `has_role(...,'admin')` (MIG:20260311202107 L14–16) | — |
| `notifications` (used to signal peer calls) | Enabled (MIG:20260323165234 L14) | Authenticated can insert | INSERT | `WITH CHECK (true)` (L18) | Any user can insert a notification for any `user_id` including type `peer_call` (spoofed "incoming call", F9) |

Constraints / integrity:
- `idx_unique_open_blackbox_student` — one open (queued/accepted/active) BlackBox session per student (MIG:20260322182833 L8–10). VERIFIED.
- `idx_one_active_session_per_therapist` — one accepted/active session per `therapist_id` (MIG:20260322184923 L7–9). VERIFIED.
- `idx_unique_active_peer_intern` (MIG:20260322182833 L3–5). VERIFIED.
- FK: `blackbox_sessions.therapist_id → profiles(id)` (MIG:20260311182702 L6); **`student_id` has no FK** (L5, uuid NOT NULL only). `appointments`/`peer_sessions` student/intern/expert columns have FKs to `profiles` (MIG:20260309044630 L15–16, L31–32).
- **No uniqueness on `room_id`** in any table and **no CHECK** tying `room_id` to a state (e.g. `status='accepted' ⇒ room_id IS NOT NULL`). So "session accepted but room missing" is not prevented by the DB.
- Only trigger on session tables: `trg_auto_expire_peer_sessions` (MIG:20260323181805), `SECURITY DEFINER`, updates **all** stale peer rows regardless of caller.
- No RPC found that sets `room_id`. Service-role writers that bypass RLS: `claim-l3-session` (L111–119), `refund-blackbox-session` (assigned-therapist check L63; credit insert L99; session update L118–126), `escalate-emergency`, `ai-transcribe` (L228–231, L234+).

Realtime: `blackbox_sessions`, `peer_sessions`, `peer_messages`, `notifications` are in `supabase_realtime` (§migrations cited). Supabase applies SELECT RLS to `postgres_changes` delivery (general Supabase behavior, not verified from this repo → INFERRED). The therapist queue subscription has no filter (`TherapistDashboardContent.tsx` L120), so it relies entirely on RLS.

**Cases where a provider token is issued with no database authorization:** all of them (every call to `videosdk-token`). **VERIFIED.**

Not provable from the ZIP: whether the live project has the same policies (**UNKNOWN**), whether other policies were added via dashboard, and whether `anon`/`authenticated` table grants differ from Supabase defaults.

---

## 8. Migration dependency graph

```
package.json ─┬─ src/components/videosdk/{VideoCallModal, MeetingView, MeetingControls, ParticipantView}
              └─ src/lib/videosdk.ts ──────────────┐
supabase/functions/videosdk-token ◄──── supabase.functions.invoke ┘
         ▲ (callers of lib/videosdk.ts)
         ├─ components/videosdk/VideoCallModal.tsx ◄─ Appointments.tsx, MobileAppointments.tsx,
         │                                           ExpertDashboardContent.tsx, MobileExpertDashboard.tsx,
         │                                           PeerConnect.tsx, MobilePeerConnect.tsx, ExpertL3AlertPanel.tsx
         ├─ hooks/useBlackBoxSession.ts ◄─ pages/dashboard/BlackBox.tsx, components/mobile/MobileBlackBox.tsx
         ├─ hooks/usePeerConnect.ts ◄─ PeerConnect.tsx, MobilePeerConnect.tsx
         └─ components/therapist/TherapistDashboardContent.tsx
MeetingView.tsx ──► useAudioMonitor (ai-transcribe), useSilenceDetection (refund-blackbox-session), TherapistSessionControls
DB: appointments.room_id / peer_sessions.room_id / blackbox_sessions.room_id ◄─ all writers above; ◄ SessionsLogViewer (read)
supabase/config.toml (verify_jwt) ── videosdk-token;  Edge secrets: VIDEOSDK_API_KEY/SECRET
```

### File groups (A–M)

| Grp | File | Responsibility / functions | Action | Order | Required tests | Risk if omitted |
|---|---|---|---|---|---|---|
| A | `package.json` (L51), `package-lock.json`, `bun.lock`, `bun.lockb` | dependency declaration | **Adapt**: add LiveKit client/components; remove VideoSDK last; regenerate *both* lockfile families consistently | 1st add, last remove | build passes; no VideoSDK import left (`grep`) | Stale lock → CI/Vercel installs differ |
| B | `src/lib/videosdk.ts` | `invokeVideoSDK`, `getVideoSDKToken`, `createVideoSDKRoom`, error parsing (L14–104) | **Adapt/rename** into a provider-neutral `lib/realtimeMedia` (keep refresh-and-retry logic, L48–92). Signature must change: token request must carry `{kind, id}` | after C | unit tests for auth-retry, error mapping | Callers keep calling an endpoint that no longer exists |
| C | `supabase/functions/videosdk-token/index.ts` | JWT mint + room create | **Replace** (new function) with session-authorized token issuance; keep old until cutover | 2nd | authz matrix tests (§12) | Core vulnerability F1 carried over |
| C | `supabase/config.toml` L18–19 | `verify_jwt=false` for token fn | **Adapt**: add new function entry; keep in-code `getUser` check (or enable gateway JWT) | with C | unauthenticated → 401 | Function unreachable or open |
| D | `VideoCallModal.tsx` (`startCall` L60–129, `handleLeave` L138–156), `Appointments.tsx` L36/182, `MobileAppointments.tsx` L195, `ExpertDashboardContent.tsx` L403/580/906, `MobileExpertDashboard.tsx` L434 | appointment entry points | **Adapt**: pass `appointmentId` to token fn; drop room creation/persist block (L79–107) | after B,C | appointment: student ok, expert ok, third party denied | Appointment calls break; or still create rooms |
| E | `usePeerConnect.ts` (`startCall` L629–687), `PeerConnect.tsx` L469–496/758–775, `MobilePeerConnect.tsx` L261, L354, L508–514 | peer call create/join | **Adapt**: remove create-and-persist race; join by session ID; keep notification+message inserts | after C | concurrent start by both parties → one room | Duplicate/orphan rooms; UI guards on `room_id` (PeerConnect L486/L580) misbehave if `room_id` is no longer written |
| F | `useBlackBoxSession.ts` (`fetchToken` L76–102, callState L55–73), `BlackBox.tsx` L177–198, `MobileBlackBox.tsx` L132–140 | student lifecycle | **Adapt**: token fetch by `sessionId`; identity no longer client-supplied | after C | student can join only own session | Student cannot connect, or can connect elsewhere |
| G | `TherapistDashboardContent.tsx` (`acceptSession` L213–245, `checkActive` L159–184, provider L521–562), `ExpertL3AlertPanel.tsx` L114–167, L315–332 | therapist/expert lifecycle | **Adapt**: no room creation; set `room_id` = deterministic name in claim UPDATE; token fetched after claim; expert token only for L3/assigned | after C | claim race, late join, L3 expert gate | Therapist can't join; orphan or mismatched rooms |
| H | `MeetingView.tsx` L191–300, `VideoCallModal` provider block L220–248 | connection lifecycle (`join/leave`, callbacks) | **Replace SDK calls, preserve callbacks** (`onJoined`, `onJoinError`, `onMeetingLeave`) | after F,G | join/leave/error callbacks fire once; leave on `pagehide` | Credit charge (`onCallJoined`) and status writes stop firing |
| I | `ParticipantView.tsx`, `MeetingControls.tsx`, `MeetingView` L53–112, L254–266, L330–377 | rendering, mute, camera, level meter | **Replace** | with H | audio audible both ways; mute; camera switch (video appts) | No audio/video |
| J | `supabase/migrations/*` (new migration) | RLS/constraints | **Investigate → add** column-restricting policies / trigger; optional `CHECK`/uniqueness for `room_id` | before C go-live | policy tests per table | F3 persists |
| J | `claim-l3-session`, `refund-blackbox-session`, `escalate-emergency`, `ai-transcribe` | service-role writers | **Preserve** (fix F4/F5 separately) | independent | existing behavior | — |
| K | Supabase function secrets; Vercel/Lovable env | add `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` as **server secrets only**; only the public WS URL may reach the client | before C deploy | missing-secret path returns 500 not leak | Secret exposure if `VITE_` prefixed |
| L | `src/test/*` | only `example.test.ts` | **Create** tests/mocks | parallel | §12 | Zero regression protection |
| M | `vercel.json`, `.gitignore` | headers/CSP; `.env` not ignored | **Preserve**; verify CSP with the LiveKit URL; consider ignoring `.env` | cutover | smoke on preview deploy | Blocked WS if CSP tightened later |
| — | `README.md` L81, L125–128, L293, L325, L372, L469, L593–594, L690, L824; `.lovable/memory/index.md` L36 | documentation | **Update** | last | — | Stale docs |

### Recommended order
1. Add RLS/constraint hardening migration (J) — independent of provider, reversible.
2. Build and deploy the new token function (C) **alongside** the old one; add tests (L).
3. Introduce the neutral client helper (B) behind a flag.
4. Port connection lifecycle + UI primitives (H, I) in one change (they are coupled).
5. Port entry points in this order: appointments (D) → peer (E) → BlackBox student+therapist together (F+G) → expert L3.
6. Cutover; drain legacy rooms; remove VideoSDK (A), old function, docs.

### Failure modes to prevent

| Failure mode | Where it can occur today | Handled today? | Migration must |
|---|---|---|---|
| Session row without room ID | BlackBox `status='accepted'` requires `room_id` only by code (hook L67); peer `active` rows have null room by design | Partially (UI waits) | Derive room name from session ID so it always exists; optionally add a CHECK |
| Room ID exists, no joinable room | Orphan-in-reverse not possible today; stale ID after VideoSDK expiry | Not handled | Auto-create on join removes this |
| Student and therapist get different rooms | Peer/appointment race (two creators) | Partially (`IS NULL` guard client-side, re-read) | Deterministic naming eliminates it |
| Token for unauthorized room | Every call (F1) | **No** | Server-side membership check |
| Overbroad token permissions | `allow_mod` (L87) | **No** | Minimal per-workflow grants, short TTL |
| Session `active` before participants connect | BlackBox never becomes `active` on join; peer `active` at accept (before any call) | Inconsistent | Define states explicitly; don't flip state on token issue |
| Completed but media still connected | `endSession` updates row; remote peer disconnect depends on its own client observing the change (student: polling/realtime; therapist: no listener) | Partially | On completion, also disconnect server-side (delete room) or enforce token expiry |
| Retry duplicates | Rooms: yes (peer, appointment, accept); sessions: guarded by unique indexes | Sessions yes / rooms no | Idempotent token+room by session ID |
| Auth bypass | `verify_jwt=false` + in-code check present | Yes for authentication | Keep, plus authorization |
| Appointment/peer regressions | Many entry points | n/a | Regression checklist §12 |
| LiveKit secret exposure | n/a today | n/a | Secrets only in edge function env; never `VITE_*` |

---

## 9. Security and consistency findings

### Confirmed (static evidence)

| ID | Severity | Label / conf. | Finding | Evidence | Next step |
|---|---|---|---|---|---|
| F1 | **High** | VERIFIED / High | Token endpoint issues a broad (`allow_join`,`allow_mod`), room-unscoped, 2 h provider token to any authenticated user; also lets any user create rooms. No session/appointment/role/ownership check. Exploitability of joining arbitrary rooms depends on VideoSDK (UNKNOWN). Cost/quota abuse by any signed-up user is plausible (every signup receives `student` role + 100 credits, MIG:20260309044708 L118–135; signup openness UNKNOWN) | `videosdk-token/index.ts` L26, L44–65, L84–91, L112–150; `lib/videosdk.ts` L56–58 | New token function with `{kind,id}` authorization |
| F2 | Medium | VERIFIED / High | Participant identity and display name are client-supplied; server cannot bind a token to a user. BlackBox sends real UUID and username to the provider | `BlackBox.tsx` L185; `Appointments.tsx` L182; `TherapistDashboardContent.tsx` L523–527 | Server-set pseudonymous identity |
| F3 | Medium | VERIFIED (policy text) / INFERRED (impact), High/Med | UPDATE policies lack `WITH CHECK`/column limits on `appointments`, `peer_sessions`, `blackbox_sessions`; any party can alter `room_id`, `status`, counter-party columns | §7 table | Column-guard trigger or restricted RPC/policies |
| F4 | Medium | VERIFIED (absence) / INFERRED (exploit), Med | `ai-transcribe` authenticates (L63) but never compares the caller to the session before service-role writes to `peer_sessions` (L228–231) and `blackbox_sessions` (L234+). With a known session UUID, any signed-in user could inject flags/escalations. I read only L1–100 and L215–240 in full; the L240–400 escalation block was grep-checked for `user.id` (no match) | `ai-transcribe/index.ts` L63, L70, L228–238 | Add participant check; re-inspect L100–400 |
| F5 | Medium | VERIFIED / High | `claim-l3-session` is a read-modify-write on `escalation_history` with the final UPDATE keyed only on `id` (L111–119): two experts passing the check concurrently both write; the "concurrent" 409 branch (L128–133) cannot fire for that case. Also expert joins the media room **before** claiming (`ExpertL3AlertPanel.tsx` L135–141) | cited | Conditional update / RPC with row lock; gate token on L3 + role |

### Potential risks / design gaps

| ID | Sev. | Label | Finding | Evidence |
|---|---|---|---|---|
| F6 | Low–Med | INFERRED | Student can set `therapist_id` on own `blackbox_sessions` row; combined with the unique index `idx_one_active_session_per_therapist` this could block a therapist from accepting while the student's row is `accepted` | MIG:20260311182702 L47–49; MIG:20260322184923 L7–9 |
| F7 | Low–Med | VERIFIED facts / INFERRED impact | BlackBox "anonymity": therapists see username + `student_id`; UUID is the provider participant ID | `TherapistDashboardContent.tsx` L107, L436; RLS §7 |
| F8 | Low | VERIFIED | Orphan VideoSDK rooms from lost races or failed persists (BlackBox accept, peer `startCall`, appointment). No cleanup path | Therapist L217→L220; `usePeerConnect.ts` L638–657; `VideoCallModal` L79–107 |
| F9 | Low | VERIFIED / INFERRED | `notifications` INSERT is `WITH CHECK (true)`: spoofed `peer_call` notifications can set a victim's active peer session pointer client-side (still gated by RLS on the session fetch) | MIG:20260323165234 L18; `usePeerConnect.ts` L199–205 |
| F10 | Low | VERIFIED | No rate limit on token endpoint though `_shared/security.ts` has `checkRateLimit`; function does not import it. CORS `*` | `index.ts` L1–6; `security.ts` L15 |
| F11 | Low | VERIFIED | BlackBox status never reaches `active` on both-joined (comment says it should); therapist UI lacks a handler for student cancel/complete and a retry control when reconnect-token fails | Therapist L219, L127–157, L173–179, L516–570 |
| F12 | Info | VERIFIED | Intern RLS can SELECT/UPDATE queued BlackBox sessions although intern UI does not use them | MIG:20260326175650 L60–84 |
| F13 | Info | VERIFIED | Credits: BlackBox charged on join, failure to charge only warns; peer accept swallows spend failure — business-logic to preserve, not provider-related | `useBlackBoxSession.ts` L104–127; `usePeerConnect.ts` L404–409 |

---

## 10. LiveKit integration implications

Documentation checked (public pages fetched 2026-10-13):
- Authentication page (`docs.livekit.io/home/get-started/authentication/`): tokens are JWTs and "must be created on a backend server, sent to the frontend". **VERIFIED from docs.** That page does *not* document `AccessToken`, `VideoGrant` fields or TTL.
- Managing-rooms page (`docs.livekit.io/home/server/managing-rooms/`): a room is created automatically when the first participant joins; it can also be created via server API; the room closes shortly after the last participant leaves; `DeleteRoom` disconnects all participants. **VERIFIED from docs.**
- Everything below about grant field names (`room`, `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`, `canPublishSources`), identity, TTL, package names and hook names comes from my prior knowledge and is **UNVERIFIED in this audit** — confirm on LiveKit's "Tokens & grants" and client SDK docs before implementing.

Answers:
1. **Where to mint tokens:** a Supabase Edge Function, as today. It already has the auth pattern, service-role access to load session rows, and secret storage. (INFERRED recommendation.)
2. **Adapt or replace `videosdk-token`:** replace with a new function; its signing code and `action` contract are provider-specific and its authorization model is the defect. Keep the old function until cutover.
3. **`src/lib/videosdk.ts`:** keep the file's auth-refresh/error-parsing logic, rename to a provider-neutral module, and change its API to `getMediaToken({kind:'appointment'|'peer'|'blackbox', id})`. A thin compatibility shim reduces diff in the 7 entry points.
4. **`room_id` columns:** yes, can hold LiveKit room names (text; no format dependency found).
5. **Same room name for student and therapist:** derive it from the session UUID (e.g. a fixed prefix + `id`) on the server. Both sides then get it from the token response; persisting it is optional bookkeeping. Write it in the same UPDATE that claims a BlackBox session to keep `room_id` populated for UI guards.
6. **Peer Connect reuse:** with a deterministic name and auto-create-on-join, either party joining first creates the room; no `startCall` create/persist race. Keep the chat message and notification inserts.
7. **Grants / identity:** server loads the row, confirms the caller is a participant (student/intern; student/expert; student/assigned therapist; L3 expert when role=expert and `flag_level>=3`), then sets room name, identity (pseudonymous, per-session, not the profile UUID for BlackBox), publish rights (audio-only for BlackBox/peer; audio+video for appointments), short TTL, and no admin/room-create grant (grant names UNVERIFIED).
8. **Retaining authentication/authorization:** same Bearer JWT + `auth.getUser` pattern (`index.ts` L44–65), plus the new session membership check using the service-role client.
9. **DB session exists before anyone is in the LiveKit room:** acceptable and normal. No physical room is needed until the first join; token issuance must not mutate session state.
10. **Explicit room creation needed?** Not under this design (docs verified). Explicit `CreateRoom` is only needed if you want server-set `emptyTimeout`/`maxParticipants`, or to pre-create. Default timeouts affect rejoin windows — decide deliberately (UNVERIFIED defaults).
11. **Client APIs needed:** a connect/disconnect lifecycle with connected/disconnected/error events; local mic enable/disable; optional camera enable + device switching; remote audio track attach; participant list with join/leave events; access to the underlying `MediaStreamTrack` (needed by `useParticipantAudioLevel` and `ParticipantView`'s AudioContext routing). Names (`livekit-client`, `@livekit/components-react`) UNVERIFIED here.
12. **Provider-specific features to replace explicitly:** token format, `MeetingProvider`/`useMeeting`/`useParticipant`/`VideoPlayer`, `micStream.track` accessors, `toggleMic/toggleWebcam/changeWebcam/getWebcams`, SDK error codes surfaced as "VideoSDK error …" (`MeetingView` L215–217), and any server-side room closure on session completion (none exists today — consider adding via `DeleteRoom` on `completed`).

Do **not** assume: room name is authorization (it is not — the token grant is), that VideoSDK/LiveKit tokens are compatible (they are not), or that the API secret may reach the browser (it must not).

---

## 11. Ordered implementation plan

1. **Baseline tests (L):** write the §12 authorization and lifecycle tests against the *current* behavior where meaningful (mock Supabase + provider).
2. **DB hardening migration (J):** column-guard trigger (or restrictive policies) on `room_id`, `status`, `therapist_id`, `student_id`, `intern_id`, `expert_id`; optional CHECK `status IN ('accepted','active') ⇒ room_id IS NOT NULL` for BlackBox; fix `claim-l3-session` atomicity; add participant check in `ai-transcribe`.
3. **New token function (C, K):** input `{kind, id}`; authenticate → load row → authorize → derive room/identity → sign → return `{token, url, roomName}`; rate-limit via `_shared/security.ts`; no secrets in responses or logs (note existing logs print user IDs, `index.ts` L68).
4. **Client helper (B):** neutral module + shim.
5. **Lifecycle + UI port (H, I):** keep callback contracts (`onJoined`, `onJoinError`, `onMeetingLeave`, `onToggleMicReady`, `onMicStatusChange`, `onAudioLevelChange`, `onLeaveReady`, `onCaptureSnippetReady`).
6. **Entry points (D → E → F+G → expert L3).**
7. **Completion semantics:** on `completed/cancelled`, disconnect clients and (optionally) delete the room.
8. **Cutover:** feature flag; drain rows holding VideoSDK IDs; remove VideoSDK package, old function, `VIDEOSDK_*` secrets; update README.

## 12. Regression testing checklist

- Token fn: no/invalid/expired JWT → 401; valid user but non-participant → 403 for each of appointment/peer/blackbox; student ↔ other student's session → 403; therapist not assigned → 403; expert on non-L3 session → 403; expert on L3 → 200; missing LiveKit secrets → 500 without leaking names; response contains no secret; TTL and grants as designed.
- Appointments: student+expert join same room; second opener reuses; completing marks `completed` (`VideoCallModal` L138–156); video and audio modes.
- Peer: both parties click call simultaneously → single room; join after `completed` refused; notification+message still inserted; mobile + desktop.
- BlackBox: queue → accept (two therapists race) → both join same room → credits charged once on join → end by either side → other side disconnects; student cancels before therapist joins; token failure retry (student 3×, therapist reload); reconnect after network drop; L3 escalation → expert join → claim race (two experts).
- Silence auto-end → refund path; AI monitoring still produces snippets with the new audio source.
- Realtime: subscription failure falls back to polling (student 3 s, `useBlackBoxSession.ts` L183–196).
- Env: local vs Vercel preview vs production secret parity; CSP allows LiveKit WS; both lockfiles install cleanly.

## 13. Unknowns requiring further evidence

1. Live Supabase policies/grants/applied migrations vs the ZIP; whether `combined.sql` is stale.
2. Whether VideoSDK honors a room-less token for arbitrary rooms (provider behavior), and room-ID entropy/expiry.
3. Whether public signup is open (affects F1 abuse).
4. Edge Function secrets/values and Vercel env values.
5. `MeetingView.tsx` L1–185, L300–370, L420–643 and `ParticipantView`, `MeetingControls` full bodies; mobile variants beyond grep.
6. `ai-transcribe` L100–400, `escalate-emergency` full body.
7. `useSilenceDetection`, `useAudioMonitor` full bodies (stream dependency).
8. Realtime RLS delivery behavior in the live project.
9. LiveKit grant/identity/TTL specifics and client package APIs (docs not reached for those pages).
10. Whether any in-flight sessions will exist at cutover.

## 14. Files to re-inspect before implementation

`supabase/functions/videosdk-token/index.ts`, `src/lib/videosdk.ts`, `src/components/videosdk/*` (full), `src/hooks/useBlackBoxSession.ts`, `src/hooks/usePeerConnect.ts`, `src/hooks/useAudioMonitor.ts`, `src/hooks/useSilenceDetection.ts`, `src/components/therapist/TherapistDashboardContent.tsx`, `src/components/expert/{ExpertL3AlertPanel,ExpertDashboardContent}.tsx`, `src/components/mobile/{MobileBlackBox,MobilePeerConnect,MobileAppointments,MobileExpertDashboard}.tsx`, `src/pages/dashboard/{BlackBox,PeerConnect,Appointments}.tsx`, `supabase/functions/{claim-l3-session,refund-blackbox-session,escalate-emergency,ai-transcribe}/index.ts`, `supabase/config.toml`, all migrations touching the three session tables (§7) — and a fresh `pg_policies` dump from the live project.

### Consolidated file table

| File | Action |
|---|---|
| `package.json`, lockfiles | Adapt |
| `supabase/functions/videosdk-token/index.ts` | Replace |
| `supabase/config.toml` | Adapt |
| `src/lib/videosdk.ts` | Adapt/rename |
| `src/components/videosdk/{VideoCallModal,MeetingView,MeetingControls,ParticipantView}.tsx` | Adapt / Replace SDK usage |
| `src/hooks/useBlackBoxSession.ts`, `src/hooks/usePeerConnect.ts` | Adapt |
| `src/pages/dashboard/{BlackBox,PeerConnect,Appointments}.tsx` | Adapt |
| `src/components/mobile/{MobileBlackBox,MobilePeerConnect,MobileAppointments,MobileExpertDashboard}.tsx` | Adapt |
| `src/components/therapist/TherapistDashboardContent.tsx` | Adapt |
| `src/components/expert/{ExpertL3AlertPanel,ExpertDashboardContent}.tsx` | Adapt |
| `supabase/functions/{claim-l3-session,ai-transcribe}/index.ts` | Investigate/fix (F4, F5) |
| `supabase/functions/{refund-blackbox-session,escalate-emergency}/index.ts` | Preserve |
| `supabase/migrations/*` | Add new hardening migration; preserve existing |
| `src/components/admin/SessionsLogViewer.tsx` | Preserve (reads `room_id`) |
| `src/hooks/{useAudioMonitor,useSilenceDetection}.ts`, `components/blackbox/TherapistSessionControls.tsx` | Preserve; investigate stream dependency |
| `vercel.json`, `.gitignore` | Preserve / verify |
| `README.md`, `.lovable/memory/index.md` | Update |
| `src/test/*` | Create tests |
