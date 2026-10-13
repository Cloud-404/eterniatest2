import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "Is my identity truly anonymous?",
    a: "Yes. Eternia uses username-based login — no email, phone number, or real name is required. Your personal data is AES-256 encrypted and can only be accessed under formal crisis protocols authorized by your institution's SPOC.",
  },
  {
    q: "How does the ECC (Eternia Care Credits) system work?",
     a: "Each student receives 100 ECC on signup. Credits are used for Expert Connect (50 ECC), Peer Connect (18 ECC), and BlackBox sessions (tiered: 1st free, then 3–6 ECC). You earn more through weekly quests, self-help activities (5 ECC/week cap). If your balance hits zero, the ECC Stability Pool provides essential access.",
  },
  {
    q: "What is the BlackBox feature?",
    a: "BlackBox is an anonymous emotional expression space where students can write or record their thoughts privately. An AI layer quietly monitors content for crisis signals — if a high-risk pattern is detected, it triggers a confidential escalation to your institution's SPOC.",
  },
  {
    q: "How do institutions get started?",
    a: "Three simple steps: 1) Enter your institution code provided by Eternia, 2) Scan the QR code from your institution's SPOC (grievance officer), 3) Create your anonymous username and password. Setup takes under 5 minutes.",
  },
  {
    q: "Is Eternia DPDP 2023 compliant?",
    a: "Yes. Eternia is designed from the ground up for India's Digital Personal Data Protection Act. We support consent withdrawal, data erasure on account deletion, purpose-limited data processing, and provide full audit trails for institutional oversight.",
  },
  {
    q: "Can students be identified by counsellors?",
    a: "No. Counsellors and experts interact with students using only their anonymous usernames. Real identity is encrypted and can only be accessed through a formal escalation process requiring SPOC authorization, admin approval, and documented justification.",
  },
  {
    q: "What happens if I lose my password?",
    a: "During onboarding, you set up a recovery system using emoji patterns and fragment pairs — no email needed. Your SPOC can also reset your device binding if you switch devices.",
  },
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-14 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 mb-3 sm:mb-5">
            <span className="text-[11px] sm:text-xs font-medium text-primary uppercase tracking-wider">FAQ</span>
          </div>
          <h2 className="section-title">
            Frequently asked <span className="text-gradient">questions</span>
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto space-y-2">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.04 }}
              className="rounded-xl border border-border/25 bg-card/30 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
              >
                <span className="text-[13px] sm:text-sm font-medium text-foreground pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 text-[12px] sm:text-[13px] text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
