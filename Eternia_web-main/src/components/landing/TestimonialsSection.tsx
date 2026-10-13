import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { useState } from "react";

const testimonials = [
  {
    quote: "Eternia transformed how we approach student mental health — the anonymity layer removed the stigma entirely.",
    name: "Dr. Priya Sharma",
    role: "Dean, Student Wellness",
    org: "Demo University",
    backQuote: "Within 3 months, 68% of students engaged with at least one module. The BlackBox feature uncovered hidden crisis cases early.",
  },
  {
    quote: "The security architecture gave us confidence to deploy at scale across our 5,000-student campus.",
    name: "Rajesh Kumar",
    role: "CTO",
    org: "NIT",
    backQuote: "AES-256 encryption, device binding, and DPDP compliance — exactly what our compliance team needed. Zero data incidents since launch.",
  },
  {
    quote: "Students actually use it because they trust it. The peer connect feature is a game-changer.",
    name: "Anita Desai",
    role: "Head Counsellor",
    org: "DSW",
    backQuote: "Our counselling wait times dropped by 40%. The intern-led peer support handles tier-1 cases, freeing experts for complex situations.",
  },
];

const TestimonialsSection = () => {
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  return (
    <section id="testimonials" className="py-14 sm:py-24 px-4 sm:px-6">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 mb-3 sm:mb-5">
            <span className="text-[11px] sm:text-xs font-medium text-primary uppercase tracking-wider">Testimonials</span>
          </div>
          <h2 className="section-title">
            Loved by <span className="text-gradient">campus leaders</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="relative cursor-pointer group"
              style={{ perspective: "1000px" }}
              onClick={() => setFlippedIndex(flippedIndex === index ? null : index)}
            >
              <motion.div
                className="relative w-full"
                animate={{ rotateY: flippedIndex === index ? 180 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Front */}
                <div
                  className="rounded-2xl p-4 sm:p-5 border border-border/25 bg-card/30 min-h-[220px] flex flex-col"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <Quote className="w-6 h-6 text-primary/15 mb-3" />
                  <p className="text-[13px] sm:text-sm text-foreground/85 leading-relaxed mb-4 flex-1">{t.quote}</p>
                  <div className="flex items-center gap-2.5 pt-3 border-t border-border/15">
                    <div className="w-8 h-8 rounded-full bg-gradient-eternia flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                      {t.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-[12px] sm:text-[13px] font-medium text-foreground">{t.name}</p>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground">{t.role}, {t.org}</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground/40 mt-2 text-center">Click to flip →</p>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 rounded-2xl p-4 sm:p-5 border border-primary/20 bg-primary/[0.04] backdrop-blur-sm flex flex-col justify-center"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-eternia flex items-center justify-center text-[10px] font-bold text-primary-foreground mb-3 mx-auto">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <p className="text-[12px] sm:text-[13px] text-foreground/80 leading-relaxed text-center italic">
                    "{t.backQuote}"
                  </p>
                  <p className="text-[10px] text-muted-foreground text-center mt-3">— {t.name}</p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
