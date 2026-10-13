# PRD v2-28 + CR v1.7 + CR v1.8 Implementation Status — Updated 2026-03-22

## Completed Gaps
1. **Dual Verification Model** — institution_type column, APAAR/ERP fields, Register.tsx detects type
2. **Training Status Lifecycle** — not_started → in_progress → assessment_pending → failed → interview_pending → active
3. **PeerConnect gates** on training_status "active" or "completed"
4. **Stability Pool Auto-Contribution** — edge function deployed
5. **BlackBox Credits** — 30 ECC via useBlackBoxSession
6. **SPOC M.Phil Override Records** — Reports tab
7. **Escalation consent checkbox** — Register.tsx Step 2 (lines 344-359)
8. **Intern tab locking** — sessions, notes, profile locked until training_status is active/completed
9. **Members grouped by institution** — MemberManager.tsx with expandable groups
10. **Credit grants restricted to students** — grant-credits edge function validates student role
11. **Profile emergency text softened** — changed from text-destructive to text-primary
12. **device_sessions table** — JWT rotation & multi-device tracking with RLS
13. **recurrence_rule on expert_availability** — for recurring weekly slots
14. **therapist added to app_role enum** — distinct from expert
15. **Performance indexes** — 20+ composite indexes on high-traffic tables
16. **SPOC real-time escalation notifications** — realtime subscription + toast alerts
17. **L3 host-swap** — BlackBox sessions transfer to M.Phil expert on L3 escalation
18. **Escalation requests realtime** — enabled via supabase_realtime publication
19. **Therapist role in admin tools** — MemberManager, RoleManager, add-member, bulk-add-members edge functions
20. **Therapist DashboardLayout nav** — Queue + Profile nav items for therapist role
21. **Therapist redirect from /dashboard** — Dashboard.tsx + MobileDashboard.tsx redirect to /dashboard/therapist
22. **Therapist RLS on blackbox_sessions** — SELECT + UPDATE policies for therapist and intern roles
23. **AI model updated** — Groq API (GPT OSS 20B 128k) for content moderation
24. **Peer Connect text-chat only** — WhatsApp-like UI, all call functionality removed per PRD alignment
25. **Dynamic SPOC QR** — QRCodeSVG with regeneration, no expiry
26. **Emergency Contact on L3** — get-emergency-contact edge function + toast display (CR v1.8 §5.2)
27. **Trigger Snippet Storage** — escalation_requests populated with trigger_snippet + trigger_timestamp (CR v1.8 §4.1)

## Phase 2 (Not Yet Implemented)
- AI selective audio transcription monitoring (PRD 19.1) — requires media processing pipeline
- SPOC QR TTL auto-expiry enforcement — edge function exists but needs cron job
- Account deletion 30-day grace period UI — edge function exists, needs UI confirmation flow
