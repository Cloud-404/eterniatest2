import { motion } from "framer-motion";
import { Target, Users, Globe, Heart } from "lucide-react";

const AboutSection = () => (
  <section id="about" className="py-14 sm:py-24 px-4 sm:px-6 relative">
    <div className="absolute inset-0 bg-muted/5" />
    <div className="container mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8 sm:mb-14"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 mb-3 sm:mb-5">
          <span className="text-[11px] sm:text-xs font-medium text-primary uppercase tracking-wider">About Us</span>
        </div>
        <h2 className="section-title mb-3">
          About <span className="text-gradient">Eternia</span>
        </h2>
      </motion.div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">
            Eternia is India's first fully anonymous, institution-controlled student mental health platform. 
            We believe that mental health support should be accessible without fear of judgment or identity exposure.
          </p>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6">
            Built with privacy-by-design architecture, DPDP 2023 compliance, and a unique ECC (Eternia Care Credits) 
            economy — Eternia empowers colleges to provide professional counselling, peer support, and self-help tools 
            to every student, anonymously.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Target, label: "Mission", value: "Zero stigma wellness" },
              { icon: Users, label: "Users", value: "50,000+ students" },
              { icon: Globe, label: "Reach", value: "50+ institutions" },
              { icon: Heart, label: "Sessions", value: "100,000+ delivered" },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-xl bg-card/40 border border-border/25">
                <stat.icon className="w-4 h-4 text-primary mb-1.5" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-xs sm:text-sm font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="rounded-2xl overflow-hidden border border-border/25 bg-card/40 p-6 sm:p-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-eternia flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                <span className="text-2xl font-bold font-display text-primary-foreground">∞</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-display text-foreground">You are completely anonymous</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                No real names. No email. No phone number. Your identity is protected by AES-256 encryption 
                and accessible only under formal crisis protocols authorized by your institution.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                {["🔒 Encrypted", "🎭 Anonymous", "🛡️ DPDP"].map((badge) => (
                  <span key={badge} className="px-2.5 py-1 rounded-full bg-primary/10 text-[10px] sm:text-[11px] font-medium text-primary">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default AboutSection;
