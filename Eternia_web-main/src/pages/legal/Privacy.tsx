import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import EterniaLogo from "@/components/EterniaLogo";

const sections = [
  { id: "introduction", title: "1. Introduction & Scope" },
  { id: "definitions", title: "2. Definitions" },
  { id: "information-collected", title: "3. Information We Collect" },
  { id: "legal-basis", title: "4. Legal Basis for Processing" },
  { id: "how-we-use", title: "5. How We Use Your Information" },
  { id: "data-retention", title: "6. Data Retention Periods" },
  { id: "data-security", title: "7. Data Storage, Security & Encryption" },
  { id: "data-sharing", title: "8. Data Sharing & Third Parties" },
  { id: "international-transfers", title: "9. International Data Transfers" },
  { id: "cookie-policy", title: "10. Cookie Policy" },
  { id: "your-rights", title: "11. Your Rights Under GDPR & DPDP" },
  { id: "children", title: "12. Children's Privacy" },
  { id: "ai-decisions", title: "13. Automated Decision-Making & AI" },
  { id: "blackbox", title: "14. BlackBox & Session Data Handling" },
  { id: "breach-notification", title: "15. Data Breach Notification" },
  { id: "changes", title: "16. Changes to This Policy" },
  { id: "grievance", title: "17. Grievance Redressal & DPO Contact" },
  { id: "governing-law", title: "18. Governing Law & Jurisdiction" },
];

const Privacy = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-5 py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="flex items-center mb-8">
        <EterniaLogo size={44} />
      </div>

      <h1 className="text-3xl font-bold font-display mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm mb-2">Last updated: March 21, 2026</p>
      <p className="text-muted-foreground text-sm mb-8">Effective date: March 21, 2026 &nbsp;|&nbsp; Version 2.0</p>

      {/* Table of Contents */}
      <nav className="mb-10 p-5 rounded-xl bg-card border border-border/50">
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">Table of Contents</h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-xs text-primary hover:underline">{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-8 text-sm leading-relaxed text-foreground/80">
        {/* 1 */}
        <section id="introduction">
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduction & Scope</h2>
          <p>Eternia Technologies Private Limited ("<strong>Eternia</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>") operates the Eternia platform — a privacy-first, anonymous student wellbeing ecosystem accessible via web application, progressive web app (PWA), and associated backend services (collectively, the "<strong>Platform</strong>").</p>
          <p className="mt-2">This Privacy Policy explains how we collect, use, store, share, and protect information when you access or use our Platform. It applies to all users, including students, peer counselors (interns), licensed experts/therapists, Single Points of Contact (SPOCs), and administrators.</p>
          <p className="mt-2">By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree, please discontinue use immediately.</p>
          <p className="mt-2">This Policy should be read in conjunction with our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link to="/dpdp" className="text-primary hover:underline">DPDP Compliance Statement</Link>.</p>
        </section>

        {/* 2 */}
        <section id="definitions">
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Definitions</h2>
          <p>For the purposes of this Privacy Policy, the following definitions apply:</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead><tr className="bg-muted/30"><th className="text-left p-2.5 font-semibold text-foreground">Term</th><th className="text-left p-2.5 font-semibold text-foreground">Definition</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                <tr><td className="p-2.5 font-medium">Data Controller</td><td className="p-2.5">Eternia Technologies Private Limited, which determines the purposes and means of processing Personal Data.</td></tr>
                <tr><td className="p-2.5 font-medium">Data Subject</td><td className="p-2.5">Any identified or identifiable natural person whose Personal Data is processed by the Platform.</td></tr>
                <tr><td className="p-2.5 font-medium">Personal Data</td><td className="p-2.5">Any information relating to an identified or identifiable natural person, including but not limited to usernames, device identifiers, session data, and usage patterns.</td></tr>
                <tr><td className="p-2.5 font-medium">Processing</td><td className="p-2.5">Any operation performed on Personal Data, whether automated or manual, including collection, recording, organisation, structuring, storage, adaptation, retrieval, consultation, use, disclosure, alignment, combination, restriction, erasure, or destruction.</td></tr>
                <tr><td className="p-2.5 font-medium">Sensitive Personal Data</td><td className="p-2.5">Data relating to mental health, counseling sessions, emotional wellbeing assessments, BlackBox journal entries, and any health-related information processed through the Platform.</td></tr>
                <tr><td className="p-2.5 font-medium">Encryption</td><td className="p-2.5">The process of encoding data so that only authorised parties can access it, using AES-256 encryption at rest and TLS 1.3 in transit.</td></tr>
                <tr><td className="p-2.5 font-medium">Anonymisation</td><td className="p-2.5">The irreversible process of altering Personal Data so that the Data Subject is no longer identifiable.</td></tr>
                <tr><td className="p-2.5 font-medium">Pseudonymisation</td><td className="p-2.5">The processing of Personal Data in such a manner that it can no longer be attributed to a specific Data Subject without the use of additional information.</td></tr>
                <tr><td className="p-2.5 font-medium">Sub-processor</td><td className="p-2.5">A third-party entity engaged by Eternia to process Personal Data on its behalf.</td></tr>
                <tr><td className="p-2.5 font-medium">SPOC</td><td className="p-2.5">Single Point of Contact — an authorised institutional representative who manages the institution's account on the Platform.</td></tr>
                <tr><td className="p-2.5 font-medium">ECC</td><td className="p-2.5">Eternia Credits — the internal virtual currency used for services within the Platform.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3 */}
        <section id="information-collected">
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Information We Collect</h2>
          <p>We collect information in several categories. Eternia is designed with a privacy-first architecture — we minimize data collection and maximise anonymity.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.1 Account & Registration Data</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Anonymous username (chosen by you; not linked to real identity)</li>
            <li>Hashed password (bcrypt with salt; we never store plaintext passwords)</li>
            <li>Institution code (to link you to your educational institution)</li>
            <li>System-generated Student ID (e.g., ETN-DEMO-00001)</li>
            <li>User role designation (student, intern, expert, SPOC, admin)</li>
            <li>Account creation timestamp</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.2 Device & Technical Data</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Device fingerprint hash (SHA-256; used for single-device enforcement)</li>
            <li>Browser type and version (User-Agent string)</li>
            <li>Screen resolution and viewport dimensions</li>
            <li>Operating system type and version</li>
            <li>IP address (hashed for audit logs; never stored in plaintext)</li>
            <li>Session refresh tokens (hashed; for authentication continuity)</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.3 Usage & Analytics Data</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Pages visited and navigation paths</li>
            <li>Feature usage frequency (Peer Connect, BlackBox, Sound Therapy, etc.)</li>
            <li>Session duration and engagement metrics</li>
            <li>Quest completion and XP earned</li>
            <li>Credit transaction history (earn/spend/grant amounts)</li>
            <li>Cookie consent preferences</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.4 Sensitive & Session Data</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>BlackBox journal entries (end-to-end encrypted; we cannot read them)</li>
            <li>Peer session messages (end-to-end encrypted)</li>
            <li>Expert/therapist session notes (end-to-end encrypted)</li>
            <li>AI-generated flag levels (numeric risk assessment; no content stored)</li>
            <li>Escalation requests and justifications (encrypted)</li>
            <li>Voice recordings for voice entries (encrypted at rest)</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.5 Institutional Verification Data (Optional)</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>ERP ID (encrypted; for institutional verification only)</li>
            <li>APAAR ID (encrypted; for government-linked verification only)</li>
            <li>Emergency contact information (encrypted; provided voluntarily)</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.6 Data We Do NOT Collect</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Real name, legal name, or full name</li>
            <li>Email address (we use @eternia.local pseudonymous emails internally)</li>
            <li>Phone number (unless voluntarily provided as emergency contact)</li>
            <li>Physical address or geolocation coordinates</li>
            <li>Social media profiles or external account identifiers</li>
            <li>Financial information, bank details, or payment card numbers</li>
            <li>Biometric data (fingerprints, facial recognition, etc.)</li>
          </ul>
        </section>

        {/* 4 */}
        <section id="legal-basis">
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Legal Basis for Processing</h2>
          <p>We process your data under the following legal bases in accordance with the General Data Protection Regulation (GDPR), the Digital Personal Data Protection Act, 2023 (DPDP Act), and the Information Technology Act, 2000:</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead><tr className="bg-muted/30"><th className="text-left p-2.5 font-semibold text-foreground">Legal Basis</th><th className="text-left p-2.5 font-semibold text-foreground">Purpose</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                <tr><td className="p-2.5 font-medium">Consent</td><td className="p-2.5">Cookie analytics tracking, optional emergency contact sharing, optional institutional verification (ERP/APAAR)</td></tr>
                <tr><td className="p-2.5 font-medium">Contractual Necessity</td><td className="p-2.5">Account creation, service delivery (peer sessions, expert appointments, BlackBox), credit transactions</td></tr>
                <tr><td className="p-2.5 font-medium">Legitimate Interest</td><td className="p-2.5">Platform security, fraud prevention, device validation, aggregated analytics for institutional reporting, AI safety moderation</td></tr>
                <tr><td className="p-2.5 font-medium">Legal Obligation</td><td className="p-2.5">Compliance with Indian IT Act, DPDP Act, mandatory reporting of imminent harm as required by law</td></tr>
                <tr><td className="p-2.5 font-medium">Vital Interest</td><td className="p-2.5">Escalation of high-risk AI flag levels (imminent self-harm or danger) to designated institutional contacts</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 5 */}
        <section id="how-we-use">
          <h2 className="text-lg font-semibold text-foreground mb-3">5. How We Use Your Information</h2>
          <p>We use collected information strictly for the following purposes:</p>
          <ol className="list-decimal list-inside space-y-1.5 ml-2 mt-2">
            <li><strong>Authentication & Access Control</strong> — Verifying your identity, managing login sessions, enforcing single-device policies, and providing role-based access to features.</li>
            <li><strong>Service Delivery</strong> — Facilitating peer counseling sessions, expert/therapist appointments, BlackBox journaling, sound therapy, self-help quests, and credit-based services.</li>
            <li><strong>AI Safety Moderation</strong> — Analysing content for risk indicators (suicidal ideation, self-harm, abuse) using AI models to generate numeric flag levels. Content is processed transiently; we do not store AI analysis results beyond the flag level.</li>
            <li><strong>Escalation & Safety</strong> — Routing high-risk flagged content to SPOCs and institutional contacts for intervention in accordance with duty-of-care obligations.</li>
            <li><strong>Credit Economy</strong> — Processing Eternia Credit (ECC) earn, spend, grant, and purchase transactions; maintaining credit balance integrity; managing the ECC Stability Pool.</li>
            <li><strong>Institutional Reporting</strong> — Providing partnered institutions with aggregated, anonymised wellbeing metrics (e.g., session counts, engagement trends). Individual data is never shared.</li>
            <li><strong>Platform Analytics</strong> — Understanding usage patterns, feature adoption, and performance metrics to improve the Platform (only with cookie consent).</li>
            <li><strong>Security & Fraud Prevention</strong> — Detecting unauthorised access, preventing abuse, enforcing device validation, and maintaining audit trails.</li>
            <li><strong>Training & Quality Assurance</strong> — Managing intern training modules, tracking training progress, and ensuring service quality standards.</li>
            <li><strong>Communication</strong> — Sending system notifications, appointment reminders, and platform updates through in-app channels.</li>
            <li><strong>Legal Compliance</strong> — Fulfilling legal obligations under Indian law, responding to lawful requests from authorities, and maintaining records as required.</li>
            <li><strong>Research & Development</strong> — Using aggregated, anonymised data to improve our AI models, develop new features, and advance student wellbeing research.</li>
          </ol>
        </section>

        {/* 6 */}
        <section id="data-retention">
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention Periods</h2>
          <p>We retain your data only for as long as necessary to fulfil the purposes described in this Policy, or as required by law.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead><tr className="bg-muted/30"><th className="text-left p-2.5 font-semibold text-foreground">Data Category</th><th className="text-left p-2.5 font-semibold text-foreground">Retention Period</th><th className="text-left p-2.5 font-semibold text-foreground">Basis</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                <tr><td className="p-2.5">Account profile data</td><td className="p-2.5">Duration of account + 30 days post-deletion</td><td className="p-2.5">Contractual</td></tr>
                <tr><td className="p-2.5">BlackBox entries (encrypted)</td><td className="p-2.5">Until user deletes or account deletion</td><td className="p-2.5">User control</td></tr>
                <tr><td className="p-2.5">Peer session messages</td><td className="p-2.5">90 days after session completion</td><td className="p-2.5">Service delivery</td></tr>
                <tr><td className="p-2.5">Expert session notes</td><td className="p-2.5">1 year after session (professional obligation)</td><td className="p-2.5">Legal/professional</td></tr>
                <tr><td className="p-2.5">Credit transactions</td><td className="p-2.5">3 years (financial record-keeping)</td><td className="p-2.5">Legal obligation</td></tr>
                <tr><td className="p-2.5">Audit logs</td><td className="p-2.5">2 years</td><td className="p-2.5">Security/compliance</td></tr>
                <tr><td className="p-2.5">Analytics events</td><td className="p-2.5">1 year</td><td className="p-2.5">Legitimate interest</td></tr>
                <tr><td className="p-2.5">Device session tokens</td><td className="p-2.5">Until expiry or revocation</td><td className="p-2.5">Security</td></tr>
                <tr><td className="p-2.5">Escalation records</td><td className="p-2.5">5 years (institutional compliance)</td><td className="p-2.5">Legal obligation</td></tr>
                <tr><td className="p-2.5">Recovery credentials</td><td className="p-2.5">Duration of account</td><td className="p-2.5">User control</td></tr>
                <tr><td className="p-2.5">Cookie consent preferences</td><td className="p-2.5">Duration of account</td><td className="p-2.5">Consent record</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">Upon account deletion, we initiate a 30-day grace period during which data is soft-deleted (marked for deletion but retrievable if you change your mind). After 30 days, data is permanently and irreversibly purged from all systems, including backups, within 90 days.</p>
        </section>

        {/* 7 */}
        <section id="data-security">
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Data Storage, Security & Encryption</h2>
          <p>We implement industry-leading security measures to protect your data:</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">7.1 Encryption Standards</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>At Rest:</strong> All sensitive data is encrypted using AES-256 encryption. Database-level encryption is enforced on all storage volumes.</li>
            <li><strong>In Transit:</strong> All communications between your device and our servers use TLS 1.3 with forward secrecy (ECDHE key exchange).</li>
            <li><strong>End-to-End (E2E):</strong> BlackBox entries, peer session messages, expert session notes, and escalation justifications are encrypted client-side before transmission. Eternia cannot decrypt or read this content.</li>
            <li><strong>Password Hashing:</strong> Passwords are hashed using bcrypt with per-user salt (cost factor 12). We never store or log plaintext passwords.</li>
            <li><strong>IP Addresses:</strong> Stored only as SHA-256 hashes in audit logs for security analysis; never in plaintext.</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">7.2 Infrastructure Security</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Hosted on ISO 27001-compliant cloud infrastructure</li>
            <li>Row-Level Security (RLS) policies enforce data isolation at the database layer</li>
            <li>Role-based access control (RBAC) with principle of least privilege</li>
            <li>Automated vulnerability scanning and dependency auditing</li>
            <li>Regular penetration testing by independent security firms</li>
            <li>Immutable audit logging for all administrative actions</li>
            <li>Single-device enforcement via cryptographic device fingerprinting</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">7.3 Access Controls</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Multi-layered authentication with session management</li>
            <li>Automatic session expiry and token rotation</li>
            <li>Administrative access requires verified admin role with audit trail</li>
            <li>SPOC access is institution-scoped; SPOCs cannot access data from other institutions</li>
            <li>No Eternia employee can access end-to-end encrypted content</li>
          </ul>
        </section>

        {/* 8 */}
        <section id="data-sharing">
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Data Sharing & Third Parties</h2>
          <p><strong>We do not sell, rent, or trade your Personal Data.</strong> We share data only in the following limited circumstances:</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">8.1 Institutional Partners</h3>
          <p>Partnered educational institutions receive only aggregated, anonymised wellbeing metrics (e.g., total sessions conducted, feature usage percentages, engagement trends). Individual user data, BlackBox content, or session details are <strong>never</strong> shared with institutions except through the escalation process for imminent safety concerns.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">8.2 Sub-processors</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead><tr className="bg-muted/30"><th className="text-left p-2.5 font-semibold text-foreground">Sub-processor</th><th className="text-left p-2.5 font-semibold text-foreground">Purpose</th><th className="text-left p-2.5 font-semibold text-foreground">Data Accessed</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                <tr><td className="p-2.5">Cloud Infrastructure Provider</td><td className="p-2.5">Hosting, database, storage, edge functions</td><td className="p-2.5">All data (encrypted at rest)</td></tr>
                <tr><td className="p-2.5">AI/ML Providers</td><td className="p-2.5">Content moderation, risk assessment</td><td className="p-2.5">Transient processing only; no storage</td></tr>
                <tr><td className="p-2.5">Video SDK Provider</td><td className="p-2.5">Real-time video/audio for sessions</td><td className="p-2.5">Session media (not recorded or stored)</td></tr>
                <tr><td className="p-2.5">CDN Provider</td><td className="p-2.5">Content delivery, static assets</td><td className="p-2.5">Public assets only; no Personal Data</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">All sub-processors are bound by data processing agreements (DPAs) that require equivalent or higher security standards.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">8.3 Legal Requirements</h3>
          <p>We may disclose data if required by law, court order, or regulatory authority. We will notify affected users unless legally prohibited from doing so. Given our end-to-end encryption, we may be technically unable to provide decrypted content even under legal compulsion.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">8.4 Safety Escalations</h3>
          <p>When our AI moderation system detects imminent risk (flag level ≥ 3), the system may route limited, relevant information to the institution's designated SPOC for intervention. This is done under vital interest and legal obligation bases. The escalation includes only the minimum necessary information and is itself encrypted.</p>
        </section>

        {/* 9 */}
        <section id="international-transfers">
          <h2 className="text-lg font-semibold text-foreground mb-3">9. International Data Transfers</h2>
          <p>Your data is primarily stored and processed in India. However, certain sub-processors may process data in other jurisdictions. Where data is transferred outside India, we ensure:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Adequate data protection standards as required by the DPDP Act</li>
            <li>Standard Contractual Clauses (SCCs) or equivalent safeguards are in place</li>
            <li>Data processing agreements with all international sub-processors</li>
            <li>Encryption in transit (TLS 1.3) and at rest (AES-256) for all transferred data</li>
            <li>Compliance with any additional requirements specified by the Data Protection Board of India</li>
          </ul>
        </section>

        {/* 10 */}
        <section id="cookie-policy">
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Cookie Policy</h2>
          <p>We use cookies and similar technologies to operate and improve the Platform. You can manage your cookie preferences through our cookie consent banner.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead><tr className="bg-muted/30"><th className="text-left p-2.5 font-semibold text-foreground">Cookie Type</th><th className="text-left p-2.5 font-semibold text-foreground">Purpose</th><th className="text-left p-2.5 font-semibold text-foreground">Duration</th><th className="text-left p-2.5 font-semibold text-foreground">Required?</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                <tr><td className="p-2.5 font-medium">Essential / Authentication</td><td className="p-2.5">Session management, authentication tokens, CSRF protection, device validation</td><td className="p-2.5">Session / 7 days</td><td className="p-2.5">Yes (cannot be disabled)</td></tr>
                <tr><td className="p-2.5 font-medium">Functional / Preferences</td><td className="p-2.5">Theme preferences, language settings, cookie consent status, UI state</td><td className="p-2.5">1 year</td><td className="p-2.5">Yes</td></tr>
                <tr><td className="p-2.5 font-medium">Analytics</td><td className="p-2.5">Anonymous page view tracking, feature usage, session hashing, screen dimensions</td><td className="p-2.5">Session</td><td className="p-2.5">No (requires consent)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3"><strong>We do not use:</strong> Advertising cookies, third-party tracking pixels, social media trackers, cross-site tracking mechanisms, or any form of behavioural advertising technology.</p>
          <p className="mt-2">You can withdraw cookie consent at any time by clearing your browser's local storage for this domain. We will cease analytics tracking immediately upon withdrawal.</p>
        </section>

        {/* 11 */}
        <section id="your-rights">
          <h2 className="text-lg font-semibold text-foreground mb-3">11. Your Rights Under GDPR & DPDP</h2>
          <p>Depending on your jurisdiction, you have the following rights regarding your Personal Data:</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">11.1 Rights Under GDPR (EU/EEA Users)</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li><strong>Right of Access (Art. 15):</strong> Request a copy of all Personal Data we hold about you.</li>
            <li><strong>Right to Rectification (Art. 16):</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Right to Erasure (Art. 17):</strong> Request deletion of your data ("right to be forgotten"). Subject to legal retention requirements.</li>
            <li><strong>Right to Restriction (Art. 18):</strong> Request that we restrict processing of your data in certain circumstances.</li>
            <li><strong>Right to Data Portability (Art. 20):</strong> Receive your data in a structured, commonly used, machine-readable format.</li>
            <li><strong>Right to Object (Art. 21):</strong> Object to processing based on legitimate interest, including profiling.</li>
            <li><strong>Right to Withdraw Consent (Art. 7):</strong> Withdraw consent at any time without affecting lawfulness of prior processing.</li>
            <li><strong>Right to Lodge a Complaint:</strong> File a complaint with your local data protection supervisory authority.</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">11.2 Rights Under DPDP Act (Indian Users)</h3>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li><strong>Right to Access:</strong> Obtain a summary of your Personal Data and processing activities.</li>
            <li><strong>Right to Correction & Erasure:</strong> Request correction of inaccurate data or erasure of data no longer necessary.</li>
            <li><strong>Right to Grievance Redressal:</strong> Raise grievances with our Data Protection Officer and, if unresolved, with the Data Protection Board of India.</li>
            <li><strong>Right to Nominate:</strong> Nominate another person to exercise your rights in case of death or incapacity.</li>
          </ul>

          <p className="mt-3">To exercise any of these rights, contact our Data Protection Officer at <span className="text-primary">dpo@eternia.com</span>. We will respond within 30 days (or as required by applicable law).</p>
        </section>

        {/* 12 */}
        <section id="children">
          <h2 className="text-lg font-semibold text-foreground mb-3">12. Children's Privacy</h2>
          <p>Eternia is designed for students aged 16 and above. We do not knowingly collect Personal Data from children under 16 years of age. If you are under 16, you must have verifiable parental or guardian consent to use the Platform.</p>
          <p className="mt-2">If we become aware that we have collected Personal Data from a child under 16 without appropriate consent, we will take immediate steps to delete such data. If you believe we may have inadvertently collected data from a minor, please contact us at <span className="text-primary">privacy@eternia.com</span>.</p>
          <p className="mt-2">For users between 16 and 18 years of age, additional safeguards may apply as determined by applicable local laws and institutional policies.</p>
        </section>

        {/* 13 */}
        <section id="ai-decisions">
          <h2 className="text-lg font-semibold text-foreground mb-3">13. Automated Decision-Making & AI</h2>
          <p>Eternia uses artificial intelligence in the following capacities:</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">13.1 Content Moderation</h3>
          <p>BlackBox entries and peer session messages are analysed by AI models to detect potential safety concerns (self-harm, suicidal ideation, abuse indicators). The AI generates a numeric flag level (0–5):</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li><strong>Level 0:</strong> No concern detected</li>
            <li><strong>Level 1:</strong> Mild emotional distress (no action)</li>
            <li><strong>Level 2:</strong> Moderate concern (resources suggested)</li>
            <li><strong>Level 3:</strong> Significant concern (SPOC notification)</li>
            <li><strong>Level 4:</strong> High risk (SPOC + expert escalation)</li>
            <li><strong>Level 5:</strong> Imminent danger (immediate institutional escalation)</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">13.2 Safeguards</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>AI processes content transiently — it does not store the content analysed</li>
            <li>Only the numeric flag level is stored; AI reasoning is not retained</li>
            <li>Human review is required before any escalation action is taken (except Level 5)</li>
            <li>Users can contest AI flag decisions through the SPOC or admin channels</li>
            <li>AI models are regularly audited for bias and accuracy</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">13.3 No Automated Decision-Making with Legal Effects</h3>
          <p>No fully automated decision with legal or similarly significant effects is made about you. AI-generated flags are advisory and always subject to human oversight.</p>
        </section>

        {/* 14 */}
        <section id="blackbox">
          <h2 className="text-lg font-semibold text-foreground mb-3">14. BlackBox & Session Data Handling</h2>
          <p>The BlackBox feature allows you to privately journal your thoughts and feelings. Given the sensitive nature of this data, we apply the highest security standards:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
            <li>All BlackBox entries are encrypted end-to-end before leaving your device</li>
            <li>Eternia servers store only ciphertext; we cannot read your entries</li>
            <li>Encryption keys are derived from your credentials and are never transmitted to our servers</li>
            <li>AI moderation occurs on the plaintext transiently on your device before encryption; only the flag level is sent to the server</li>
            <li>You can delete individual entries or all entries at any time</li>
            <li>Upon account deletion, all BlackBox entries are permanently purged</li>
            <li>Peer session messages follow the same E2E encryption protocol</li>
            <li>Expert/therapist session notes are encrypted with the expert's credentials; students cannot access expert notes and vice versa</li>
          </ul>
        </section>

        {/* 15 */}
        <section id="breach-notification">
          <h2 className="text-lg font-semibold text-foreground mb-3">15. Data Breach Notification</h2>
          <p>In the event of a data breach that poses a risk to your rights and freedoms:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
            <li>We will notify the relevant supervisory authority within 72 hours of becoming aware of the breach (GDPR Art. 33)</li>
            <li>We will notify the Data Protection Board of India as required under the DPDP Act</li>
            <li>If the breach is likely to result in a high risk to your rights, we will notify you directly without undue delay</li>
            <li>Notification will include: nature of the breach, categories and approximate number of affected individuals, likely consequences, and measures taken or proposed</li>
            <li>Given our E2E encryption architecture, a server breach would not expose the content of BlackBox entries, session messages, or session notes</li>
            <li>We maintain a breach response team and conduct regular breach simulation exercises</li>
          </ul>
        </section>

        {/* 16 */}
        <section id="changes">
          <h2 className="text-lg font-semibold text-foreground mb-3">16. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>We will update the "Last updated" date at the top of this Policy</li>
            <li>For material changes, we will provide prominent notice through the Platform (e.g., in-app notification or banner)</li>
            <li>We may request renewed consent where required by applicable law</li>
            <li>Continued use of the Platform after notification constitutes acceptance of the updated Policy</li>
            <li>Previous versions of this Policy are available upon request</li>
          </ul>
        </section>

        {/* 17 */}
        <section id="grievance">
          <h2 className="text-lg font-semibold text-foreground mb-3">17. Grievance Redressal & Data Protection Officer</h2>
          <p>In accordance with the DPDP Act and GDPR, we have appointed a Data Protection Officer (DPO) to oversee our data protection strategy and compliance.</p>
          <div className="mt-3 p-4 rounded-xl bg-card border border-border/50">
            <p className="font-semibold text-foreground mb-2">Data Protection Officer</p>
            <p>Eternia Technologies Private Limited</p>
            <p>Email: <span className="text-primary">dpo@eternia.com</span></p>
            <p>Privacy Inquiries: <span className="text-primary">privacy@eternia.com</span></p>
            <p className="mt-2 text-muted-foreground">Response time: Within 30 days of receiving your request</p>
          </div>
          <p className="mt-3">If you are unsatisfied with our response, you may escalate your complaint to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li><strong>India:</strong> Data Protection Board of India (once constituted under the DPDP Act)</li>
            <li><strong>EU/EEA:</strong> Your local Data Protection Supervisory Authority</li>
            <li><strong>Other jurisdictions:</strong> The relevant data protection authority in your country of residence</li>
          </ul>
        </section>

        {/* 18 */}
        <section id="governing-law">
          <h2 className="text-lg font-semibold text-foreground mb-3">18. Governing Law & Jurisdiction</h2>
          <p>This Privacy Policy is governed by and construed in accordance with the laws of India, including but not limited to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>The Digital Personal Data Protection Act, 2023 (DPDP Act)</li>
            <li>The Information Technology Act, 2000 and its rules (including the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011)</li>
            <li>The Indian Contract Act, 1872</li>
          </ul>
          <p className="mt-2">For users in the European Union or European Economic Area, this Policy also complies with the General Data Protection Regulation (EU) 2016/679 (GDPR) to the extent applicable.</p>
          <p className="mt-2">Any disputes arising under this Privacy Policy shall be subject to the exclusive jurisdiction of the courts in Bengaluru, Karnataka, India, subject to the arbitration provisions in our <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.</p>
        </section>

        <div className="mt-10 pt-6 border-t border-border/30 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Eternia Technologies Private Limited. All rights reserved.</p>
          <p className="mt-1">This Privacy Policy was last reviewed and approved by the Eternia Legal & Compliance team.</p>
          <p className="mt-1">Document ID: PP-2026-v2.0 &nbsp;|&nbsp; Classification: Public</p>
        </div>
      </div>
    </div>
  </div>
);

export default Privacy;
