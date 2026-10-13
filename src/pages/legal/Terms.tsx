import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import EterniaLogo from "@/components/EterniaLogo";

const sections = [
  { id: "introduction", title: "1. Introduction & Definitions" },
  { id: "acceptance", title: "2. Acceptance of Terms" },
  { id: "eligibility", title: "3. Eligibility & Registration" },
  { id: "account-security", title: "4. Account Security & Anonymity" },
  { id: "spoc-verification", title: "5. SPOC Verification & Institution Binding" },
  { id: "platform-services", title: "6. Platform Services Description" },
  { id: "credits", title: "7. Eternia Credits (ECC)" },
  { id: "acceptable-use", title: "8. Acceptable Use Policy" },
  { id: "content-standards", title: "9. Content Standards & AI Moderation" },
  { id: "ip-rights", title: "10. Intellectual Property Rights" },
  { id: "ugc-license", title: "11. User-Generated Content License" },
  { id: "privacy", title: "12. Privacy & Data Protection" },
  { id: "third-party", title: "13. Third-Party Services & Integrations" },
  { id: "availability", title: "14. Service Availability & Uptime" },
  { id: "liability", title: "15. Limitation of Liability" },
  { id: "indemnification", title: "16. Indemnification" },
  { id: "warranties", title: "17. Disclaimer of Warranties" },
  { id: "emergency", title: "18. Emergency & Crisis Disclaimer" },
  { id: "termination", title: "19. Termination & Suspension" },
  { id: "account-deletion", title: "20. Account Deletion & 30-Day Grace Period" },
  { id: "disputes", title: "21. Dispute Resolution & Arbitration" },
  { id: "governing-law", title: "22. Governing Law & Jurisdiction" },
  { id: "severability", title: "23. Severability" },
  { id: "force-majeure", title: "24. Force Majeure" },
  { id: "contact", title: "25. Contact Information" },
];

const Terms = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-5 py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="flex items-center mb-8">
        <EterniaLogo size={44} />
      </div>

      <h1 className="text-3xl font-bold font-display mb-2">Terms of Service</h1>
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
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduction & Definitions</h2>
          <p>These Terms of Service ("<strong>Terms</strong>") constitute a legally binding agreement between you ("<strong>User</strong>," "<strong>you</strong>," or "<strong>your</strong>") and Eternia Technologies Private Limited ("<strong>Eternia</strong>," "<strong>Company</strong>," "<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>"), a company incorporated under the laws of India, with its registered office in Bengaluru, Karnataka.</p>
          <p className="mt-2">These Terms govern your access to and use of the Eternia platform, including the web application, progressive web app (PWA), backend services, edge functions, and all associated features (collectively, the "<strong>Platform</strong>").</p>
          <p className="mt-3">Key definitions used in these Terms:</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead><tr className="bg-muted/30"><th className="text-left p-2.5 font-semibold text-foreground">Term</th><th className="text-left p-2.5 font-semibold text-foreground">Definition</th></tr></thead>
              <tbody className="divide-y divide-border/30">
                <tr><td className="p-2.5 font-medium">Platform</td><td className="p-2.5">The Eternia web application, PWA, APIs, edge functions, and all associated services.</td></tr>
                <tr><td className="p-2.5 font-medium">User</td><td className="p-2.5">Any individual who accesses or uses the Platform, regardless of role.</td></tr>
                <tr><td className="p-2.5 font-medium">Student</td><td className="p-2.5">A registered user with the "student" role, affiliated with a partnered institution.</td></tr>
                <tr><td className="p-2.5 font-medium">Intern</td><td className="p-2.5">A trained peer counselor who has completed the Eternia training program.</td></tr>
                <tr><td className="p-2.5 font-medium">Expert</td><td className="p-2.5">A licensed mental health professional (psychologist, counselor, or therapist) registered on the Platform.</td></tr>
                <tr><td className="p-2.5 font-medium">SPOC</td><td className="p-2.5">Single Point of Contact — an authorised institutional representative managing the institution's account.</td></tr>
                <tr><td className="p-2.5 font-medium">ECC</td><td className="p-2.5">Eternia Credits — the Platform's internal virtual currency.</td></tr>
                <tr><td className="p-2.5 font-medium">BlackBox</td><td className="p-2.5">The encrypted private journaling feature within the Platform.</td></tr>
                <tr><td className="p-2.5 font-medium">Institution</td><td className="p-2.5">An educational institution, university, college, or organisation that has partnered with Eternia.</td></tr>
                <tr><td className="p-2.5 font-medium">Content</td><td className="p-2.5">Any text, voice recordings, images, or other material created, uploaded, or transmitted through the Platform.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 2 */}
        <section id="acceptance">
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Acceptance of Terms</h2>
          <p>By creating an account, accessing, or using the Platform in any way, you acknowledge that you have read, understood, and agree to be bound by these Terms in their entirety. If you do not agree to these Terms, you must immediately discontinue use of the Platform.</p>
          <p className="mt-2">These Terms incorporate by reference our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and <Link to="/dpdp" className="text-primary hover:underline">DPDP Compliance Statement</Link>, which form an integral part of this agreement.</p>
          <p className="mt-2">We reserve the right to modify these Terms at any time. Material changes will be communicated through in-app notifications at least 15 days before they take effect. Continued use of the Platform after the effective date constitutes acceptance of the modified Terms. If you disagree with any changes, your sole remedy is to discontinue use and request account deletion.</p>
        </section>

        {/* 3 */}
        <section id="eligibility">
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Eligibility & Registration</h2>
          <h3 className="text-sm font-semibold text-foreground mt-3 mb-2">3.1 Age Requirements</h3>
          <p>You must be at least 16 years of age to use the Platform. Users between 16 and 18 must have verifiable parental or guardian consent. By registering, you represent and warrant that you meet the applicable age requirement.</p>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.2 Institutional Affiliation</h3>
          <p>Registration requires a valid institution code or SPOC-generated QR code from a partnered educational institution. You represent that you are a bona fide student, staff member, or authorised personnel of the institution you affiliate with. Misrepresentation of institutional affiliation constitutes a material breach of these Terms.</p>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.3 Registration Process</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Choose an anonymous username (this becomes your permanent identifier)</li>
            <li>Enter your institution code or scan the SPOC QR code</li>
            <li>Create a secure password</li>
            <li>Receive your system-generated Student ID (e.g., ETN-DEMO-00001)</li>
            <li>Receive 100 ECC welcome bonus upon successful registration</li>
          </ul>
          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">3.4 One Account Policy</h3>
          <p>Each person may maintain only one account on the Platform. Creating multiple accounts is strictly prohibited and may result in immediate termination of all accounts. Our device fingerprinting system enforces single-device binding to prevent multi-accounting.</p>
        </section>

        {/* 4 */}
        <section id="account-security">
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Account Security & Anonymity</h2>
          <p>Your account is designed to be anonymous. We do not collect your real name, email, phone number, or other personally identifiable information. You are solely responsible for:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Maintaining the confidentiality of your login credentials</li>
            <li>All activities that occur under your account</li>
            <li>Setting up account recovery credentials (emoji pattern + fragment pairs) to prevent permanent account lockout</li>
            <li>Not sharing your account credentials with any other person</li>
            <li>Immediately notifying us if you suspect unauthorised use of your account</li>
          </ul>
          <p className="mt-2"><strong>Important:</strong> Due to our anonymous architecture, if you lose your credentials and have not set up recovery, we cannot restore your account. This is a deliberate privacy feature — we do not have the ability to identify you outside the Platform.</p>
          <p className="mt-2">Your account is bound to a single device via cryptographic device fingerprinting. To switch devices, you must request a device reset through your SPOC or admin.</p>
        </section>

        {/* 5 */}
        <section id="spoc-verification">
          <h2 className="text-lg font-semibold text-foreground mb-3">5. SPOC Verification & Institution Binding</h2>
          <p>Each partnered institution designates one or more SPOCs who serve as the bridge between the institution and the Eternia platform. The SPOC verification process:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
            <li>SPOCs generate time-limited QR codes (24-hour validity) signed with HMAC-SHA256</li>
            <li>Students scan the QR code during onboarding to verify institutional affiliation</li>
            <li>QR codes contain: institution ID, SPOC ID, timestamp, expiry, and cryptographic signature</li>
            <li>Each QR generation event is recorded in the audit log</li>
            <li>Expired or tampered QR codes are automatically rejected</li>
            <li>Alternative: Students may enter a static institution code provided by the SPOC</li>
          </ul>
          <p className="mt-2">Once bound to an institution, your account remains linked for the duration of your enrollment. Transfer between institutions requires SPOC/admin intervention.</p>
        </section>

        {/* 6 */}
        <section id="platform-services">
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Platform Services Description</h2>
          <p>The Platform provides the following wellbeing services:</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">6.1 Peer Connect</h3>
          <p>Anonymous peer-to-peer counseling sessions between students and trained interns. Sessions are text-based, end-to-end encrypted, and can be escalated to experts if needed. AI moderation monitors for safety concerns.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">6.2 BlackBox</h3>
          <p>A private, encrypted digital journal where students can express thoughts, feelings, and experiences. Entries support text and voice formats. All content is end-to-end encrypted — Eternia cannot read your entries. AI safety moderation processes content transiently on-device.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">6.3 Expert Sessions</h3>
          <p>Scheduled video/audio consultations with licensed mental health professionals. Sessions are facilitated through integrated video SDK. Session notes are encrypted and accessible only to the expert. Sessions are charged in ECC.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">6.4 Sound Therapy</h3>
          <p>Curated library of therapeutic audio content including meditation guides, ambient soundscapes, ASMR, and Tibetan bowl sessions designed to support emotional regulation and relaxation.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">6.5 Self-Help (Quest Cards)</h3>
          <p>Gamified wellbeing activities including daily quests, mindfulness exercises, and wellness challenges. Completing quests earns XP and ECC rewards.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">6.6 Therapist Sessions (BlackBox Live)</h3>
          <p>Real-time crisis intervention sessions between students flagged by AI and licensed therapists. These sessions are initiated through the escalation pipeline and are designed for immediate support.</p>
        </section>

        {/* 7 */}
        <section id="credits">
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Eternia Credits (ECC)</h2>
          <p>The Eternia Credit system is the internal economy of the Platform. Key rules governing ECC:</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">7.1 Earning ECC</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Welcome Bonus:</strong> 100 ECC upon registration</li>
            <li><strong>Quest Completion:</strong> Variable XP/ECC rewards per quest</li>
            <li><strong>Daily Login Streak:</strong> Bonus ECC for consecutive daily logins</li>
            <li><strong>Peer Counseling (Interns):</strong> ECC earned per completed session</li>
            <li><strong>Institutional Grants:</strong> SPOCs may bulk-grant ECC to all active students</li>
            <li><strong>Daily earn cap:</strong> A daily maximum earning limit applies to prevent abuse</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">7.2 Spending ECC</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Booking expert/therapist sessions</li>
            <li>Premium sound therapy content (if applicable)</li>
            <li>Other premium features as introduced</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">7.3 ECC Rules</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>ECC are <strong>non-transferable</strong> between users</li>
            <li>ECC have <strong>no monetary value</strong> outside the Platform</li>
            <li>ECC <strong>cannot be redeemed</strong> for cash, gift cards, or any external value</li>
            <li>ECC balances are <strong>non-refundable</strong> upon account deletion</li>
            <li>Eternia reserves the right to adjust ECC values, earning rates, and spending rates at any time</li>
            <li>Fraudulent accumulation of ECC (via exploits, multi-accounting, or abuse) will result in balance forfeiture and account termination</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">7.4 ECC Stability Pool</h3>
          <p>A portion of institutional credit grants may be allocated to the ECC Stability Pool, which ensures credit availability during high-demand periods. The pool is managed algorithmically and overseen by platform administrators.</p>
        </section>

        {/* 8 */}
        <section id="acceptable-use">
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Acceptable Use Policy</h2>
          <p>You agree to use the Platform only for its intended purpose — personal wellbeing support. You shall NOT:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
            <li>Harass, bully, threaten, intimidate, or abuse other users</li>
            <li>Share sexually explicit, violent, or illegal content</li>
            <li>Impersonate any person, SPOC, expert, or administrator</li>
            <li>Attempt to de-anonymise other users</li>
            <li>Share your credentials or allow others to access your account</li>
            <li>Create multiple accounts or circumvent device binding</li>
            <li>Use the Platform for commercial purposes, advertising, or solicitation</li>
            <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
            <li>Exploit bugs, vulnerabilities, or security flaws (report responsibly instead)</li>
            <li>Scrape, crawl, or automatically extract data from the Platform</li>
            <li>Interfere with, disrupt, or overload the Platform's infrastructure</li>
            <li>Use automated tools, bots, or scripts to interact with the Platform</li>
            <li>Circumvent AI moderation, content filtering, or safety mechanisms</li>
            <li>Distribute malware, viruses, or harmful code through the Platform</li>
            <li>Violate any applicable local, state, national, or international law</li>
            <li>Encourage or facilitate any of the above prohibited activities</li>
          </ul>
          <p className="mt-2">Violation of this Acceptable Use Policy may result in immediate account suspension or termination, with or without prior notice, at Eternia's sole discretion.</p>
        </section>

        {/* 9 */}
        <section id="content-standards">
          <h2 className="text-lg font-semibold text-foreground mb-3">9. Content Standards & AI Moderation</h2>
          <p>All Content created, uploaded, or transmitted through the Platform is subject to our AI moderation system and community guidelines.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">9.1 AI Safety Moderation</h3>
          <p>Our AI system continuously analyses content for safety indicators. Content is processed transiently — the AI does not store the content it analyses. A numeric flag level (0–5) is assigned based on detected risk. See our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> Section 13 for detailed flag level descriptions.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">9.2 Content Guidelines</h3>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Be respectful and supportive in all interactions</li>
            <li>Do not share content that promotes self-harm, suicide, or violence</li>
            <li>Do not share personal identifying information (yours or others')</li>
            <li>Do not share content that is defamatory, obscene, or discriminatory</li>
            <li>Peer counselors must adhere to their training protocols</li>
            <li>Experts must comply with professional ethical standards</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">9.3 Escalation Protocol</h3>
          <p>When AI moderation detects elevated risk, the following escalation protocol applies:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
            <li>Levels 0–2: No action; user may see supportive resources</li>
            <li>Level 3: SPOC is notified; human review initiated</li>
            <li>Level 4: SPOC + designated expert notified</li>
            <li>Level 5: Immediate institutional escalation; emergency protocols activated</li>
          </ul>
          <p className="mt-2">Users have the right to contest AI flag decisions through their SPOC or admin. All escalation actions are logged in the audit trail.</p>
        </section>

        {/* 10 */}
        <section id="ip-rights">
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Intellectual Property Rights</h2>
          <p>All intellectual property rights in the Platform — including but not limited to source code, object code, algorithms, AI models, user interface designs, graphics, logos, trademarks, trade names, service marks, domain names, database structure, and documentation — are owned exclusively by Eternia Technologies Private Limited or its licensors.</p>
          <p className="mt-2">You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Platform for its intended purpose, subject to these Terms. This license does not include:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>The right to reproduce, modify, distribute, or create derivative works of the Platform</li>
            <li>The right to sublicense, assign, or transfer your access rights</li>
            <li>The right to use Eternia's trademarks, logos, or branding without prior written consent</li>
            <li>The right to remove, alter, or obscure any proprietary notices</li>
          </ul>
          <p className="mt-2">The Eternia name, logo, and all related product and service names, designs, and slogans are trademarks of Eternia Technologies Private Limited. You may not use such marks without prior written permission.</p>
        </section>

        {/* 11 */}
        <section id="ugc-license">
          <h2 className="text-lg font-semibold text-foreground mb-3">11. User-Generated Content License</h2>
          <p>You retain ownership of all Content you create on the Platform (BlackBox entries, peer messages, etc.). However, by using the Platform, you grant Eternia a limited license to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Process your Content through our AI moderation system for safety purposes (transient processing only)</li>
            <li>Store your encrypted Content on our servers for service delivery</li>
            <li>Include your Content in aggregated, anonymised, and de-identified datasets for research and platform improvement (no individual Content is identifiable)</li>
          </ul>
          <p className="mt-2">This license is non-exclusive, royalty-free, and limited to the purposes described above. Given our end-to-end encryption architecture, we technically cannot access the plaintext of your encrypted Content. This license terminates upon deletion of your account and Content.</p>
          <p className="mt-2">You represent and warrant that you have all necessary rights and permissions to create and share any Content you submit to the Platform, and that such Content does not infringe upon the rights of any third party.</p>
        </section>

        {/* 12 */}
        <section id="privacy">
          <h2 className="text-lg font-semibold text-foreground mb-3">12. Privacy & Data Protection</h2>
          <p>Your privacy is fundamental to the Eternia platform. Our data practices are governed by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which details:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>What information we collect and why</li>
            <li>How we use, store, and protect your data</li>
            <li>Your rights regarding your Personal Data</li>
            <li>Our cookie policy and consent mechanisms</li>
            <li>Data retention periods and deletion procedures</li>
            <li>Third-party sub-processor disclosures</li>
          </ul>
          <p className="mt-2">We comply with the Digital Personal Data Protection Act, 2023 (DPDP Act) and the General Data Protection Regulation (GDPR) where applicable. For detailed DPDP compliance information, see our <Link to="/dpdp" className="text-primary hover:underline">DPDP Compliance Statement</Link>.</p>
        </section>

        {/* 13 */}
        <section id="third-party">
          <h2 className="text-lg font-semibold text-foreground mb-3">13. Third-Party Services & Integrations</h2>
          <p>The Platform integrates with third-party services to provide certain functionality:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
            <li><strong>Video SDK:</strong> For real-time video/audio sessions with experts and therapists. Subject to the video SDK provider's terms of service.</li>
            <li><strong>AI/ML Providers:</strong> For content moderation and safety analysis. Content is processed transiently; no third-party storage.</li>
            <li><strong>Cloud Infrastructure:</strong> For hosting, database, and storage services.</li>
          </ul>
          <p className="mt-2">Eternia is not responsible for the privacy practices, terms, or actions of third-party services. We select sub-processors that meet our security and privacy standards, and all are bound by data processing agreements.</p>
          <p className="mt-2">The Platform does not contain links to or integrations with social media platforms, advertising networks, or tracking services.</p>
        </section>

        {/* 14 */}
        <section id="availability">
          <h2 className="text-lg font-semibold text-foreground mb-3">14. Service Availability & Uptime</h2>
          <p>We strive to maintain high availability of the Platform but do not guarantee uninterrupted access. The Platform may be temporarily unavailable due to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Scheduled maintenance (with advance notice when possible)</li>
            <li>Emergency security patches or updates</li>
            <li>Infrastructure provider outages</li>
            <li>Force majeure events (see Section 24)</li>
            <li>Unexpected technical issues</li>
          </ul>
          <p className="mt-2">We will make commercially reasonable efforts to minimize downtime and provide advance notice of scheduled maintenance. We are not liable for any loss or damage arising from Platform unavailability.</p>
        </section>

        {/* 15 */}
        <section id="liability">
          <h2 className="text-lg font-semibold text-foreground mb-3">15. Limitation of Liability</h2>
          <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</strong></p>
          <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
            <li>Eternia shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses.</li>
            <li>Eternia's total aggregate liability for all claims arising out of or relating to these Terms or the Platform shall not exceed the total amount of ECC credits you have purchased (if any) in the twelve (12) months preceding the claim, or INR 5,000 (Indian Rupees Five Thousand), whichever is greater.</li>
            <li>Eternia shall not be liable for the actions, advice, or conduct of any other user, including interns, experts, therapists, or SPOCs.</li>
            <li>Eternia shall not be liable for any outcomes resulting from AI moderation decisions, escalation actions, or safety interventions.</li>
            <li>Eternia shall not be liable for data loss due to user failure to maintain account recovery credentials.</li>
          </ul>
          <p className="mt-2">Some jurisdictions do not allow the limitation or exclusion of liability for incidental or consequential damages, so the above limitations may not apply to you. In such cases, our liability shall be limited to the maximum extent permitted by applicable law.</p>
        </section>

        {/* 16 */}
        <section id="indemnification">
          <h2 className="text-lg font-semibold text-foreground mb-3">16. Indemnification</h2>
          <p>You agree to indemnify, defend, and hold harmless Eternia Technologies Private Limited, its officers, directors, employees, contractors, agents, licensors, and suppliers from and against any and all claims, liabilities, damages, judgments, awards, losses, costs, expenses, and fees (including reasonable legal fees) arising out of or relating to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Your violation of these Terms</li>
            <li>Your use or misuse of the Platform</li>
            <li>Content you create, upload, or transmit through the Platform</li>
            <li>Your violation of any applicable law or third-party rights</li>
            <li>Your negligent or intentional misconduct</li>
            <li>Any claim by a third party resulting from your use of the Platform</li>
          </ul>
          <p className="mt-2">This indemnification obligation shall survive the termination of these Terms and your use of the Platform.</p>
        </section>

        {/* 17 */}
        <section id="warranties">
          <h2 className="text-lg font-semibold text-foreground mb-3">17. Disclaimer of Warranties</h2>
          <p><strong>THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.</strong></p>
          <p className="mt-2">To the fullest extent permitted by applicable law, Eternia disclaims all warranties, including but not limited to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Implied warranties of merchantability, fitness for a particular purpose, and non-infringement</li>
            <li>Warranties that the Platform will be uninterrupted, error-free, secure, or virus-free</li>
            <li>Warranties regarding the accuracy, reliability, or completeness of any content, information, or advice provided through the Platform</li>
            <li>Warranties regarding the qualifications, competence, or effectiveness of interns, experts, or therapists</li>
            <li>Warranties that the AI moderation system will accurately detect all safety concerns</li>
          </ul>
          <p className="mt-2">You acknowledge that your use of the Platform is at your sole risk. No advice or information, whether oral or written, obtained by you from Eternia or through the Platform shall create any warranty not expressly stated in these Terms.</p>
        </section>

        {/* 18 */}
        <section id="emergency">
          <h2 className="text-lg font-semibold text-foreground mb-3">18. Emergency & Crisis Disclaimer</h2>
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mt-2">
            <p className="font-semibold text-destructive mb-2">⚠️ CRITICAL NOTICE</p>
            <p><strong>Eternia is NOT a crisis intervention service, emergency medical provider, or substitute for professional psychiatric care.</strong></p>
          </div>
          <p className="mt-3">The Platform is designed as a supplementary wellbeing support tool. It does NOT provide:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Emergency or crisis intervention services</li>
            <li>Medical diagnosis, treatment, or prescription</li>
            <li>Psychiatric evaluation or inpatient care</li>
            <li>24/7 crisis hotline coverage</li>
            <li>Guaranteed response times for urgent situations</li>
          </ul>
          <p className="mt-2"><strong>If you or someone you know is in immediate danger, experiencing a mental health crisis, or having thoughts of suicide or self-harm, please:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Call emergency services: <strong>112</strong> (India), <strong>911</strong> (US), <strong>999</strong> (UK), or your local emergency number</li>
            <li>Contact AASRA (India): <strong>9820466726</strong></li>
            <li>Contact iCall (India): <strong>9152987821</strong></li>
            <li>Contact Vandrevala Foundation Helpline: <strong>1860-2662-345</strong></li>
            <li>Contact the National Suicide Prevention Lifeline (US): <strong>988</strong></li>
            <li>Go to your nearest hospital emergency department</li>
          </ul>
          <p className="mt-2">While our AI moderation system detects risk indicators and escalates to institutional contacts, this system is not infallible and should not be relied upon as the sole mechanism for crisis detection. Eternia accepts no liability for outcomes in emergency situations.</p>
        </section>

        {/* 19 */}
        <section id="termination">
          <h2 className="text-lg font-semibold text-foreground mb-3">19. Termination & Suspension</h2>
          <h3 className="text-sm font-semibold text-foreground mt-3 mb-2">19.1 Termination by You</h3>
          <p>You may terminate your account at any time by initiating the account deletion process through the Platform. Termination is subject to the 30-day grace period described in Section 20.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">19.2 Termination or Suspension by Eternia</h3>
          <p>We may suspend or terminate your account, with or without notice, for:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
            <li>Violation of these Terms or the Acceptable Use Policy</li>
            <li>Fraudulent activity or attempted exploitation of the ECC system</li>
            <li>Multi-accounting or device binding circumvention</li>
            <li>Behaviour that endangers other users or the Platform</li>
            <li>Prolonged inactivity (accounts inactive for 12+ months may be deactivated)</li>
            <li>At the request of your institution's SPOC or admin (with documented justification)</li>
            <li>Legal or regulatory requirements</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">19.3 Effects of Termination</h3>
          <p>Upon termination:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
            <li>Your access to the Platform will be revoked</li>
            <li>Your ECC balance will be forfeited (non-refundable)</li>
            <li>Your data will be handled per the deletion process in Section 20</li>
            <li>Sections 10, 11, 15, 16, 17, 21, and 22 shall survive termination</li>
          </ul>
        </section>

        {/* 20 */}
        <section id="account-deletion">
          <h2 className="text-lg font-semibold text-foreground mb-3">20. Account Deletion & 30-Day Grace Period</h2>
          <p>When you initiate account deletion:</p>
          <ol className="list-decimal list-inside space-y-1.5 ml-2 mt-2">
            <li><strong>Immediate:</strong> Your account is marked for deletion and deactivated. You can no longer log in.</li>
            <li><strong>30-Day Grace Period:</strong> Your data is soft-deleted. During this period, you may contact support to reverse the deletion request and restore your account.</li>
            <li><strong>After 30 Days:</strong> All your data is permanently and irreversibly deleted from all active systems.</li>
            <li><strong>After 90 Days:</strong> All backup copies containing your data are purged.</li>
          </ol>
          <p className="mt-3">Data that has been anonymised and included in aggregated datasets (e.g., institutional usage statistics) cannot be individually deleted as it is no longer attributable to any specific user.</p>
          <p className="mt-2">Certain data may be retained beyond the deletion period if required by law (e.g., audit logs for compliance, credit transactions for financial record-keeping). Such retained data will be minimised and securely stored for the legally mandated duration only.</p>
        </section>

        {/* 21 */}
        <section id="disputes">
          <h2 className="text-lg font-semibold text-foreground mb-3">21. Dispute Resolution & Arbitration</h2>
          <h3 className="text-sm font-semibold text-foreground mt-3 mb-2">21.1 Informal Resolution</h3>
          <p>Before initiating formal proceedings, you agree to first attempt to resolve any dispute informally by contacting us at <span className="text-primary">legal@eternia.com</span>. We will make good faith efforts to resolve the dispute within 30 days.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">21.2 Binding Arbitration</h3>
          <p>If informal resolution fails, any dispute, controversy, or claim arising out of or relating to these Terms shall be finally settled by binding arbitration in accordance with the Arbitration and Conciliation Act, 1996 (India). The arbitration shall:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-1">
            <li>Be conducted by a sole arbitrator mutually appointed by the parties</li>
            <li>Take place in Bengaluru, Karnataka, India</li>
            <li>Be conducted in the English language</li>
            <li>Result in an award that is final and binding on both parties</li>
          </ul>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">21.3 Class Action Waiver</h3>
          <p>You agree that disputes with Eternia will be resolved on an individual basis only. <strong>You waive any right to participate in class actions, class arbitrations, or representative actions.</strong> This waiver applies to the fullest extent permitted by applicable law.</p>

          <h3 className="text-sm font-semibold text-foreground mt-4 mb-2">21.4 Exceptions</h3>
          <p>Notwithstanding the above, either party may seek injunctive or equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement or misappropriation of intellectual property rights.</p>
        </section>

        {/* 22 */}
        <section id="governing-law">
          <h2 className="text-lg font-semibold text-foreground mb-3">22. Governing Law & Jurisdiction</h2>
          <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Applicable legislation includes:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>The Indian Contract Act, 1872</li>
            <li>The Information Technology Act, 2000 and associated rules</li>
            <li>The Digital Personal Data Protection Act, 2023</li>
            <li>The Consumer Protection Act, 2019</li>
            <li>The Arbitration and Conciliation Act, 1996</li>
          </ul>
          <p className="mt-2">Subject to the arbitration clause in Section 21, the courts of Bengaluru, Karnataka, India shall have exclusive jurisdiction over any disputes not subject to arbitration.</p>
        </section>

        {/* 23 */}
        <section id="severability">
          <h2 className="text-lg font-semibold text-foreground mb-3">23. Severability</h2>
          <p>If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable while preserving the original intent, or if modification is not possible, it shall be severed from these Terms.</p>
          <p className="mt-2">The failure of Eternia to exercise or enforce any right or provision of these Terms shall not constitute a waiver of such right or provision. Any waiver must be in writing and signed by an authorised representative of Eternia.</p>
        </section>

        {/* 24 */}
        <section id="force-majeure">
          <h2 className="text-lg font-semibold text-foreground mb-3">24. Force Majeure</h2>
          <p>Eternia shall not be liable for any failure or delay in performing its obligations under these Terms if such failure or delay results from circumstances beyond its reasonable control, including but not limited to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>Natural disasters (earthquakes, floods, hurricanes, epidemics, pandemics)</li>
            <li>Acts of war, terrorism, civil unrest, or armed conflict</li>
            <li>Government actions, sanctions, embargoes, or regulatory changes</li>
            <li>Infrastructure failures (power outages, telecommunications failures, internet disruptions)</li>
            <li>Cyberattacks, DDoS attacks, or other malicious interference</li>
            <li>Third-party service provider outages</li>
            <li>Labour disputes, strikes, or work stoppages</li>
          </ul>
          <p className="mt-2">In the event of a force majeure, Eternia will make reasonable efforts to resume normal operations as soon as practicable and will notify users of material disruptions.</p>
        </section>

        {/* 25 */}
        <section id="contact">
          <h2 className="text-lg font-semibold text-foreground mb-3">25. Contact Information</h2>
          <p>For any questions, concerns, or communications regarding these Terms:</p>
          <div className="mt-3 p-4 rounded-xl bg-card border border-border/50 space-y-3">
            <div>
              <p className="font-semibold text-foreground">General Inquiries</p>
              <p>Email: <span className="text-primary">hello@eternia.com</span></p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Legal & Terms</p>
              <p>Email: <span className="text-primary">legal@eternia.com</span></p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Privacy & Data Protection</p>
              <p>Email: <span className="text-primary">privacy@eternia.com</span></p>
              <p>DPO: <span className="text-primary">dpo@eternia.com</span></p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Security</p>
              <p>Responsible Disclosure: <span className="text-primary">security@eternia.com</span></p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Registered Office</p>
              <p>Eternia Technologies Private Limited</p>
              <p>Bengaluru, Karnataka, India</p>
            </div>
          </div>
        </section>

        <div className="mt-10 pt-6 border-t border-border/30 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Eternia Technologies Private Limited. All rights reserved.</p>
          <p className="mt-1">These Terms of Service were last reviewed and approved by the Eternia Legal & Compliance team.</p>
          <p className="mt-1">Document ID: TOS-2026-v2.0 &nbsp;|&nbsp; Classification: Public</p>
        </div>
      </div>
    </div>
  </div>
);

export default Terms;
