import { motion } from "framer-motion";

const CodePreviewSection = () => (
  <section className="py-14 sm:py-24 px-4 sm:px-6">
    <div className="container mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8 sm:mb-14"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/15 bg-primary/5 mb-3 sm:mb-5">
          <span className="text-[11px] sm:text-xs font-medium text-primary uppercase tracking-wider">Architecture</span>
        </div>
        <h2 className="section-title">
          Secure by <span className="text-gradient">default</span>
        </h2>
      </motion.div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        {/* Code block */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl bg-card/40 border border-border/25 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive/25" />
              <div className="w-2 h-2 rounded-full bg-eternia-warning/25" />
              <div className="w-2 h-2 rounded-full bg-eternia-success/25" />
            </div>
            <span className="text-[10px] text-primary px-2 py-0.5 rounded bg-primary/8">onboarding.ts</span>
          </div>
          <pre className="p-4 text-[11px] sm:text-[12px] leading-[1.8] overflow-x-auto font-mono">
            <code className="text-muted-foreground">
              <span className="text-eternia-lavender">{"// Three-layer validation"}</span>{"\n"}
              <span className="text-eternia-teal">const</span>{" onboard = "}<span className="text-eternia-teal">async</span>{" (code) => {"}{"\n"}
              {"  "}<span className="text-eternia-teal">const</span>{" inst = "}<span className="text-eternia-teal">await</span>{"\n"}
              {"    validateCode(code);"}{"\n"}
              {"  "}<span className="text-eternia-teal">const</span>{" verified = "}<span className="text-eternia-teal">await</span>{"\n"}
              {"    verifySPOC(inst.qr);"}{"\n"}
              {"  "}<span className="text-eternia-teal">const</span>{" user = "}<span className="text-eternia-teal">await</span>{"\n"}
              {"    createProfile({"}{"\n"}
              {"      username: genAlias(),"}{"\n"}
              {"      credits: "}<span className="text-eternia-warning">80</span>{","}{"\n"}
              {"    });"}{"\n"}
              {"  "}<span className="text-eternia-teal">return</span>{" { user, jwt };"}{"\n"}
              {"};"}
            </code>
          </pre>
        </motion.div>

        {/* Preview */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl bg-card/40 border border-border/25 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border/20">
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Student Profile</span>
          </div>
          <div className="p-4 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-eternia flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">CO</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">cosmic_owl_42</p>
                <p className="text-[10px] text-muted-foreground">Demo University • Student</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Credits", value: "80 ECC", color: "text-eternia-warning" },
                { label: "Modules", value: "5 Active", color: "text-eternia-success" },
                { label: "Encryption", value: "AES-256", color: "text-eternia-lavender" },
                { label: "Anonymity", value: "Full ✓", color: "text-primary" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/12 border border-border/15 p-2.5">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">{item.label}</p>
                  <p className={`text-[12px] font-semibold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-muted/12 border border-border/15 p-2.5">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1.5">Activity</p>
              {[
                { text: "Gratitude Journal Quest", time: "2m" },
                { text: "Peer session ended", time: "1h" },
                { text: "Sound: Deep Focus", time: "3h" },
              ].map((a) => (
                <div key={a.text} className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-foreground/60 truncate">{a.text}</span>
                  <span className="text-[9px] text-muted-foreground/30 shrink-0 ml-2">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default CodePreviewSection;
