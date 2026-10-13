

# Complete Remaining Redesign — All Pages, One Pass

I'll finish Phases 3–6 in a single batch. Visual-only changes, every core feature/route/hook/edge function stays identical.

## Files to update (grouped by phase)

### Phase 3 — Remaining student screens
**Mobile:** `MobileBlackBox`, `MobilePeerConnect`, `MobileProfile`, `MobileRecoverySetup`, `MobileAdminDashboard`, `MobileExpertDashboard`, `MobileInternDashboard`
**Desktop:** `Journaling`, `Gratitude`, `QuestCards`, `Appointments`, `PeerConnect`, `BlackBox`, `SoundTherapy`, `Profile`, `Credits`, `WreckBuddy`, `TibetanBowl`, `RecoverySetup`

### Phase 4 — Auth + Landing
**Auth:** `Login`, `Register`, `InstitutionCode`, `QRScan`, `ForgotPassword`, `ContactInstitution`
**Landing:** `Landing.tsx` + `Navbar`, `HeroSection`, `AnnouncementBanner`, `TrustLogos`, `FeaturesSection`, `HowItWorksSection`, `StatsSection`, `AboutSection`, `SecuritySection`, `CodePreviewSection`, `TestimonialsSection`, `FAQSection`, `CTASection`, `Footer`
**Legal:** `Privacy`, `Terms`, `DPDP`, `NotFound`

### Phase 5 — Staff & admin
**Pages:** `AdminDashboard`, `ExpertDashboard`, `InternDashboard`, `SPOCDashboard`, `TherapistDashboard`
**Admin components:** `OverviewDashboard`, `AnalyticsDashboard`, `AuditLogViewer`, `MemberManager`, `InstitutionManager`, `InstitutionDetailView`, `RoleManager`, `SoundManager`, `QuestCardManager`, `TrainingModuleManager`, `InquiryTicketManager`, `EscalationManager`, `SessionsLogViewer`, `PasswordResetManager`, `AccountDeletion`, `DeletionRequestsManager`, `CreditGrantTool`, `SPOCTools`, `ExpertManager`
**Role content:** `ExpertDashboardContent`, `ExpertL3AlertPanel`, `InternDashboardContent`, `SPOCDashboardContent`, `StudentIdVerificationSection`, `TherapistDashboardContent`, `TherapistSessionControls`

### Phase 6 — Shared polish
`EterniaLogo`, `NotificationBell`, `NovaOrb`, `ResolvedAvatar`, `AvatarUpload`, `EmojiPicker`, `EmergencyAlertOverlay`, `CookieConsent`, `PWAUpdatePrompt`, `NavLink`, `ErrorBoundary`, `ProtectedRoute`
shadcn primitives soft-radius pass: `button`, `card`, `input`, `tabs`, `dialog`, `badge`, `select`, `dropdown-menu` (no prop API changes)

## Treatment applied to every file

- Cream `bg-[hsl(var(--surface-cream))]` page backgrounds
- `card-soft` containers replacing flat borders
- `font-display` (Fraunces) on all headings
- Pastel surface tiles (`surface-pink/mint/sky/butter/lavender/peach`) rotated by category
- Pill buttons, soft shadows, 24–32px radius
- Emoji accents on category headers and stats
- Active states use lavender pill (matches sidebar pattern already shipped)

## Hard guarantees — nothing functional changes

- Routes, hooks, queries, edge functions, RLS, role redirects: untouched
- Component prop signatures: unchanged
- Database schema: no migrations
- All copy text: kept verbatim
- All form fields, validation, submit handlers: kept
- Recharts data series, table columns, filter logic: kept

## Execution

Single message, parallel file writes, ordered Phase 3 → 4 → 5 → 6. After completion I'll list every file touched so you can spot-check.

