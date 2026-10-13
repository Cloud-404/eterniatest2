import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

interface NovaOrbProps {
  isActive?: boolean;
  isPulsing?: boolean;
  size?: number;
  audioLevel?: number;
}

const NovaOrb = ({ isActive = false, isPulsing = false, size = 220, audioLevel = 0 }: NovaOrbProps) => {
  const springLevel = useSpring(0, { stiffness: 300, damping: 30 });
  const orbScale = useTransform(springLevel, [0, 1], [1, 1.15]);
  const glowOpacity = useTransform(springLevel, [0, 1], [0.3, 0.9]);
  const glowScale = useTransform(springLevel, [0, 1], [1, 1.25]);

  useEffect(() => {
    springLevel.set(audioLevel);
  }, [audioLevel, springLevel]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)",
          opacity: isActive ? glowOpacity : undefined,
          scale: isActive ? glowScale : undefined,
        }}
        animate={!isActive && (isPulsing) ? { scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] } : !isActive ? {} : undefined}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Main orb */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          background: `radial-gradient(circle at 40% 35%, hsl(195 90% 75%), hsl(var(--primary)) 50%, hsl(210 60% 30%) 100%)`,
          boxShadow: `
            0 0 ${size * 0.3}px hsl(var(--primary) / 0.4),
            0 0 ${size * 0.6}px hsl(var(--primary) / 0.15),
            inset 0 -${size * 0.1}px ${size * 0.2}px hsl(210 60% 20% / 0.5),
            inset 0 ${size * 0.05}px ${size * 0.15}px hsl(195 90% 85% / 0.3)
          `,
          scale: isActive ? orbScale : undefined,
        }}
        animate={
          !isActive && isPulsing
            ? { scale: [1, 1.06, 1] }
            : !isActive
            ? {}
            : undefined
        }
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Highlight reflection */}
        <div
          className="absolute rounded-full"
          style={{
            top: "12%",
            left: "18%",
            width: "35%",
            height: "25%",
            background: "radial-gradient(ellipse, hsl(195 90% 90% / 0.4), transparent)",
            filter: "blur(8px)",
          }}
        />
      </motion.div>
    </div>
  );
};

export default NovaOrb;
