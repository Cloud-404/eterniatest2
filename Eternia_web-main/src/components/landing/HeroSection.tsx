import { Link } from "react-router-dom";
import { ArrowRight, Play, Shield, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const HeroSection = () => {
  // Infinity glow animation
  const [glowing, setGlowing] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => setGlowing((g) => !g), 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative pt-16 sm:pt-28 pb-10 sm:pb-16 px-4 sm:px-6 overflow-hidden">
      {/* Ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: i % 2 === 0 ? "hsl(243 100% 69%)" : "hsl(12 94% 68%)",
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, (Math.random() - 0.5) * 40, 0],
              opacity: [0, 0.6, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Large glow behind infinity */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.15, 0.06] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[400px] sm:h-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, hsl(243 100% 69% / 0.12), transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.04, 0.1, 0.04] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/3 left-1/3 w-[300px] sm:w-[500px] h-[250px] sm:h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, hsl(12 94% 68% / 0.08), transparent 70%)" }}
        />
      </div>

      <div className="container mx-auto relative z-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-8 sm:mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/60 border border-border/40 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-eternia-success animate-pulse" />
            <span className="text-[11px] sm:text-xs text-muted-foreground">Trusted by 50+ institutions across India</span>
          </div>
        </motion.div>

        {/* Main headline: Welcome to ETERNIA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center mb-3 sm:mb-5"
        >
          <h1 className="text-[28px] sm:text-4xl md:text-5xl font-medium font-display text-muted-foreground tracking-wide">
            Welcome to
          </h1>
        </motion.div>

        {/* ETERNIA with infinity glow from the "I" */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-center mb-6 sm:mb-8 relative"
        >
          <h2 className="text-[52px] sm:text-7xl md:text-8xl lg:text-9xl font-bold font-display tracking-tighter relative inline-block">
            {"ETERN".split("").map((char, i) => (
              <motion.span
                key={i}
                className="text-gradient inline-block"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
              >
                {char}
              </motion.span>
            ))}
            {/* The "I" with photo cards emanating from it */}
            <motion.span
              className="text-gradient inline-block relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.4 }}
            >
              I
            </motion.span>
            {"A".split("").map((char, i) => (
              <motion.span
                key={`after-${i}`}
                className="text-gradient inline-block"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.98, duration: 0.4 }}
              >
                {char}
              </motion.span>
            ))}
          </h2>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="text-center text-[15px] sm:text-lg text-muted-foreground mb-8 sm:mb-10 max-w-lg sm:max-w-2xl mx-auto leading-relaxed"
        >
          Anonymous counselling, peer support, emotional tools & sound therapy — institution-controlled and DPDP-compliant.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6"
        >
          <Link to="/institution-code" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm sm:text-base px-8 h-13 gap-2 font-semibold shadow-lg shadow-primary/20 active:scale-[0.97] transition-all">
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full border-border/50 text-foreground hover:bg-card/80 text-sm sm:text-base px-8 h-13 gap-2 active:scale-[0.97] transition-all">
              <Play className="w-4 h-4" />
              Watch Demo
            </Button>
          </Link>
        </motion.div>

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 text-[12px] sm:text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span>DPDP Compliant</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-eternia-warning" />
            <span>4.9/5 Rating</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>5 min setup</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
