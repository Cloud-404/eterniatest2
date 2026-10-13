import { Shield, CheckCircle, Lock, Fingerprint, Eye, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const badges = [
  { icon: Lock, label: "AES-256" },
  { icon: Fingerprint, label: "Device Bind" },
  { icon: Eye, label: "Zero-Knowledge" },
  { icon: ShieldCheck, label: "DPDP 2023" },
];

const checkItems = [
  "AES-256 encryption for all personal data",
  "Device-level binding for accountability",
  "Institution-controlled data access",
  "Anonymity in all peer interactions",
  "Formal escalation protocols",
];

const SecuritySection = () => (
  <section id="security" className="py-14 sm:py-24 px-4 sm:px-6 relative">
    <div className="absolute inset-0 bg-muted/5" />

    <div className="container mx-auto relative z-10">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 mb-3 sm:mb-5">
            <span className="text-[11px] sm:text-xs font-medium text-primary uppercase tracking-wider">Security</span>
          </div>
          <h2 className="section-title mb-3 sm:mb-4">
            Privacy-first <span className="text-gradient">by design</span>
          </h2>
          <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
            Student identity is encrypted and accessed only under formal crisis protocols.
          </p>

          <div className="space-y-2.5">
            {checkItems.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-[13px] text-foreground/75">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <div className="rounded-2xl bg-card/40 border border-border/25 p-5 sm:p-6">
            <Shield className="w-9 h-9 text-primary mb-4" />
            <h3 className="text-base sm:text-lg font-bold font-display mb-2">Your Data, Your Control</h3>
            <p className="text-[12px] sm:text-sm text-muted-foreground mb-4 leading-relaxed">
              Personal information is encrypted and stored separately. Only designated authorities can access it.
            </p>
            
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {badges.map((badge) => (
                <div key={badge.label} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-muted/15 border border-border/15">
                  <badge.icon className="w-4 h-4 text-primary/60" />
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground text-center leading-tight">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default SecuritySection;
