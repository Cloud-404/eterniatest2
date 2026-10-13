import { motion } from "framer-motion";
import expertConnectImg from "@/assets/services/expert-connect.jpg";
import peerConnectImg from "@/assets/services/peer-connect.jpg";
import blackboxImg from "@/assets/services/blackbox.jpg";
import questCardsImg from "@/assets/services/quest-cards.jpg";
import tibetanBowlImg from "@/assets/services/tibetan-bowl.jpg";
import wreckBuddyImg from "@/assets/services/wreck-buddy.jpg";
import soundTherapyImg from "@/assets/services/sound-therapy.jpg";
import gratitudeImg from "@/assets/services/gratitude.jpg";

const services = [
  { title: "Expert Connect", image: expertConnectImg },
  { title: "Peer Connect", image: peerConnectImg },
  { title: "BlackBox Model", image: blackboxImg },
  { title: "Quest Cards", image: questCardsImg },
  // center slot is the logo
  { title: "Tibetan Bowl", image: tibetanBowlImg },
  { title: "Wreck the Buddy", image: wreckBuddyImg },
  { title: "Sound Therapy", image: soundTherapyImg },
  { title: "Gratitude", image: gratitudeImg },
];

const FeaturesSection = () => {
  // Insert logo card at index 4 (center of 3×3 grid)
  const gridItems = [
    ...services.slice(0, 4),
    { type: "logo" as const },
    ...services.slice(4),
  ];

  return (
    <section id="features" className="py-14 sm:py-24 px-4 sm:px-6 relative">
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 mb-3 sm:mb-5">
            <span className="text-[11px] sm:text-xs font-medium text-primary uppercase tracking-wider">Services</span>
          </div>
          <h2 className="section-title mb-3 max-w-2xl mx-auto">
            Your <span className="text-gradient">wellness toolkit</span>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            Eight powerful modules. One anonymous identity. Complete institutional control.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto">
          {gridItems.map((item, index) => {
            if ("type" in item && item.type === "logo") {
              return (
                <motion.div
                  key="logo-center"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06, duration: 0.4 }}
                  className="hidden sm:flex rounded-2xl bg-card/60 border border-border/30 items-center justify-center aspect-[4/3]"
                >
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-eternia flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                      <span className="text-2xl font-bold font-display text-primary-foreground">∞</span>
                    </div>
                    <p className="text-sm font-bold font-display text-foreground">Eternia</p>
                    <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                      All Services
                    </span>
                  </div>
                </motion.div>
              );
            }

            const service = item as { title: string; image: string };
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06, duration: 0.4 }}
                className="group relative rounded-2xl overflow-hidden aspect-[4/3] cursor-pointer"
              >
                <img
                  src={service.image}
                  alt={service.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                {/* Dark overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {/* Title */}
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-bold font-display text-white drop-shadow-lg">
                    {service.title}
                  </h3>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
