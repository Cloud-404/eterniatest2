import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const CTASection = () => (
  <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-[350px] sm:w-[500px] h-[220px] sm:h-[300px] rounded-full opacity-[0.06]"
        style={{ background: "radial-gradient(ellipse, hsl(243 100% 69% / 0.08), transparent 70%)" }} />
    </div>

    <div className="container mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto text-center"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-eternia flex items-center justify-center mx-auto mb-5 sm:mb-7 shadow-lg shadow-primary/15"
        >
          <Sparkles className="w-6 sm:w-7 h-6 sm:h-7 text-primary-foreground" />
        </motion.div>

        <h2 className="text-2xl sm:text-4xl font-bold font-display mb-3 sm:mb-4 tracking-tight">
          Ready to support your{" "}
          <span className="text-gradient">students?</span>
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base mb-7 sm:mb-8 max-w-md mx-auto leading-relaxed">
          Deploy in under 5 minutes. Give every student access to anonymous, professional mental health support.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mb-5">
          <Link to="/institution-code" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm px-7 h-12 gap-2 font-semibold shadow-lg shadow-primary/20">
              Start Free — 80 ECC Included
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full border-border/50 text-foreground hover:bg-card text-sm px-7 h-12">
              Book a demo
            </Button>
          </Link>
        </div>

        <p className="text-[11px] sm:text-xs text-muted-foreground/50">
          No credit card • DPDP compliant • Setup in minutes
        </p>
      </motion.div>
    </div>
  </section>
);

export default CTASection;
