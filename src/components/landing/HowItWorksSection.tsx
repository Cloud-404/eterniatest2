import { motion } from "framer-motion";

const steps = [
  {
    step: "01",
    title: "Enter Institution Code",
    description: "Your college provides a unique Eternia code for platform access.",
  },
  {
    step: "02",
    title: "Verify with SPOC",
    description: "Scan the QR code from your institution's grievance officer.",
  },
  {
    step: "03",
    title: "Create Your Identity",
    description: "Choose a username and password. No email required — you stay anonymous.",
  },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="py-14 sm:py-24 px-4 sm:px-6 relative">
    <div className="absolute inset-0 bg-muted/5" />

    <div className="container mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8 sm:mb-14"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 mb-3 sm:mb-5">
          <span className="text-[11px] sm:text-xs font-medium text-primary uppercase tracking-wider">Getting Started</span>
        </div>
        <h2 className="section-title">
          <span className="text-gradient">Three steps</span> to start
        </h2>
      </motion.div>

      <div className="max-w-lg mx-auto space-y-0">
        {steps.map((item, index) => (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="relative flex gap-3.5 sm:gap-5"
          >
            {index < steps.length - 1 && (
              <div className="absolute left-[18px] sm:left-[22px] top-[44px] w-px h-[calc(100%-20px)] bg-border/30" />
            )}

            <div className="relative z-10 shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-eternia flex items-center justify-center shadow-md shadow-primary/10">
                <span className="text-xs sm:text-sm font-bold font-display text-primary-foreground">{item.step}</span>
              </div>
            </div>

            <div className="pb-7 sm:pb-8">
              <h3 className="text-sm sm:text-[15px] font-semibold font-display mb-0.5 text-foreground">{item.title}</h3>
              <p className="text-[12px] sm:text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
