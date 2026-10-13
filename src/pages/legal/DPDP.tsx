import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import EterniaLogo from "@/components/EterniaLogo";

const sections = [
  { id: "overview", title: "1. Overview & Applicability" },
  { id: "definitions", title: "2. Key Definitions Under DPDP Act" },
  { id: "data-fiduciary", title: "3. Eternia as Data Fiduciary" },
  { id: "lawful-purpose", title: "4. Lawful Purpose of Processing" },
  { id: "consent", title: "5. Consent Framework" },
  { id: "data-minimization", title: "6. Data Minimization & Collection" },
  { id: "data-principal-rights", title: "7. Rights of Data Principals" },
  { id: "right-to-access", title: "8. Right to Access Information" },
  { id: "right-to-correction", title: "9. Right to Correction & Erasure" },
  { id: "right-to-grievance", title: "10. Right to Grievance Redressal" },
  { id: "right-to-nominate", title: "11. Right to Nominate" },
  { id: "duties-of-data-principal", title: "12. Duties of Data Principals" },
  { id: "data-protection-officer", title: "13. Data Protection Officer" },
  { id: "data-security", title: "14. Data Security Safeguards" },
  { id: "data-breach", title: "15. Data Breach Notification" },
  { id: "data-retention", title: "16. Data Retention & Deletion" },
  { id: "children-data", title: "17. Processing Children's Data" },
  { id: "cross-border", title: "18. Cross-Border Data Transfers" },
  { id: "significant-data-fiduciary", title: "19. Significant Data Fiduciary Obligations" },
  { id: "institutional-responsibilities", title: "20. Institutional Responsibilities (SPOCs)" },
  { id: "automated-processing", title: "21. Automated Processing & AI Moderation" },
  { id: "anonymization", title: "22. Anonymization & De-identification" },
  { id: "dpb-india", title: "23. Data Protection Board of India" },
  { id: "penalties", title: "24. Penalties & Consequences" },
  { id: "amendments", title: "25. Amendments to This Statement" },
  { id: "contact", title: "26. Contact Information" },
];

const DPDP = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-5 py-8 max-w-4xl">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <div className="flex items-center mb-8">
        <EterniaLogo size={44} />
      </div>

      <h1 className="text-3xl font-bold font-display mb-2">DPDP Act Compliance Statement</h1>
      <p className="text-muted-foreground text-sm mb-2">Last updated: March 22, 2026</p>
      <p className="text-muted-foreground text-sm mb-8">
        Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023) &nbsp;|&nbsp; Version 2.0
      </p>

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
        <section id="overview">
          <h2 className="text-lg font-semibold text-foreground mb-3">1. Overview & Applicability</h2>
          <p className="mb-3">
            This compliance statement outlines how Eternia adheres to the Digital Personal Data Protection Act, 2023 ("DPDP Act" or "the Act"), enacted by the Parliament of India and receiving Presidential assent on August 11, 2023. The Act applies to the processing of digital personal data within the territory of India and to processing outside India if it relates to offering goods or services to Data Principals within India.
          </p>
          <p className="mb-3">
            Eternia is a student wellbeing platform that operates within institutional environments (universities, colleges, schools). We are committed to protecting the digital personal data of every user — students, interns, counseling experts, institutional SPOCs, and administrators — in full compliance with the provisions of the DPDP Act.
          </p>
          <p>
            This document should be read in conjunction with our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>, which together form the complete data governance framework of the Eternia platform.
          </p>
        </section>

        {/* 2 */}
        <section id="definitions">
          <h2 className="text-lg font-semibold text-foreground mb-3">2. Key Definitions Under DPDP Act</h2>
          <p className="mb-3">As defined in Section 2 of the DPDP Act, 2023, the following terms apply throughout this statement:</p>
          <ul className="space-y-2">
            <li><strong className="text-foreground">Data Principal:</strong> The individual to whom the personal data relates. In Eternia's context, this includes students, interns, experts, SPOCs, and administrators who use the platform.</li>
            <li><strong className="text-foreground">Data Fiduciary:</strong> The entity that determines the purpose and means of processing personal data. Eternia operates as a Data Fiduciary for data processed through the platform.</li>
            <li><strong className="text-foreground">Data Processor:</strong> Any entity that processes personal data on behalf of a Data Fiduciary. Our cloud infrastructure and select third-party services act as Data Processors under contractual obligations.</li>
            <li><strong className="text-foreground">Personal Data:</strong> Any data about an individual who is identifiable by or in relation to such data. This includes usernames, session data, device identifiers, and any content submitted through the BlackBox feature.</li>
            <li><strong className="text-foreground">Processing:</strong> Any operation performed on digital personal data, including collection, storage, use, sharing, modification, and erasure.</li>
            <li><strong className="text-foreground">Consent Manager:</strong> A registered entity that manages consent on behalf of a Data Principal. Eternia's cookie consent and privacy preference systems serve this function.</li>
            <li><strong className="text-foreground">Significant Data Fiduciary:</strong> A Data Fiduciary designated by the Central Government based on volume and sensitivity of data processed, risk to Data Principals, and potential impact on sovereignty and security of India.</li>
          </ul>
        </section>

        {/* 3 */}
        <section id="data-fiduciary">
          <h2 className="text-lg font-semibold text-foreground mb-3">3. Eternia as Data Fiduciary</h2>
          <p className="mb-3">
            Under Section 2(i) of the DPDP Act, Eternia functions as a Data Fiduciary. We determine the purpose and means of processing personal data for the following objectives:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Providing anonymous mental wellness and peer support services to students</li>
            <li>Enabling institutional oversight through SPOC-managed frameworks</li>
            <li>Facilitating counseling sessions between students and verified experts</li>
            <li>Managing the Eternia Credits (ECC) economy for fair resource allocation</li>
            <li>Operating AI-moderated content safety and escalation protocols</li>
            <li>Generating anonymized analytics for institutional wellness insights</li>
          </ul>
          <p>
            As a Data Fiduciary, we are obligated under Section 8 of the Act to implement appropriate technical and organizational measures to ensure compliance, protect data integrity, and prevent unauthorized access, use, or disclosure of personal data.
          </p>
        </section>

        {/* 4 */}
        <section id="lawful-purpose">
          <h2 className="text-lg font-semibold text-foreground mb-3">4. Lawful Purpose of Processing</h2>
          <p className="mb-3">
            Under Section 4 of the DPDP Act, personal data may only be processed for a lawful purpose. Eternia processes data exclusively for:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Consent-based processing (Section 6):</strong> User registration, profile creation, BlackBox journaling, and peer/expert session participation — all initiated by explicit user consent.</li>
            <li><strong className="text-foreground">Legitimate uses (Section 7):</strong> Performance of platform services voluntarily requested by the user, compliance with Indian law, responding to medical emergencies where a Data Principal cannot give consent, and employment-related processing for platform staff.</li>
          </ul>
          <p>
            We do not process personal data for purposes beyond those stated at the time of consent collection. Any new purpose requires fresh consent from the Data Principal.
          </p>
        </section>

        {/* 5 */}
        <section id="consent">
          <h2 className="text-lg font-semibold text-foreground mb-3">5. Consent Framework</h2>
          <p className="mb-3">
            In accordance with Section 6 of the DPDP Act, Eternia obtains consent that is:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Free:</strong> No service is conditioned on consent to unnecessary data processing.</li>
            <li><strong className="text-foreground">Specific:</strong> Consent is obtained for each distinct purpose of processing.</li>
            <li><strong className="text-foreground">Informed:</strong> Users are provided clear, plain-language notices describing what data is collected and why.</li>
            <li><strong className="text-foreground">Unconditional:</strong> Consent is not bundled with unrelated terms.</li>
            <li><strong className="text-foreground">Unambiguous:</strong> Affirmative action (opt-in) is required; pre-ticked boxes are never used.</li>
          </ul>
          <p className="mb-3">
            <strong className="text-foreground">Consent Notice:</strong> Before or at the time of collecting personal data, Eternia provides a notice in English and Hindi containing: (a) the personal data to be collected, (b) the purpose of processing, and (c) the manner in which the Data Principal may exercise their rights under the Act.
          </p>
          <p className="mb-3">
            <strong className="text-foreground">Withdrawal of Consent:</strong> Data Principals may withdraw consent at any time with the same ease with which it was given. Upon withdrawal, Eternia ceases processing within a reasonable period (not exceeding 72 hours) and deletes the data unless retention is required by law.
          </p>
          <p>
            <strong className="text-foreground">Cookie Consent:</strong> Eternia implements a granular cookie consent mechanism. Analytics tracking is only activated after explicit acceptance. Users who reject cookies can still use all core platform features.
          </p>
        </section>

        {/* 6 */}
        <section id="data-minimization">
          <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Minimization & Collection</h2>
          <p className="mb-3">
            In strict adherence to DPDP principles and Section 6(1) of the Act, Eternia practices data minimization:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">No real names:</strong> Users register with anonymous usernames only.</li>
            <li><strong className="text-foreground">No personal emails:</strong> Authentication uses system-generated internal identifiers.</li>
            <li><strong className="text-foreground">No phone numbers:</strong> Not collected during registration or usage.</li>
            <li><strong className="text-foreground">No Aadhaar/PAN:</strong> Government identity documents are never requested.</li>
            <li><strong className="text-foreground">No location tracking:</strong> GPS or precise location is never accessed.</li>
            <li><strong className="text-foreground">Encrypted content:</strong> All BlackBox entries and session notes are encrypted at rest.</li>
          </ul>
          <p>
            Data collected is limited to: anonymous username, institution affiliation (via code), device fingerprint hash (for single-device enforcement), session metadata, and user-generated content within the platform (encrypted).
          </p>
        </section>

        {/* 7 */}
        <section id="data-principal-rights">
          <h2 className="text-lg font-semibold text-foreground mb-3">7. Rights of Data Principals</h2>
          <p className="mb-3">
            Chapter III of the DPDP Act grants Data Principals the following rights, all of which Eternia fully supports:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Right to Information (Section 11):</strong> Know what data is being processed and why.</li>
            <li><strong className="text-foreground">Right to Correction & Erasure (Section 12):</strong> Request correction of inaccurate data or complete erasure.</li>
            <li><strong className="text-foreground">Right to Grievance Redressal (Section 13):</strong> Lodge complaints with our Data Protection Officer.</li>
            <li><strong className="text-foreground">Right to Nominate (Section 14):</strong> Designate a nominee to exercise rights in case of death or incapacity.</li>
          </ul>
        </section>

        {/* 8 */}
        <section id="right-to-access">
          <h2 className="text-lg font-semibold text-foreground mb-3">8. Right to Access Information</h2>
          <p className="mb-3">
            Under Section 11 of the DPDP Act, every Data Principal has the right to obtain from the Data Fiduciary:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>A summary of their personal data being processed and the processing activities undertaken</li>
            <li>The identities of all Data Fiduciaries and Data Processors with whom personal data has been shared</li>
            <li>Any other information as prescribed by the Central Government</li>
          </ul>
          <p>
            <strong className="text-foreground">How to exercise:</strong> Users can view their profile data, session history, credit transactions, and BlackBox entries directly through the Eternia dashboard. For a comprehensive data export, contact our Data Protection Officer at <span className="text-primary">dpo@eternia.com</span>.
          </p>
        </section>

        {/* 9 */}
        <section id="right-to-correction">
          <h2 className="text-lg font-semibold text-foreground mb-3">9. Right to Correction & Erasure</h2>
          <p className="mb-3">
            Under Section 12 of the DPDP Act, Data Principals have the right to:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate or misleading personal data. Users can update their profile information, emergency contacts, and preferences directly through the platform settings.</li>
            <li><strong className="text-foreground">Completion:</strong> Request completion of incomplete personal data.</li>
            <li><strong className="text-foreground">Updating:</strong> Request that outdated data be brought up to date.</li>
            <li><strong className="text-foreground">Erasure:</strong> Request deletion of personal data that is no longer necessary for the purpose for which it was collected.</li>
          </ul>
          <p>
            <strong className="text-foreground">Account Deletion:</strong> Eternia provides a self-service account deletion feature with a 30-day grace period. During this period, the account is deactivated. After 30 days, all personal data is permanently and irreversibly deleted, including encrypted BlackBox entries, session records, and credit transaction history.
          </p>
        </section>

        {/* 10 */}
        <section id="right-to-grievance">
          <h2 className="text-lg font-semibold text-foreground mb-3">10. Right to Grievance Redressal</h2>
          <p className="mb-3">
            Under Section 13 of the DPDP Act, Data Principals may register grievances with Eternia. Our grievance redressal mechanism operates as follows:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Step 1:</strong> Submit a grievance via email to <span className="text-primary">dpo@eternia.com</span> with a description of the concern.</li>
            <li><strong className="text-foreground">Step 2:</strong> Acknowledgement within 48 hours of receipt.</li>
            <li><strong className="text-foreground">Step 3:</strong> Resolution within 30 days from the date of receipt.</li>
            <li><strong className="text-foreground">Step 4:</strong> If unsatisfied with the resolution, the Data Principal may file a complaint with the Data Protection Board of India.</li>
          </ul>
          <p>
            Eternia maintains an internal audit log of all grievances received and actions taken, ensuring accountability and compliance traceability.
          </p>
        </section>

        {/* 11 */}
        <section id="right-to-nominate">
          <h2 className="text-lg font-semibold text-foreground mb-3">11. Right to Nominate</h2>
          <p>
            Under Section 14 of the DPDP Act, a Data Principal may nominate any other individual who shall, in the event of death or incapacity of the Data Principal, exercise the rights of the Data Principal. Eternia supports this right and will honor nomination requests submitted in writing to our Data Protection Officer. The nominee will have the right to access, correct, or request erasure of the deceased or incapacitated Data Principal's data.
          </p>
        </section>

        {/* 12 */}
        <section id="duties-of-data-principal">
          <h2 className="text-lg font-semibold text-foreground mb-3">12. Duties of Data Principals</h2>
          <p className="mb-3">
            Section 15 of the DPDP Act also prescribes duties for Data Principals. As a user of Eternia, you agree to:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Comply with applicable laws when exercising your rights under the Act</li>
            <li>Not impersonate another person or provide false or misleading information</li>
            <li>Not suppress any material information when providing personal data</li>
            <li>Not register false or frivolous grievances or complaints with Eternia or the Data Protection Board</li>
            <li>Furnish only verifiably authentic information when exercising rights of correction</li>
          </ul>
        </section>

        {/* 13 */}
        <section id="data-protection-officer">
          <h2 className="text-lg font-semibold text-foreground mb-3">13. Data Protection Officer</h2>
          <p className="mb-3">
            In compliance with Section 8(8) of the DPDP Act, Eternia has appointed a Data Protection Officer (DPO) who serves as the primary point of contact for:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Data Principal inquiries regarding their personal data</li>
            <li>Grievance redressal and complaint resolution</li>
            <li>Communication with the Data Protection Board of India</li>
            <li>Overseeing internal data protection compliance audits</li>
            <li>Advising on Data Protection Impact Assessments (DPIAs)</li>
          </ul>
          <p className="mb-2">
            <strong className="text-foreground">Contact Details:</strong>
          </p>
          <div className="bg-muted/20 rounded-lg border border-border/30 p-4">
            <p>Data Protection Officer — Eternia</p>
            <p>Email: <span className="text-primary">dpo@eternia.com</span></p>
            <p>Response Time: Within 48 hours</p>
            <p>Resolution Target: 30 days from receipt of grievance</p>
          </div>
        </section>

        {/* 14 */}
        <section id="data-security">
          <h2 className="text-lg font-semibold text-foreground mb-3">14. Data Security Safeguards</h2>
          <p className="mb-3">
            Under Section 8(4) of the DPDP Act, Eternia implements reasonable security safeguards to protect personal data from unauthorized access, use, modification, disclosure, or destruction:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Encryption at Rest:</strong> All sensitive data including BlackBox entries, session notes, emergency contacts, and identity verification data is encrypted using AES-256 equivalent encryption.</li>
            <li><strong className="text-foreground">Encryption in Transit:</strong> All data transmitted between clients and servers uses TLS 1.3.</li>
            <li><strong className="text-foreground">Row-Level Security (RLS):</strong> Database access is governed by fine-grained policies ensuring users can only access their own data.</li>
            <li><strong className="text-foreground">Device Binding:</strong> Single-device enforcement through hashed device fingerprints prevents unauthorized multi-device access.</li>
            <li><strong className="text-foreground">Role-Based Access Control:</strong> The platform implements RBAC with five distinct roles (Student, Intern, Expert, SPOC, Admin), each with specific, minimum-necessary permissions.</li>
            <li><strong className="text-foreground">Audit Logging:</strong> All sensitive operations (escalations, role changes, data access by administrators) are immutably logged with timestamps and actor identification.</li>
            <li><strong className="text-foreground">Session Management:</strong> JWT-based authentication with automatic token refresh and configurable session expiry.</li>
          </ul>
        </section>

        {/* 15 */}
        <section id="data-breach">
          <h2 className="text-lg font-semibold text-foreground mb-3">15. Data Breach Notification</h2>
          <p className="mb-3">
            Under Section 8(6) of the DPDP Act, in the event of a personal data breach, Eternia shall:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Notify the Data Protection Board of India</strong> in the prescribed form and manner without unreasonable delay.</li>
            <li><strong className="text-foreground">Notify affected Data Principals</strong> in the prescribed form and manner, providing details of the breach and remedial actions taken.</li>
          </ul>
          <p className="mb-3">
            Our breach response protocol includes:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Immediate containment and assessment within 4 hours of detection</li>
            <li>Internal incident report within 12 hours</li>
            <li>Board notification within 72 hours as prescribed</li>
            <li>Affected user notification within 72 hours</li>
            <li>Post-incident review and remediation within 30 days</li>
            <li>Comprehensive incident report filed with the Data Protection Board</li>
          </ul>
        </section>

        {/* 16 */}
        <section id="data-retention">
          <h2 className="text-lg font-semibold text-foreground mb-3">16. Data Retention & Deletion</h2>
          <p className="mb-3">
            Under Section 8(7) of the DPDP Act, personal data must not be retained beyond the period necessary for the purpose for which it was processed. Eternia's retention schedule:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left p-2 font-semibold text-foreground border-b border-border/30">Data Category</th>
                  <th className="text-left p-2 font-semibold text-foreground border-b border-border/30">Retention Period</th>
                  <th className="text-left p-2 font-semibold text-foreground border-b border-border/30">Deletion Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                <tr><td className="p-2">Profile Data</td><td className="p-2">Duration of account + 30 days</td><td className="p-2">Hard delete</td></tr>
                <tr><td className="p-2">BlackBox Entries</td><td className="p-2">User-controlled (self-delete) + account lifetime</td><td className="p-2">Hard delete with encryption key destruction</td></tr>
                <tr><td className="p-2">Session Records</td><td className="p-2">90 days after session end</td><td className="p-2">Hard delete</td></tr>
                <tr><td className="p-2">Credit Transactions</td><td className="p-2">Duration of account + 30 days</td><td className="p-2">Hard delete</td></tr>
                <tr><td className="p-2">Audit Logs</td><td className="p-2">1 year (legal compliance)</td><td className="p-2">Automated purge</td></tr>
                <tr><td className="p-2">Analytics Events</td><td className="p-2">90 days (anonymized)</td><td className="p-2">Automated purge</td></tr>
                <tr><td className="p-2">Device Fingerprints</td><td className="p-2">Duration of account</td><td className="p-2">Hard delete on account deletion</td></tr>
                <tr><td className="p-2">Emergency Contacts</td><td className="p-2">Duration of account + 30 days</td><td className="p-2">Hard delete with encryption key destruction</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 17 */}
        <section id="children-data">
          <h2 className="text-lg font-semibold text-foreground mb-3">17. Processing Children's Data</h2>
          <p className="mb-3">
            Section 9 of the DPDP Act provides specific protections for children (individuals under 18 years of age). Eternia's compliance:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Institutional Gatekeeping:</strong> Access to Eternia requires a valid institution code issued by a verified institutional SPOC. This acts as a proxy for institutional authorization.</li>
            <li><strong className="text-foreground">No Behavioral Tracking:</strong> Eternia does not track, profile, or target children with advertising or behavioral analysis.</li>
            <li><strong className="text-foreground">No Detrimental Processing:</strong> We do not process children's data in any manner that is likely to cause detrimental effect on their wellbeing. The platform is specifically designed to enhance mental wellness.</li>
            <li><strong className="text-foreground">Verifiable Consent:</strong> For users under 18, the institution (acting in loco parentis under its mandate) provides the authorization framework. SPOCs are responsible for ensuring appropriate consent mechanisms are in place within their institutions.</li>
          </ul>
          <p>
            Eternia does not knowingly collect personal data from children without appropriate institutional authorization. If we become aware that data has been collected from a child without proper authorization, we will take steps to delete such data promptly.
          </p>
        </section>

        {/* 18 */}
        <section id="cross-border">
          <h2 className="text-lg font-semibold text-foreground mb-3">18. Cross-Border Data Transfers</h2>
          <p className="mb-3">
            Under Section 16 of the DPDP Act, the Central Government may restrict transfer of personal data to countries or territories outside India. Eternia's approach:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Primary Storage:</strong> All personal data is stored on infrastructure within India or in jurisdictions not restricted by the Central Government.</li>
            <li><strong className="text-foreground">Data Processors:</strong> Any third-party Data Processors located outside India are contractually bound to comply with equivalent data protection standards and are only engaged in jurisdictions permitted under the Act.</li>
            <li><strong className="text-foreground">Transfer Safeguards:</strong> All cross-border data transfers (if any) include contractual clauses, data processing agreements, and security assessments compliant with DPDP Act requirements.</li>
          </ul>
          <p>
            We will update our transfer mechanisms as the Central Government issues specific notifications regarding restricted territories under Section 16(1).
          </p>
        </section>

        {/* 19 */}
        <section id="significant-data-fiduciary">
          <h2 className="text-lg font-semibold text-foreground mb-3">19. Significant Data Fiduciary Obligations</h2>
          <p className="mb-3">
            Should Eternia be designated as a Significant Data Fiduciary under Section 10 of the DPDP Act, we are prepared to fulfill additional obligations including:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Appointing a Data Protection Officer based in India</li>
            <li>Appointing an independent data auditor to carry out periodic data audits</li>
            <li>Conducting Data Protection Impact Assessments (DPIAs) for high-risk processing activities</li>
            <li>Periodic audits ensuring compliance with the Act and publishing audit findings</li>
            <li>Ensuring algorithmic transparency for automated decision-making processes</li>
            <li>Taking additional measures as prescribed by the Central Government</li>
          </ul>
        </section>

        {/* 20 */}
        <section id="institutional-responsibilities">
          <h2 className="text-lg font-semibold text-foreground mb-3">20. Institutional Responsibilities (SPOCs)</h2>
          <p className="mb-3">
            Institutions partnering with Eternia share certain data protection responsibilities:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Single Point of Contact (SPOC):</strong> Each institution designates a SPOC who is responsible for managing user access, generating institution codes, and overseeing platform usage within their institution.</li>
            <li><strong className="text-foreground">Joint Responsibility:</strong> SPOCs must ensure that students are informed about data processing practices before onboarding. Institutions act as joint controllers where they independently determine purposes of processing student wellbeing data.</li>
            <li><strong className="text-foreground">Escalation Oversight:</strong> SPOCs receive escalation requests only when AI moderation flags concerning content. Even then, SPOCs see only anonymized session identifiers and flag levels — never the content itself.</li>
            <li><strong className="text-foreground">No Direct Data Access:</strong> SPOCs cannot access individual student data, BlackBox entries, or session content. Their view is limited to aggregate statistics and anonymized flags.</li>
          </ul>
        </section>

        {/* 21 */}
        <section id="automated-processing">
          <h2 className="text-lg font-semibold text-foreground mb-3">21. Automated Processing & AI Moderation</h2>
          <p className="mb-3">
            Eternia employs AI-based content moderation for safety purposes. In alignment with the DPDP Act's principles of transparency:
          </p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li><strong className="text-foreground">Purpose:</strong> AI moderation analyzes BlackBox entries and peer chat messages solely for detecting content indicating potential harm (self-harm, crisis indicators, abuse).</li>
            <li><strong className="text-foreground">No Profiling:</strong> AI does not build behavioral profiles, predict preferences, or make decisions about service access.</li>
            <li><strong className="text-foreground">Human Oversight:</strong> All AI-generated flags trigger human review through the escalation protocol. No automated decision results in adverse action against a user without human intervention.</li>
            <li><strong className="text-foreground">Transparency:</strong> Users are informed during onboarding that AI moderation is active for safety purposes.</li>
            <li><strong className="text-foreground">Flag Levels:</strong> Content is categorized into flag levels (0–5), with higher levels triggering more urgent human review. Level 5 flags are immediately escalated to trained counseling professionals.</li>
          </ul>
        </section>

        {/* 22 */}
        <section id="anonymization">
          <h2 className="text-lg font-semibold text-foreground mb-3">22. Anonymization & De-identification</h2>
          <p className="mb-3">
            Eternia implements robust anonymization measures that go beyond the Act's requirements:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Anonymous Usernames:</strong> Users are identified only by self-chosen pseudonyms, not real names.</li>
            <li><strong className="text-foreground">Hashed Identifiers:</strong> Device IDs, student IDs, and institutional codes are stored as cryptographic hashes, irreversible to original values.</li>
            <li><strong className="text-foreground">Analytics Anonymization:</strong> Analytics events do not link to personally identifiable information. Session hashes are random UUIDs with no connection to user identity.</li>
            <li><strong className="text-foreground">Aggregated Reporting:</strong> All institutional reports use aggregated, anonymized data. No individual user can be identified from institutional dashboards.</li>
            <li><strong className="text-foreground">Content Encryption:</strong> BlackBox entries and session notes are encrypted such that even platform administrators cannot read individual content without proper authorization keys.</li>
          </ul>
        </section>

        {/* 23 */}
        <section id="dpb-india">
          <h2 className="text-lg font-semibold text-foreground mb-3">23. Data Protection Board of India</h2>
          <p className="mb-3">
            Chapter V of the DPDP Act establishes the Data Protection Board of India ("the Board") as the adjudicatory body for data protection matters. If you are unsatisfied with Eternia's response to your grievance, you have the right to:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>File a complaint with the Data Protection Board of India in the manner prescribed under Section 28 of the Act</li>
            <li>The Board may, after inquiry, impose penalties on Eternia if a breach of the Act is established</li>
            <li>Appeals against Board decisions may be filed before the Telecom Disputes Settlement and Appellate Tribunal (TDSAT) under Section 29</li>
          </ul>
        </section>

        {/* 24 */}
        <section id="penalties">
          <h2 className="text-lg font-semibold text-foreground mb-3">24. Penalties & Consequences</h2>
          <p className="mb-3">
            Eternia acknowledges the penalty framework established under Schedule I of the DPDP Act and takes all necessary measures to avoid non-compliance:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-border/50 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left p-2 font-semibold text-foreground border-b border-border/30">Breach Type</th>
                  <th className="text-left p-2 font-semibold text-foreground border-b border-border/30">Maximum Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                <tr><td className="p-2">Failure to take security safeguards (Sec 8(5))</td><td className="p-2">₹250 Crore</td></tr>
                <tr><td className="p-2">Failure to notify Board and Data Principals of breach (Sec 8(6))</td><td className="p-2">₹200 Crore</td></tr>
                <tr><td className="p-2">Non-fulfillment of obligations for children's data (Sec 9)</td><td className="p-2">₹200 Crore</td></tr>
                <tr><td className="p-2">Non-fulfillment of Significant Data Fiduciary obligations (Sec 10)</td><td className="p-2">₹150 Crore</td></tr>
                <tr><td className="p-2">Breach of any other provision</td><td className="p-2">₹50 Crore</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 25 */}
        <section id="amendments">
          <h2 className="text-lg font-semibold text-foreground mb-3">25. Amendments to This Statement</h2>
          <p className="mb-3">
            Eternia reserves the right to update this DPDP Compliance Statement to reflect changes in the Act, rules issued by the Central Government, or modifications to our data processing practices. When we make material changes:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Users will be notified through an in-platform announcement banner</li>
            <li>The "Last updated" date at the top of this document will be revised</li>
            <li>Continued use of the platform after notification constitutes acceptance of the updated statement</li>
            <li>For material changes affecting consent, fresh consent will be obtained from all affected Data Principals</li>
          </ul>
        </section>

        {/* 26 */}
        <section id="contact">
          <h2 className="text-lg font-semibold text-foreground mb-3">26. Contact Information</h2>
          <p className="mb-3">
            For any questions, concerns, or requests related to this DPDP Compliance Statement or your personal data rights:
          </p>
          <div className="bg-muted/20 rounded-lg border border-border/30 p-4 space-y-2">
            <p><strong className="text-foreground">Data Protection Officer</strong></p>
            <p>Email: <span className="text-primary">dpo@eternia.com</span></p>
            <p>Subject Line: [DPDP Inquiry] — Your Request</p>
            <p className="pt-2"><strong className="text-foreground">Grievance Officer</strong></p>
            <p>Email: <span className="text-primary">grievance@eternia.com</span></p>
            <p>Response Time: Acknowledgement within 48 hours, resolution within 30 days</p>
            <p className="pt-2"><strong className="text-foreground">Data Protection Board of India</strong></p>
            <p>Website: <span className="text-primary">https://www.dpboard.gov.in</span> (when operational)</p>
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground">
          This document constitutes Eternia's compliance statement under the Digital Personal Data Protection Act, 2023.
          It is a legally binding commitment to all Data Principals using the Eternia platform.
        </p>
      </div>
    </div>
  </div>
);

export default DPDP;
