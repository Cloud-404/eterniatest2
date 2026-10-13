import { motion } from "framer-motion";
import { Shield, Zap, Clock, Users, Lock, Globe } from "lucide-react";

const stats = [
  { value: "100%", label: "Anonymous", icon: Lock, color: "text-primary" },
  { value: "24/7", label: "Available", icon: Clock, color: "text-eternia-success" },
  { value: "DPDP", label: "Compliant", icon: Shield, color: "text-eternia-lavender" },
  { value: "AES-256", label: "Encrypted", icon: Zap, color: "text-eternia-warning" },
  { value: "5", label: "Modules", icon: Users, color: "text-primary" },
  { value: "99.9%", label: "Uptime", icon: Globe, color: "text-eternia-success" },
];

const StatsSection = () => (
  <section className="py-14 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
    <div className="container mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8 sm:mb-12"
      >
        <h2 className="section-title">
          Built for <span className="text-gradient">scale & trust</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 max-w-4xl mx-auto">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className="text-center rounded-xl bg-card/30 border border-border/25 p-3 sm:p-4"
          >
            <stat.icon className={`w-4 h-4 mx-auto mb-1.5 sm:mb-2 ${stat.color} opacity-60`} />
            <div className="text-base sm:text-xl font-bold font-display text-foreground">
              {stat.value}
            </div>
            <div className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default StatsSection;
